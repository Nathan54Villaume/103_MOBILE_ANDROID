using API_ATF_MOBILE.Models;
using System.Text.Json;

namespace API_ATF_MOBILE.Services
{
    public interface IPlcConnectionService
    {
        Task<List<PlcConnection>> GetAllConnectionsAsync();
        Task<PlcConnection?> GetConnectionByIdAsync(string id);
        Task<PlcConnection> AddConnectionAsync(PlcConnectionCreateDto dto);
        Task<bool> DeleteConnectionAsync(string id);
        Task<PlcConnection?> UpdateConnectionAsync(string id, PlcConnectionCreateDto dto);
        Task<bool> TestConnectionAsync(string id);
        Task<int> GetConnectionResponseTimeAsync(string id);
    }

    public class PlcConnectionService : IPlcConnectionService
    {
        private readonly string _filePath;
        private readonly ILogger<PlcConnectionService> _logger;
        private readonly SemaphoreSlim _semaphore = new(1, 1);
        
        // OPTIMISATION : Cache en mémoire pour éviter de lire le fichier à chaque fois
        private List<PlcConnection>? _cachedConnections;
        private DateTime _lastCacheUpdate = DateTime.MinValue;
        private readonly TimeSpan _cacheExpiration = TimeSpan.FromMinutes(5);

        public PlcConnectionService(IWebHostEnvironment environment, ILogger<PlcConnectionService> logger)
        {
            _logger = logger;
            
            // SOLUTION : Utiliser un dossier persistant au lieu de ContentRootPath
            var appDataPath = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
            var appFolder = Path.Combine(appDataPath, "API_ATF_MOBILE");
            
            // Créer le dossier s'il n'existe pas
            Directory.CreateDirectory(appFolder);
            
            _filePath = Path.Combine(appFolder, "plc-connections.json");
            
            _logger.LogInformation("Stockage PLC configuré dans : {FilePath}", _filePath);
            
            // Créer le fichier avec une connexion par défaut si inexistant
            InitializeDefaultConnections();
        }

        private void InitializeDefaultConnections()
        {
            try
            {
                if (!File.Exists(_filePath))
                {
                    _logger.LogInformation("Fichier PLC inexistant, création avec connexion par défaut : {FilePath}", _filePath);
                    
                    var defaultConnections = new List<PlcConnection>
                    {
                        new PlcConnection
                        {
                            Id = Guid.NewGuid().ToString(),
                            Name = "Concentrateur ATF",
                            IpAddress = "10.250.13.10",
                            Rack = 0,
                            Slot = 1,
                            Port = 102,
                            CpuType = "S7-1500",
                            CreatedAt = DateTime.Now
                        }
                    };

                    SaveConnectionsToFile(defaultConnections);
                    _logger.LogInformation("✅ Fichier PLC créé avec succès avec 1 connexion par défaut");
                }
                else
                {
                    // Vérifier que le fichier est lisible
                    var testRead = File.ReadAllText(_filePath);
                    var connections = JsonSerializer.Deserialize<List<PlcConnection>>(testRead);
                    _logger.LogInformation("✅ Fichier PLC existant trouvé avec {Count} connexions", connections?.Count ?? 0);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ ERREUR lors de l'initialisation du fichier PLC : {FilePath}", _filePath);
                throw;
            }
        }

        public async Task<List<PlcConnection>> GetAllConnectionsAsync()
        {
            // OPTIMISATION : Utiliser le cache si valide
            if (_cachedConnections != null && DateTime.Now - _lastCacheUpdate < _cacheExpiration)
            {
                return new List<PlcConnection>(_cachedConnections); // Retourner une copie
            }

            await _semaphore.WaitAsync();
            try
            {
                if (!File.Exists(_filePath))
                {
                    _cachedConnections = new List<PlcConnection>();
                    _lastCacheUpdate = DateTime.Now;
                    return new List<PlcConnection>();
                }

                var json = await File.ReadAllTextAsync(_filePath);
                var connections = JsonSerializer.Deserialize<List<PlcConnection>>(json) ?? new List<PlcConnection>();
                
                // Mettre à jour le cache
                _cachedConnections = connections;
                _lastCacheUpdate = DateTime.Now;
                
                return new List<PlcConnection>(connections);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur lors de la lecture des connexions PLC");
                return new List<PlcConnection>();
            }
            finally
            {
                _semaphore.Release();
            }
        }

        public async Task<PlcConnection?> GetConnectionByIdAsync(string id)
        {
            var connections = await GetAllConnectionsAsync();
            return connections.FirstOrDefault(c => c.Id == id);
        }

        public async Task<PlcConnection> AddConnectionAsync(PlcConnectionCreateDto dto)
        {
            await _semaphore.WaitAsync();
            try
            {
                var connections = await GetAllConnectionsAsync();

                var newConnection = new PlcConnection
                {
                    Id = Guid.NewGuid().ToString(),
                    Name = dto.Name,
                    IpAddress = dto.IpAddress,
                    Rack = dto.Rack,
                    Slot = dto.Slot,
                    Port = dto.Port,
                    CpuType = dto.CpuType,
                    CreatedAt = DateTime.Now
                };

                connections.Add(newConnection);
                SaveConnectionsToFile(connections);
                
                // Invalider le cache
                _cachedConnections = null;

                _logger.LogInformation("Nouvelle connexion PLC ajoutée : {Name} ({IpAddress})", newConnection.Name, newConnection.IpAddress);

                return newConnection;
            }
            finally
            {
                _semaphore.Release();
            }
        }

        public async Task<bool> DeleteConnectionAsync(string id)
        {
            await _semaphore.WaitAsync();
            try
            {
                var connections = await GetAllConnectionsAsync();
                var connection = connections.FirstOrDefault(c => c.Id == id);

                if (connection == null)
                {
                    return false;
                }

                connections.Remove(connection);
                SaveConnectionsToFile(connections);
                
                // Invalider le cache
                _cachedConnections = null;

                _logger.LogInformation("Connexion PLC supprimée : {Name} ({IpAddress})", connection.Name, connection.IpAddress);

                return true;
            }
            finally
            {
                _semaphore.Release();
            }
        }

        public async Task<PlcConnection?> UpdateConnectionAsync(string id, PlcConnectionCreateDto dto)
        {
            await _semaphore.WaitAsync();
            try
            {
                var connections = await GetAllConnectionsAsync();
                var connection = connections.FirstOrDefault(c => c.Id == id);

                if (connection == null)
                {
                    return null;
                }

                connection.Name = dto.Name;
                connection.IpAddress = dto.IpAddress;
                connection.Rack = dto.Rack;
                connection.Slot = dto.Slot;
                connection.Port = dto.Port;
                connection.CpuType = dto.CpuType;
                connection.LastModified = DateTime.Now;

                SaveConnectionsToFile(connections);
                
                // Invalider le cache
                _cachedConnections = null;

                _logger.LogInformation("Connexion PLC mise à jour : {Name} ({IpAddress})", connection.Name, connection.IpAddress);

                return connection;
            }
            finally
            {
                _semaphore.Release();
            }
        }

        private void SaveConnectionsToFile(List<PlcConnection> connections)
        {
            try
            {
                var options = new JsonSerializerOptions
                {
                    WriteIndented = true
                };

                var json = JsonSerializer.Serialize(connections, options);
                
                // Sauvegarde atomique : écrire dans un fichier temporaire puis renommer
                var tempPath = _filePath + ".tmp";
                File.WriteAllText(tempPath, json);
                
                // Remplacer l'ancien fichier par le nouveau (opération atomique)
                if (File.Exists(_filePath))
                {
                    File.Delete(_filePath);
                }
                File.Move(tempPath, _filePath);
                
                _logger.LogDebug("Connexions PLC sauvegardées : {Count} connexions dans {FilePath}", 
                    connections.Count, _filePath);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "ERREUR CRITIQUE : Impossible de sauvegarder les connexions PLC dans {FilePath}", _filePath);
                throw; // Remonter l'erreur pour que l'appelant sache que la sauvegarde a échoué
            }
        }

        /// <summary>
        /// Tester la connexion à un PLC S7
        /// </summary>
        public async Task<bool> TestConnectionAsync(string id)
        {
            try
            {
                var connection = await GetConnectionByIdAsync(id);
                if (connection == null)
                {
                    _logger.LogWarning("Connexion PLC {Id} non trouvée pour le test", id);
                    return false;
                }

                _logger.LogInformation("Test de connexion PLC {Name} ({IpAddress}:{Port})", 
                    connection.Name, connection.IpAddress, connection.Port);

                // Utilisation d'un simple ping TCP pour tester la connectivité
                using var tcpClient = new System.Net.Sockets.TcpClient();
                var connectTask = tcpClient.ConnectAsync(connection.IpAddress, connection.Port);
                var timeoutTask = Task.Delay(TimeSpan.FromSeconds(5));
                
                var completedTask = await Task.WhenAny(connectTask, timeoutTask);
                
                if (completedTask == connectTask && tcpClient.Connected)
                {
                    _logger.LogInformation("Connexion PLC {Name} : SUCCESS", connection.Name);
                    return true;
                }
                else
                {
                    _logger.LogWarning("Connexion PLC {Name} : TIMEOUT ou FAILED", connection.Name);
                    return false;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur lors du test de connexion PLC {Id}", id);
                return false;
            }
        }

        /// <summary>
        /// Obtenir le temps de réponse d'une connexion PLC
        /// </summary>
        public async Task<int> GetConnectionResponseTimeAsync(string id)
        {
            try
            {
                var connection = await GetConnectionByIdAsync(id);
                if (connection == null)
                {
                    return -1;
                }

                var stopwatch = System.Diagnostics.Stopwatch.StartNew();
                
                using var tcpClient = new System.Net.Sockets.TcpClient();
                var connectTask = tcpClient.ConnectAsync(connection.IpAddress, connection.Port);
                var timeoutTask = Task.Delay(TimeSpan.FromSeconds(5));
                
                var completedTask = await Task.WhenAny(connectTask, timeoutTask);
                stopwatch.Stop();
                
                if (completedTask == connectTask && tcpClient.Connected)
                {
                    return (int)stopwatch.ElapsedMilliseconds;
                }
                else
                {
                    return -1; // Timeout ou erreur
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur lors de la mesure du temps de réponse PLC {Id}", id);
                return -1;
            }
        }
    }
}

