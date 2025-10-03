using API_ATF_MOBILE.Models;
using System.Text.Json;
using System.Collections.Concurrent;

namespace API_ATF_MOBILE.Services
{
    /// <summary>
    /// Service pour la gestion des commentaires de projets (stockage en fichier JSON)
    /// </summary>
    public class CommentsService : ICommentsService
    {
        private readonly string _dataFilePath;
        private readonly ILogger<CommentsService> _logger;
        private readonly ConcurrentDictionary<string, CommentResponse> _commentsCache = new();
        private readonly SemaphoreSlim _fileLock = new(1, 1);

        public CommentsService(ILogger<CommentsService> logger, IWebHostEnvironment environment)
        {
            _logger = logger;
            
            // Chemin vers le fichier de données (dans wwwroot pour persistance)
            var wwwrootPath = Path.Combine(environment.WebRootPath, "data");
            Directory.CreateDirectory(wwwrootPath); // Créer le dossier s'il n'existe pas
            
            _dataFilePath = Path.Combine(wwwrootPath, "project-comments.json");
            
            // Charger les commentaires existants au démarrage
            _ = Task.Run(async () => await LoadCommentsFromFileAsync());
        }

        /// <summary>
        /// Charger les commentaires depuis le fichier
        /// </summary>
        private async Task LoadCommentsFromFileAsync()
        {
            try
            {
                await _fileLock.WaitAsync();
                
                if (File.Exists(_dataFilePath))
                {
                    var json = await File.ReadAllTextAsync(_dataFilePath);
                    var comments = JsonSerializer.Deserialize<Dictionary<string, CommentResponse>>(json) 
                                 ?? new Dictionary<string, CommentResponse>();
                    
                    _commentsCache.Clear();
                    foreach (var comment in comments)
                    {
                        _commentsCache.TryAdd(comment.Key, comment.Value);
                    }
                    
                    _logger.LogInformation("✅ {Count} commentaires chargés depuis le fichier", _commentsCache.Count);
                }
                else
                {
                    _logger.LogInformation("📁 Aucun fichier de commentaires trouvé, création d'un nouveau fichier");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Erreur lors du chargement des commentaires");
            }
            finally
            {
                _fileLock.Release();
            }
        }

        /// <summary>
        /// Sauvegarder les commentaires dans le fichier
        /// </summary>
        private async Task SaveCommentsToFileAsync()
        {
            try
            {
                await _fileLock.WaitAsync();
                
                var comments = _commentsCache.ToDictionary(kvp => kvp.Key, kvp => kvp.Value);
                var json = JsonSerializer.Serialize(comments, new JsonSerializerOptions
                {
                    WriteIndented = true,
                    Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
                });
                
                await File.WriteAllTextAsync(_dataFilePath, json);
                _logger.LogInformation("💾 Commentaires sauvegardés dans {FilePath}", _dataFilePath);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Erreur lors de la sauvegarde des commentaires");
                throw;
            }
            finally
            {
                _fileLock.Release();
            }
        }

        public async Task<Dictionary<string, CommentResponse>> GetAllCommentsAsync()
        {
            // S'assurer que les données sont chargées
            if (_commentsCache.IsEmpty)
            {
                await LoadCommentsFromFileAsync();
            }
            
            return _commentsCache.ToDictionary(kvp => kvp.Key, kvp => kvp.Value);
        }

        public async Task<CommentResponse?> GetCommentByProjectIdAsync(string projectId)
        {
            if (_commentsCache.IsEmpty)
            {
                await LoadCommentsFromFileAsync();
            }
            
            return _commentsCache.TryGetValue(projectId, out var comment) ? comment : null;
        }

        public async Task<CommentResponse> SaveCommentAsync(CommentRequest request)
        {
            var now = DateTime.UtcNow;
            var comment = new CommentResponse
            {
                ProjectId = request.ProjectId,
                Comment = request.Comment,
                Author = request.Author,
                CreatedAt = _commentsCache.TryGetValue(request.ProjectId, out var existing) 
                           ? existing.CreatedAt 
                           : now,
                UpdatedAt = now
            };

            // Mettre à jour le cache
            _commentsCache.AddOrUpdate(request.ProjectId, comment, (key, oldValue) => comment);
            
            // Sauvegarder dans le fichier
            await SaveCommentsToFileAsync();
            
            _logger.LogInformation("💬 Commentaire sauvegardé pour le projet {ProjectId} par {Author}", 
                                 request.ProjectId, request.Author);
            
            return comment;
        }

        public async Task<bool> DeleteCommentAsync(string projectId)
        {
            var removed = _commentsCache.TryRemove(projectId, out _);
            
            if (removed)
            {
                await SaveCommentsToFileAsync();
                _logger.LogInformation("🗑️ Commentaire supprimé pour le projet {ProjectId}", projectId);
            }
            
            return removed;
        }

        public async Task<int> GetCommentsCountAsync()
        {
            if (_commentsCache.IsEmpty)
            {
                await LoadCommentsFromFileAsync();
            }
            
            return _commentsCache.Count;
        }
    }
}
