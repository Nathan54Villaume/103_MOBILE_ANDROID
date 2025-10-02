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
    }

    public class LogReaderService : ILogReaderService
    {
        private readonly ILogger<LogReaderService> _logger;
        private readonly ConcurrentQueue<LogEntry> _inMemoryLogs = new();
        private readonly int _maxLogSize = 500; // OPTIMISATION : Réduire de 1000 à 500

        public LogReaderService(ILogger<LogReaderService> logger)
        {
            _logger = logger;
            
            // Ajouter quelques logs d'exemple pour le démarrage
            AddLog("Information", "Service de logs initialisé");
            AddLog("Information", "Interface d'administration démarrée");
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

        public void AddLog(string level, string message, string? exception = null)
        {
            var entry = new LogEntry
            {
                Timestamp = DateTime.Now,
                Level = level,
                Message = message,
                Exception = exception
            };

            _inMemoryLogs.Enqueue(entry);

            // Garder seulement les derniers logs en mémoire
            while (_inMemoryLogs.Count > _maxLogSize)
            {
                _inMemoryLogs.TryDequeue(out _);
            }
        }
    }

    public class LogEntry
    {
        public DateTime Timestamp { get; set; }
        public string Level { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public string? Exception { get; set; }
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

