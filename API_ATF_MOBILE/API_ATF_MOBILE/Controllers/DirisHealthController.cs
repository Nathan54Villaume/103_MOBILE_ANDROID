using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace API_ATF_MOBILE.Controllers;

/// <summary>
/// Contrôleur pour les health checks et diagnostics DIRIS
/// </summary>
[ApiController]
[Route("api/diris/health")]
public class DirisHealthController : ControllerBase
{
    private readonly ILogger<DirisHealthController> _logger;
    private readonly IConfiguration _configuration;
    private readonly Services.DirisAcquisitionControlService _controlService;

    public DirisHealthController(
        ILogger<DirisHealthController> logger,
        IConfiguration configuration,
        Services.DirisAcquisitionControlService controlService)
    {
        _logger = logger;
        _configuration = configuration;
        _controlService = controlService;
    }

    /// <summary>
    /// Health check complet du système DIRIS
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetHealth()
    {
        try
        {
            dynamic acquisition = await CheckAcquisitionHealthAsync();
            dynamic database = await CheckDatabaseHealthAsync();
            dynamic storage = CheckStorageHealth();

            // Calculer le statut global
            var allHealthy = 
                acquisition.status == "healthy" &&
                database.status == "healthy" &&
                storage.status == "healthy";

            var anyUnhealthy = 
                acquisition.status == "unhealthy" ||
                database.status == "unhealthy" ||
                storage.status == "unhealthy";

            var overallStatus = allHealthy ? "healthy" : (anyUnhealthy ? "unhealthy" : "degraded");

            return Ok(new
            {
                timestamp = DateTime.UtcNow,
                acquisition = acquisition,
                database = database,
                storage = storage,
                overall = overallStatus
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error performing health check");
            return StatusCode(500, new
            {
                success = false,
                message = "Error performing health check",
                error = ex.Message
            });
        }
    }

    private async Task<object> CheckAcquisitionHealthAsync()
    {
        try
        {
            var isRunning = _controlService.IsRunning;
            
            if (!isRunning)
            {
                return new
                {
                    status = "stopped",
                    message = "Acquisition is stopped by user",
                    details = "Acquisition can be started from the admin interface"
                };
            }

            // Vérifier s'il y a eu des données récentes
            var connectionString = _configuration.GetConnectionString("SqlAiAtr");
            if (string.IsNullOrEmpty(connectionString))
            {
                return new
                {
                    status = "degraded",
                    message = "Cannot verify recent data",
                    details = "Connection string not found"
                };
            }

            using var connection = new SqlConnection(connectionString);
            await connection.OpenAsync();

            var query = @"
                SELECT TOP 1 
                    IngestTs,
                    DATEDIFF(SECOND, IngestTs, GETUTCDATE()) as SecondsSinceLastData
                FROM [DIRIS].[Measurements]
                ORDER BY IngestTs DESC";

            using var command = new SqlCommand(query, connection);
            command.CommandTimeout = 5;

            using var reader = await command.ExecuteReaderAsync();

            if (await reader.ReadAsync())
            {
                var secondsSinceLastData = reader.GetInt32(1);

                if (secondsSinceLastData < 10)
                {
                    return new
                    {
                        status = "healthy",
                        message = "Acquisition is active and collecting data",
                        lastDataSeconds = secondsSinceLastData
                    };
                }
                else if (secondsSinceLastData < 300)
                {
                    return new
                    {
                        status = "degraded",
                        message = $"No data for {secondsSinceLastData} seconds",
                        lastDataSeconds = secondsSinceLastData
                    };
                }
                else
                {
                    return new
                    {
                        status = "unhealthy",
                        message = $"No data for {secondsSinceLastData / 60} minutes",
                        lastDataSeconds = secondsSinceLastData,
                        recommendation = "Restart the API service"
                    };
                }
            }
            else
            {
                return new
                {
                    status = "degraded",
                    message = "No data found in database",
                    details = "The database may be empty or acquisition has never run"
                };
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking acquisition health");
            return new
            {
                status = "unhealthy",
                message = "Error checking acquisition health",
                error = ex.Message
            };
        }
    }

    private async Task<object> CheckDatabaseHealthAsync()
    {
        try
        {
            var connectionString = _configuration.GetConnectionString("SqlAiAtr");
            if (string.IsNullOrEmpty(connectionString))
            {
                return new
                {
                    status = "unhealthy",
                    message = "Connection string not found"
                };
            }

            using var connection = new SqlConnection(connectionString);
            var sw = System.Diagnostics.Stopwatch.StartNew();
            await connection.OpenAsync();
            sw.Stop();

            var query = "SELECT COUNT(*) FROM [DIRIS].[Measurements]";
            using var command = new SqlCommand(query, connection);
            command.CommandTimeout = 5;
            var count = (int)await command.ExecuteScalarAsync();

            return new
            {
                status = "healthy",
                message = "Database is accessible",
                connectionTimeMs = sw.ElapsedMilliseconds,
                totalMeasurements = count
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking database health");
            return new
            {
                status = "unhealthy",
                message = "Cannot connect to database",
                error = ex.Message
            };
        }
    }

    private object CheckStorageHealth()
    {
        try
        {
            var logsPath = Path.Combine(Directory.GetCurrentDirectory(), "logs");
            
            if (!Directory.Exists(logsPath))
            {
                return new
                {
                    status = "degraded",
                    message = "Logs directory not found"
                };
            }

            var drive = new DriveInfo(Path.GetPathRoot(logsPath) ?? "C:\\");
            var freeSpaceGB = drive.AvailableFreeSpace / 1024.0 / 1024.0 / 1024.0;

            if (freeSpaceGB < 1)
            {
                return new
                {
                    status = "unhealthy",
                    message = "Very low disk space",
                    freeSpaceGB = Math.Round(freeSpaceGB, 2)
                };
            }
            else if (freeSpaceGB < 5)
            {
                return new
                {
                    status = "degraded",
                    message = "Low disk space",
                    freeSpaceGB = Math.Round(freeSpaceGB, 2)
                };
            }
            else
            {
                return new
                {
                    status = "healthy",
                    message = "Sufficient disk space",
                    freeSpaceGB = Math.Round(freeSpaceGB, 2)
                };
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking storage health");
            return new
            {
                status = "degraded",
                message = "Cannot check storage health",
                error = ex.Message
            };
        }
    }

    /// <summary>
    /// Diagnostic détaillé pour le debug
    /// </summary>
    [HttpGet("diagnostic")]
    public async Task<IActionResult> GetDiagnostic()
    {
        try
        {
            var diagnostic = new
            {
                timestamp = DateTime.UtcNow,
                server = GetServerInfo(),
                acquisition = _controlService.GetStatus(),
                database = await GetDatabaseDiagnosticAsync(),
                recentErrors = await GetRecentErrorsAsync()
            };

            return Ok(diagnostic);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error performing diagnostic");
            return StatusCode(500, new
            {
                success = false,
                message = "Error performing diagnostic",
                error = ex.Message
            });
        }
    }

    private object GetServerInfo()
    {
        return new
        {
            machineName = Environment.MachineName,
            osVersion = Environment.OSVersion.ToString(),
            processorCount = Environment.ProcessorCount,
            dotnetVersion = Environment.Version.ToString(),
            is64Bit = Environment.Is64BitOperatingSystem,
            workingSetMB = Math.Round(Environment.WorkingSet / 1024.0 / 1024.0, 2),
            uptime = DateTime.UtcNow - System.Diagnostics.Process.GetCurrentProcess().StartTime.ToUniversalTime()
        };
    }

    private async Task<object> GetDatabaseDiagnosticAsync()
    {
        try
        {
            var connectionString = _configuration.GetConnectionString("SqlAiAtr");
            if (string.IsNullOrEmpty(connectionString))
            {
                return new { error = "Connection string not found" };
            }

            using var connection = new SqlConnection(connectionString);
            await connection.OpenAsync();

            var query = @"
                SELECT 
                    COUNT(*) as TotalMeasurements,
                    COUNT(DISTINCT DeviceId) as DeviceCount,
                    MIN(UtcTs) as FirstMeasurement,
                    MAX(UtcTs) as LastMeasurement,
                    MAX(IngestTs) as LastIngest,
                    DATEDIFF(SECOND, MAX(IngestTs), GETUTCDATE()) as SecondsSinceLastIngest
                FROM [DIRIS].[Measurements]";

            using var command = new SqlCommand(query, connection);
            command.CommandTimeout = 10;

            using var reader = await command.ExecuteReaderAsync();

            if (await reader.ReadAsync())
            {
                return new
                {
                    totalMeasurements = reader.GetInt32(0),
                    deviceCount = reader.GetInt32(1),
                    firstMeasurement = reader.IsDBNull(2) ? (DateTime?)null : reader.GetDateTime(2),
                    lastMeasurement = reader.IsDBNull(3) ? (DateTime?)null : reader.GetDateTime(3),
                    lastIngest = reader.IsDBNull(4) ? (DateTime?)null : reader.GetDateTime(4),
                    secondsSinceLastIngest = reader.IsDBNull(5) ? (int?)null : reader.GetInt32(5)
                };
            }

            return new { error = "No data" };
        }
        catch (Exception ex)
        {
            return new { error = ex.Message };
        }
    }

    private async Task<List<string>> GetRecentErrorsAsync()
    {
        try
        {
            var logsPath = Path.Combine(Directory.GetCurrentDirectory(), "logs");
            
            if (!Directory.Exists(logsPath))
            {
                return new List<string> { "Logs directory not found" };
            }

            var logFiles = Directory.GetFiles(logsPath, "app-*.log")
                .OrderByDescending(f => new FileInfo(f).LastWriteTime)
                .Take(1)
                .ToList();

            if (!logFiles.Any())
            {
                return new List<string> { "No log files found" };
            }

            var latestLogFile = logFiles.First();
            var errors = new List<string>();

            using var fileStream = new FileStream(latestLogFile, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
            using var reader = new StreamReader(fileStream);
            
            var allLines = new List<string>();
            string? line;
            while ((line = await reader.ReadLineAsync()) != null)
            {
                if (line.Contains("[ERR]") || line.Contains("[CRT]") || line.Contains("!!!"))
                {
                    allLines.Add(line);
                }
            }
            
            errors = allLines.Skip(Math.Max(0, allLines.Count - 10)).ToList();
            
            return errors;
        }
        catch (Exception ex)
        {
            return new List<string> { $"Error reading logs: {ex.Message}" };
        }
    }
}

