using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using API_ATF_MOBILE.Data;

namespace API_ATF_MOBILE.Services
{
    public interface IDatabaseHealthService
    {
        Task<DatabaseHealth> CheckDatabaseHealthAsync(string connectionName);
        Task<List<DatabaseHealth>> CheckAllDatabasesAsync();
        Task<DatabaseStatistics> GetDatabaseStatisticsAsync(string connectionName);
    }

    public class DatabaseHealthService : IDatabaseHealthService
    {
        private readonly IConfiguration _configuration;
        private readonly ApplicationDbContext _context;
        private readonly ILogger<DatabaseHealthService> _logger;

        public DatabaseHealthService(
            IConfiguration configuration,
            ApplicationDbContext context,
            ILogger<DatabaseHealthService> logger)
        {
            _configuration = configuration;
            _context = context;
            _logger = logger;
        }

        public async Task<List<DatabaseHealth>> CheckAllDatabasesAsync()
        {
            var results = new List<DatabaseHealth>();
            
            // Vérifier toutes les connexions définies
            var connectionStrings = _configuration.GetSection("ConnectionStrings")
                .GetChildren()
                .Select(x => x.Key)
                .ToList();

            foreach (var connName in connectionStrings)
            {
                results.Add(await CheckDatabaseHealthAsync(connName));
            }

            return results;
        }

        public async Task<DatabaseHealth> CheckDatabaseHealthAsync(string connectionName)
        {
            var health = new DatabaseHealth
            {
                ConnectionName = connectionName,
                CheckTime = DateTime.Now
            };

            try
            {
                var connectionString = _configuration.GetConnectionString(connectionName);
                if (string.IsNullOrEmpty(connectionString))
                {
                    health.IsConnected = false;
                    health.ErrorMessage = "Chaîne de connexion introuvable";
                    return health;
                }

                health.ConnectionString = MaskConnectionString(connectionString);

                using var connection = new SqlConnection(connectionString);
                var stopwatch = System.Diagnostics.Stopwatch.StartNew();
                
                await connection.OpenAsync();
                stopwatch.Stop();

                health.IsConnected = true;
                health.ResponseTimeMs = stopwatch.ElapsedMilliseconds;
                health.DatabaseName = connection.Database;
                health.ServerName = connection.DataSource;

                // Obtenir la version SQL Server
                using var command = connection.CreateCommand();
                command.CommandText = "SELECT @@VERSION";
                var version = await command.ExecuteScalarAsync();
                health.ServerVersion = version?.ToString() ?? "Unknown";

                await connection.CloseAsync();
            }
            catch (Exception ex)
            {
                health.IsConnected = false;
                health.ErrorMessage = ex.Message;
                _logger.LogError(ex, "Erreur lors de la vérification de la base de données {ConnectionName}", connectionName);
            }

            return health;
        }

        public async Task<DatabaseStatistics> GetDatabaseStatisticsAsync(string connectionName)
        {
            var stats = new DatabaseStatistics
            {
                ConnectionName = connectionName,
                CollectedAt = DateTime.Now
            };

            try
            {
                var connectionString = _configuration.GetConnectionString(connectionName);
                if (string.IsNullOrEmpty(connectionString))
                {
                    return stats;
                }

                using var connection = new SqlConnection(connectionString);
                await connection.OpenAsync();

                // Nombre de tables
                using (var command = connection.CreateCommand())
                {
                    command.CommandText = "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'";
                    stats.TableCount = Convert.ToInt32(await command.ExecuteScalarAsync());
                }

                // Taille de la base de données
                using (var command = connection.CreateCommand())
                {
                    command.CommandText = @"
                        SELECT 
                            SUM(size) * 8 / 1024.0 AS SizeMB
                        FROM sys.master_files
                        WHERE database_id = DB_ID()";
                    var result = await command.ExecuteScalarAsync();
                    stats.DatabaseSizeMB = result != DBNull.Value ? Convert.ToDouble(result) : 0;
                }

                // Statistiques spécifiques pour AI_ATS
                if (connectionName == "DefaultConnection")
                {
                    stats.RecordCounts = new Dictionary<string, int>();
                    
                    // Compter les enregistrements dans les tables principales
                    var tables = new[] { "Etapes", "EtapeRoleStates" };
                    foreach (var table in tables)
                    {
                        try
                        {
                            using var command = connection.CreateCommand();
                            command.CommandText = $"SELECT COUNT(*) FROM [{table}]";
                            var count = Convert.ToInt32(await command.ExecuteScalarAsync());
                            stats.RecordCounts[table] = count;
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "Impossible de compter les enregistrements dans {Table}", table);
                            stats.RecordCounts[table] = -1;
                        }
                    }
                }

                await connection.CloseAsync();
            }
            catch (Exception ex)
            {
                stats.ErrorMessage = ex.Message;
                _logger.LogError(ex, "Erreur lors de la collecte des statistiques pour {ConnectionName}", connectionName);
            }

            return stats;
        }

        private string MaskConnectionString(string connectionString)
        {
            // Masquer le mot de passe
            return System.Text.RegularExpressions.Regex.Replace(
                connectionString,
                @"Password=([^;]*)",
                "Password=****",
                System.Text.RegularExpressions.RegexOptions.IgnoreCase
            );
        }
    }

    public class DatabaseHealth
    {
        public string ConnectionName { get; set; } = string.Empty;
        public bool IsConnected { get; set; }
        public string? ErrorMessage { get; set; }
        public long ResponseTimeMs { get; set; }
        public string? DatabaseName { get; set; }
        public string? ServerName { get; set; }
        public string? ServerVersion { get; set; }
        public string? ConnectionString { get; set; }
        public DateTime CheckTime { get; set; }
    }

    public class DatabaseStatistics
    {
        public string ConnectionName { get; set; } = string.Empty;
        public int TableCount { get; set; }
        public double DatabaseSizeMB { get; set; }
        public Dictionary<string, int> RecordCounts { get; set; } = new();
        public string? ErrorMessage { get; set; }
        public DateTime CollectedAt { get; set; }
    }
}

