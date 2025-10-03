using API_ATF_MOBILE.Models;
using Microsoft.AspNetCore.Hosting;
using System.Collections.Concurrent;
using System.Globalization;
using System.IO.Compression;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace API_ATF_MOBILE.Services
{
    /// <summary>
    /// Interface pour le service de commentaires V2 (JSONL, multi-commentaires)
    /// </summary>
    public interface ICommentsServiceV2
    {
        Task<CommentsPaginatedResponse> GetCommentsAsync(string entityId, int limit = 50, string? cursor = null);
        Task<Comment> AddCommentAsync(CommentCreateDto dto, string? userId = null);
        Task<int> GetCommentCountAsync(string entityId);
        Task ArchiveOldCommentsAsync();
    }

    /// <summary>
    /// Service de commentaires V2 - Stockage JSONL avec pagination et rate-limiting
    /// Stockage: ApplicationData/API_ATF_MOBILE/comments/
    /// </summary>
    public class CommentsServiceV2 : ICommentsServiceV2
    {
        private readonly string _commentsDirectory;
        private readonly ILogger<CommentsServiceV2> _logger;
        
        // Verrous par fichier pour éviter les collisions d'écriture
        private readonly ConcurrentDictionary<string, SemaphoreSlim> _fileLocks = new();
        
        // Rate limiting: IP -> dernières timestamps
        private readonly ConcurrentDictionary<string, List<DateTime>> _rateLimitStore = new();
        private readonly int _maxRequestsPer5Min = 10;
        
        // Taille maximale d'un fichier avant archivage (5 Mo)
        private readonly long _maxFileSize = 5 * 1024 * 1024;

        public CommentsServiceV2(ILogger<CommentsServiceV2> logger, IWebHostEnvironment environment)
        {
            _logger = logger;
            
            // SOLUTION : Utiliser un chemin persistant qui survit aux déploiements
            // Chemin fixe : C:\API_ATF_MOBILE\DATA\comments\ (au même niveau que DEPLOIEMENT_API)
            var dataPath = Path.Combine("C:", "API_ATF_MOBILE", "DATA", "comments");
            _commentsDirectory = dataPath;
            
            try
            {
                // Créer le dossier s'il n'existe pas
                Directory.CreateDirectory(_commentsDirectory);
                _logger.LogInformation("💬 Service de commentaires V2 initialisé : {Path}", _commentsDirectory);
                _logger.LogInformation("📁 Chemin persistant (survit aux déploiements) : {Path}", _commentsDirectory);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Impossible de créer le répertoire de commentaires: {Path}", _commentsDirectory);
                // Ne pas throw pour éviter de bloquer le démarrage de l'application
                _logger.LogWarning("⚠️ Le service de commentaires V2 fonctionnera en mode dégradé");
            }
        }

        /// <summary>
        /// Obtenir les commentaires paginés pour une entité
        /// </summary>
        public async Task<CommentsPaginatedResponse> GetCommentsAsync(string entityId, int limit = 50, string? cursor = null)
        {
            try
            {
                var filePath = GetFilePath(entityId);
                
                if (!File.Exists(filePath))
                {
                    return new CommentsPaginatedResponse { Items = new(), Total = 0 };
                }

                var comments = await ReadAllCommentsFromFileAsync(filePath);
                
                // Trier par date décroissante (plus récent en premier)
                comments = comments.OrderByDescending(c => c.CreatedAt).ToList();
                
                // Filtrer par curseur si fourni
                if (!string.IsNullOrEmpty(cursor) && DateTime.TryParse(cursor, null, DateTimeStyles.RoundtripKind, out var cursorDate))
                {
                    comments = comments.Where(c => c.CreatedAt < cursorDate).ToList();
                }
                
                // Pagination
                var items = comments.Take(limit).ToList();
                var nextCursor = items.Count == limit && comments.Count > limit 
                    ? items.Last().CreatedAt.ToString("O") 
                    : null;
                
                return new CommentsPaginatedResponse
                {
                    Items = items,
                    NextCursor = nextCursor,
                    Total = comments.Count
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Erreur lors de la lecture des commentaires pour {EntityId}", entityId);
                throw;
            }
        }

        /// <summary>
        /// Ajouter un nouveau commentaire (avec validation et sanitization)
        /// </summary>
        public async Task<Comment> AddCommentAsync(CommentCreateDto dto, string? userId = null)
        {
            try
            {
                // Validation et sanitization
                var sanitizedName = SanitizeInput(dto.AuthorName.Trim());
                var sanitizedMessage = SanitizeInput(dto.Message.Trim());
                
                if (sanitizedName.Length < 2 || sanitizedName.Length > 80)
                    throw new ArgumentException("Le nom doit contenir entre 2 et 80 caractères.");
                
                if (sanitizedMessage.Length < 1 || sanitizedMessage.Length > 2000)
                    throw new ArgumentException("Le message doit contenir entre 1 et 2000 caractères.");
                
                // Créer le commentaire
                var comment = new Comment
                {
                    Id = Guid.NewGuid().ToString(),
                    EntityId = dto.EntityId.Trim(),
                    AuthorName = sanitizedName,
                    AuthorId = userId,
                    Message = sanitizedMessage,
                    CreatedAt = DateTime.UtcNow
                };
                
                // Append au fichier JSONL
                await AppendCommentToFileAsync(comment);
                
                _logger.LogInformation("✅ Commentaire ajouté : {Id} sur {EntityId} par {Author}", 
                    comment.Id, comment.EntityId, comment.AuthorName);
                
                // Vérifier si le fichier doit être archivé
                _ = Task.Run(() => CheckAndArchiveIfNeededAsync(comment.EntityId));
                
                return comment;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Erreur lors de l'ajout du commentaire");
                throw;
            }
        }

        /// <summary>
        /// Obtenir le nombre de commentaires pour une entité
        /// </summary>
        public async Task<int> GetCommentCountAsync(string entityId)
        {
            try
            {
                var filePath = GetFilePath(entityId);
                
                if (!File.Exists(filePath))
                    return 0;
                
                var comments = await ReadAllCommentsFromFileAsync(filePath);
                return comments.Count;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Erreur lors du comptage des commentaires pour {EntityId}", entityId);
                return 0;
            }
        }

        /// <summary>
        /// Archiver les anciens commentaires (rotation)
        /// </summary>
        public async Task ArchiveOldCommentsAsync()
        {
            try
            {
                var files = Directory.GetFiles(_commentsDirectory, "comments-*.jsonl");
                
                foreach (var file in files)
                {
                    var fileInfo = new FileInfo(file);
                    
                    if (fileInfo.Length > _maxFileSize)
                    {
                        var entityId = Path.GetFileNameWithoutExtension(file).Replace("comments-", "");
                        await ArchiveFileAsync(entityId);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Erreur lors de l'archivage des commentaires");
            }
        }

        // --- Méthodes privées ---

        private string GetFilePath(string entityId)
        {
            var safeEntityId = SanitizeFileName(entityId);
            return Path.Combine(_commentsDirectory, $"comments-{safeEntityId}.jsonl");
        }

        private SemaphoreSlim GetFileLock(string filePath)
        {
            return _fileLocks.GetOrAdd(filePath, _ => new SemaphoreSlim(1, 1));
        }

        private async Task<List<Comment>> ReadAllCommentsFromFileAsync(string filePath)
        {
            var comments = new List<Comment>();
            var lockObj = GetFileLock(filePath);
            
            await lockObj.WaitAsync();
            try
            {
                var lines = await File.ReadAllLinesAsync(filePath, Encoding.UTF8);
                
                foreach (var line in lines)
                {
                    if (string.IsNullOrWhiteSpace(line))
                        continue;
                    
                    try
                    {
                        var comment = JsonSerializer.Deserialize<Comment>(line);
                        if (comment != null)
                            comments.Add(comment);
                    }
                    catch (JsonException ex)
                    {
                        _logger.LogWarning(ex, "⚠️ Ligne JSONL malformée ignorée : {Line}", line.Substring(0, Math.Min(50, line.Length)));
                    }
                }
            }
            finally
            {
                lockObj.Release();
            }
            
            return comments;
        }

        private async Task AppendCommentToFileAsync(Comment comment)
        {
            var filePath = GetFilePath(comment.EntityId);
            var lockObj = GetFileLock(filePath);
            
            await lockObj.WaitAsync();
            try
            {
                var json = JsonSerializer.Serialize(comment, new JsonSerializerOptions
                {
                    Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
                });
                
                // Append atomique avec FileStream en mode Append + flush
                using var fileStream = new FileStream(filePath, FileMode.Append, FileAccess.Write, FileShare.None);
                using var writer = new StreamWriter(fileStream, Encoding.UTF8);
                await writer.WriteLineAsync(json);
                await writer.FlushAsync();
            }
            finally
            {
                lockObj.Release();
            }
        }

        private async Task CheckAndArchiveIfNeededAsync(string entityId)
        {
            try
            {
                var filePath = GetFilePath(entityId);
                
                if (!File.Exists(filePath))
                    return;
                
                var fileInfo = new FileInfo(filePath);
                
                if (fileInfo.Length > _maxFileSize)
                {
                    await ArchiveFileAsync(entityId);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Erreur lors de la vérification d'archivage pour {EntityId}", entityId);
            }
        }

        private async Task ArchiveFileAsync(string entityId)
        {
            var filePath = GetFilePath(entityId);
            var lockObj = GetFileLock(filePath);
            
            await lockObj.WaitAsync();
            try
            {
                var timestamp = DateTime.Now.ToString("yyyyMMdd_HHmmss");
                var archivePath = Path.Combine(
                    _commentsDirectory, 
                    $"comments-{SanitizeFileName(entityId)}-{timestamp}.jsonl.gz"
                );
                
                // Créer une archive gzip
                using (var originalStream = File.OpenRead(filePath))
                using (var archiveStream = File.Create(archivePath))
                using (var gzipStream = new GZipStream(archiveStream, CompressionMode.Compress))
                {
                    await originalStream.CopyToAsync(gzipStream);
                }
                
                // Créer un nouveau fichier vide (ou garder les 100 derniers commentaires)
                var comments = await ReadAllCommentsFromFileAsync(filePath);
                var recentComments = comments.OrderByDescending(c => c.CreatedAt).Take(100).ToList();
                
                // Backup avant écrasement
                var backupPath = filePath + ".bak";
                File.Copy(filePath, backupPath, overwrite: true);
                
                // Réécrire le fichier avec les commentaires récents uniquement
                File.Delete(filePath);
                foreach (var comment in recentComments.OrderBy(c => c.CreatedAt))
                {
                    await AppendCommentToFileAsync(comment);
                }
                
                // Supprimer le backup si tout s'est bien passé
                File.Delete(backupPath);
                
                _logger.LogInformation("📦 Fichier archivé : {Archive} (gardé {Count} commentaires récents)", 
                    archivePath, recentComments.Count);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Erreur lors de l'archivage du fichier pour {EntityId}", entityId);
            }
            finally
            {
                lockObj.Release();
            }
        }

        /// <summary>
        /// Sanitize input pour éviter XSS (strip HTML tags)
        /// </summary>
        private string SanitizeInput(string input)
        {
            if (string.IsNullOrEmpty(input))
                return string.Empty;
            
            // Supprimer tous les tags HTML
            var withoutTags = Regex.Replace(input, @"<[^>]*>", string.Empty);
            
            // Décoder les entités HTML
            var decoded = System.Net.WebUtility.HtmlDecode(withoutTags);
            
            return decoded.Trim();
        }

        private string SanitizeFileName(string fileName)
        {
            var invalid = Path.GetInvalidFileNameChars();
            return string.Join("_", fileName.Split(invalid, StringSplitOptions.RemoveEmptyEntries));
        }

        /// <summary>
        /// Vérifier le rate limit pour une IP
        /// </summary>
        public bool CheckRateLimit(string ipAddress)
        {
            var now = DateTime.UtcNow;
            var fiveMinutesAgo = now.AddMinutes(-5);
            
            var timestamps = _rateLimitStore.GetOrAdd(ipAddress, _ => new List<DateTime>());
            
            lock (timestamps)
            {
                // Nettoyer les anciens timestamps
                timestamps.RemoveAll(t => t < fiveMinutesAgo);
                
                // Vérifier le nombre de requêtes
                if (timestamps.Count >= _maxRequestsPer5Min)
                {
                    _logger.LogWarning("⚠️ Rate limit dépassé pour {IP} ({Count} req/5min)", 
                        ipAddress, timestamps.Count);
                    return false;
                }
                
                // Ajouter le nouveau timestamp
                timestamps.Add(now);
                return true;
            }
        }
    }
}

