using System.Text.RegularExpressions;
using System.Collections.Concurrent;

namespace API_ATF_MOBILE.Services
{
    public interface ILogReaderService
    {
        Task<List<LogEntry>> GetRecentLogsAsync(int count = 100, string? level = null);
        Task<List<LogEntry>> SearchLogsAsync(string searchTerm, int maxResults = 100);
        Task<LogStatistics> GetLogStatisticsAsync();
        void AddLog(string level, string message, string? exception = null);
        // EXTENSION: Nouvelles méthodes pour Event Viewer
        void AddLog(string level, string message, string? exception = null, HttpLogDetails? httpDetails = null, string source = "API");
        void SetBufferSize(int size);
        int GetBufferSize();
        event EventHandler<LogEntry>? OnLogAdded;
    }

    public class LogReaderService : ILogReaderService
    {
        private readonly ILogger<LogReaderService> _logger;
        private readonly ConcurrentQueue<LogEntry> _inMemoryLogs = new();
        private int _maxLogSize = 10000; // EXTENSION: Augmenté par défaut pour Event Viewer (min 5000, défaut 10000)
        private readonly object _bufferLock = new object();
        
        // EXTENSION: Événement pour les abonnés temps réel
        public event EventHandler<LogEntry>? OnLogAdded;

        public LogReaderService(ILogger<LogReaderService> logger)
        {
            _logger = logger;
            
            // Ajouter quelques logs d'exemple pour le démarrage
            AddLog("Information", "Service de logs initialisé", null, null, "System");
            AddLog("Information", "Interface d'administration démarrée", null, null, "System");
        }
        
        // EXTENSION: Setter pour la taille du buffer
        public void SetBufferSize(int size)
        {
            lock (_bufferLock)
            {
                if (size < 5000) size = 5000; // Minimum 5000
                _maxLogSize = size;
                
                // Nettoyer l'excès si nécessaire
                while (_inMemoryLogs.Count > _maxLogSize)
                {
                    _inMemoryLogs.TryDequeue(out _);
                }
            }
        }
        
        // EXTENSION: Getter pour la taille du buffer
        public int GetBufferSize()
        {
            return _maxLogSize;
        }

        public async Task<List<LogEntry>> GetRecentLogsAsync(int count = 100, string? level = null)
        {
            return await Task.Run(() =>
            {
                var logs = _inMemoryLogs.ToList();
                
                if (!string.IsNullOrEmpty(level))
                {
                    logs = logs.Where(l => l.Level.Equals(level, StringComparison.OrdinalIgnoreCase)).ToList();
                }
                
                return logs
                    .OrderByDescending(l => l.Timestamp)
                    .Take(count)
                    .ToList();
            });
        }

        public async Task<List<LogEntry>> SearchLogsAsync(string searchTerm, int maxResults = 100)
        {
            return await Task.Run(() =>
            {
                return _inMemoryLogs
                    .Where(l => l.Message.Contains(searchTerm, StringComparison.OrdinalIgnoreCase) ||
                               (l.Exception?.Contains(searchTerm, StringComparison.OrdinalIgnoreCase) ?? false))
                    .OrderByDescending(l => l.Timestamp)
                    .Take(maxResults)
                    .ToList();
            });
        }

        public async Task<LogStatistics> GetLogStatisticsAsync()
        {
            return await Task.Run(() =>
            {
                var logs = _inMemoryLogs.ToList();
                
                return new LogStatistics
                {
                    TotalLogs = logs.Count,
                    InfoCount = logs.Count(l => l.Level == "Information"),
                    WarningCount = logs.Count(l => l.Level == "Warning"),
                    ErrorCount = logs.Count(l => l.Level == "Error"),
                    CriticalCount = logs.Count(l => l.Level == "Critical"),
                    LastErrorTime = logs.Where(l => l.Level == "Error")
                                        .OrderByDescending(l => l.Timestamp)
                                        .FirstOrDefault()?.Timestamp,
                    CollectedAt = DateTime.Now
                };
            });
        }

        // EXTENSION: Méthode originale maintenue pour compatibilité
        public void AddLog(string level, string message, string? exception = null)
        {
            AddLog(level, message, exception, null, "API");
        }
        
        // EXTENSION: Nouvelle surcharge avec détails HTTP et source
        public void AddLog(string level, string message, string? exception = null, HttpLogDetails? httpDetails = null, string source = "API")
        {
            var entry = new LogEntry
            {
                Id = Guid.NewGuid().ToString(),
                Timestamp = DateTime.Now,
                Level = level,
                Message = SanitizeMessage(message),
                Exception = exception != null ? SanitizeMessage(exception) : null,
                Source = source,
                HttpDetails = httpDetails
            };

            lock (_bufferLock)
            {
                _inMemoryLogs.Enqueue(entry);

                // Garder seulement les derniers logs en mémoire
                while (_inMemoryLogs.Count > _maxLogSize)
                {
                    _inMemoryLogs.TryDequeue(out _);
                }
            }
            
            // EXTENSION: Déclencher l'événement pour les abonnés temps réel
            OnLogAdded?.Invoke(this, entry);
        }
        
        // EXTENSION: Sanitization des secrets et tokens
        private string SanitizeMessage(string message)
        {
            if (string.IsNullOrEmpty(message)) return message;
            
            // Masquer les patterns sensibles
            var patterns = new Dictionary<string, string>
            {
                { @"(token[""':\s]+)([^""'\s,}\]]+)", "$1****" },
                { @"(password[""':\s]+)([^""'\s,}\]]+)", "$1****" },
                { @"(bearer\s+)([^\s,}\]]+)", "$1****" },
                { @"(api[-_]?key[""':\s]+)([^""'\s,}\]]+)", "$1****" },
                { @"(secret[""':\s]+)([^""'\s,}\]]+)", "$1****" },
                { @"(authorization[""':\s]+)([^""'\s,}\]]+)", "$1****" }
            };
            
            foreach (var pattern in patterns)
            {
                message = Regex.Replace(message, pattern.Key, pattern.Value, RegexOptions.IgnoreCase);
            }
            
            return message;
        }
    }

    // EXTENSION: Détails HTTP enrichis pour Event Viewer
    public class HttpLogDetails
    {
        public string? Method { get; set; }
        public string? Url { get; set; }
        public int? StatusCode { get; set; }
        public long? DurationMs { get; set; }
        public long? RequestSize { get; set; }
        public long? ResponseSize { get; set; }
        public string? Endpoint { get; set; }
        public Dictionary<string, string>? Headers { get; set; }
        public object? RequestBody { get; set; }
        public object? ResponseBody { get; set; }
    }

    public class LogEntry
    {
        public string Id { get; set; } = string.Empty;
        public DateTime Timestamp { get; set; }
        public string Level { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public string? Exception { get; set; }
        public string Source { get; set; } = "API"; // EXTENSION: Source (API, Worker, UI, PLC, DB, System)
        public HttpLogDetails? HttpDetails { get; set; } // EXTENSION: Détails HTTP
    }

    public class LogStatistics
    {
        public int TotalLogs { get; set; }
        public int InfoCount { get; set; }
        public int WarningCount { get; set; }
        public int ErrorCount { get; set; }
        public int CriticalCount { get; set; }
        public DateTime? LastErrorTime { get; set; }
        public DateTime CollectedAt { get; set; }
    }
}

