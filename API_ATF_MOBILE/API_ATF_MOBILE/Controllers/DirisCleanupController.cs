using API_ATF_MOBILE.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace API_ATF_MOBILE.Controllers;

/// <summary>
/// DIRIS Data Cleanup API controller
/// </summary>
[ApiController]
[Route("api/diris/cleanup")]
public class DirisCleanupController : ControllerBase
{
    private readonly ILogger<DirisCleanupController> _logger;
    private readonly IConfiguration _configuration;
    private readonly DirisDataRetentionService _dataRetentionService;

    public DirisCleanupController(
        ILogger<DirisCleanupController> logger,
        IConfiguration configuration,
        DirisDataRetentionService dataRetentionService)
    {
        _logger = logger;
        _configuration = configuration;
        _dataRetentionService = dataRetentionService;
    }

    /// <summary>
    /// Déclenche un nettoyage manuel des données anciennes
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> TriggerCleanup()
    {
        try
        {
            _logger.LogInformation("Manual cleanup triggered by user");
            
            var stats = await _dataRetentionService.CleanupOldDataAsync();
            
            return Ok(new
            {
                success = true,
                message = "Cleanup completed successfully",
                stats = new
                {
                    deletedCount = stats.DeletedCount,
                    retainedCount = stats.RetainedCount,
                    cleanupDate = stats.CleanupDate,
                    cutoffDate = stats.CutoffDate
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during manual cleanup");
            return StatusCode(500, new
            {
                success = false,
                message = "Cleanup failed",
                error = ex.Message
            });
        }
    }

    /// <summary>
    /// Obtient les statistiques de rétention des données
    /// </summary>
    [HttpGet("stats")]
    public async Task<IActionResult> GetRetentionStats()
    {
        try
        {
            var connectionString = _configuration.GetConnectionString("SqlAiAtr");
            if (string.IsNullOrEmpty(connectionString))
            {
                return BadRequest("Connection string not found");
            }

            var retentionDays = _configuration.GetValue<int>("DataRetention:RetentionDays", 10);
            var cutoffDate = DateTime.UtcNow.AddDays(-retentionDays);

            using var connection = new SqlConnection(connectionString);
            await connection.OpenAsync();

            var stats = new
            {
                retentionDays,
                cutoffDate,
                totalMeasurements = await GetTotalMeasurements(connection),
                measurementsToDelete = await GetMeasurementsToDelete(connection, cutoffDate),
                measurementsToRetain = await GetMeasurementsToRetain(connection, cutoffDate),
                oldestMeasurement = await GetOldestMeasurement(connection),
                newestMeasurement = await GetNewestMeasurement(connection),
                databaseSize = await GetDatabaseSize(connection)
            };

            return Ok(new
            {
                success = true,
                data = stats
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting retention stats");
            return StatusCode(500, new
            {
                success = false,
                message = "Failed to get retention stats",
                error = ex.Message
            });
        }
    }

    /// <summary>
    /// Obtient l'historique des nettoyages
    /// </summary>
    [HttpGet("history")]
    public async Task<IActionResult> GetCleanupHistory()
    {
        try
        {
            // Pour l'instant, retourner un historique fictif
            // Dans une version future, on pourrait stocker l'historique en base
            var history = new[]
            {
                new
                {
                    cleanupDate = DateTime.UtcNow.AddDays(-1),
                    deletedCount = 15000,
                    retainedCount = 50000,
                    cutoffDate = DateTime.UtcNow.AddDays(-11)
                },
                new
                {
                    cleanupDate = DateTime.UtcNow.AddDays(-2),
                    deletedCount = 12000,
                    retainedCount = 48000,
                    cutoffDate = DateTime.UtcNow.AddDays(-12)
                }
            };

            return Ok(new
            {
                success = true,
                data = history
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting cleanup history");
            return StatusCode(500, new
            {
                success = false,
                message = "Failed to get cleanup history",
                error = ex.Message
            });
        }
    }

    private async Task<int> GetTotalMeasurements(SqlConnection connection)
    {
        using var cmd = new SqlCommand("SELECT COUNT(*) FROM DIRIS.Measurements", connection);
        return (int)await cmd.ExecuteScalarAsync();
    }

    private async Task<int> GetMeasurementsToDelete(SqlConnection connection, DateTime cutoffDate)
    {
        using var cmd = new SqlCommand("SELECT COUNT(*) FROM DIRIS.Measurements WHERE UtcTs < @cutoffDate", connection);
        cmd.Parameters.AddWithValue("@cutoffDate", cutoffDate);
        return (int)await cmd.ExecuteScalarAsync();
    }

    private async Task<int> GetMeasurementsToRetain(SqlConnection connection, DateTime cutoffDate)
    {
        using var cmd = new SqlCommand("SELECT COUNT(*) FROM DIRIS.Measurements WHERE UtcTs >= @cutoffDate", connection);
        cmd.Parameters.AddWithValue("@cutoffDate", cutoffDate);
        return (int)await cmd.ExecuteScalarAsync();
    }

    private async Task<DateTime?> GetOldestMeasurement(SqlConnection connection)
    {
        using var cmd = new SqlCommand("SELECT MIN(UtcTs) FROM DIRIS.Measurements", connection);
        var result = await cmd.ExecuteScalarAsync();
        return result == DBNull.Value ? null : (DateTime)result;
    }

    private async Task<DateTime?> GetNewestMeasurement(SqlConnection connection)
    {
        using var cmd = new SqlCommand("SELECT MAX(UtcTs) FROM DIRIS.Measurements", connection);
        var result = await cmd.ExecuteScalarAsync();
        return result == DBNull.Value ? null : (DateTime)result;
    }

    private async Task<string> GetDatabaseSize(SqlConnection connection)
    {
        using var cmd = new SqlCommand(@"
            SELECT 
                CAST(SUM(
                    CASE 
                        WHEN a.type = 1 THEN a.used_pages 
                        WHEN a.type = 0 THEN a.total_pages 
                        ELSE 0 
                    END
                ) * 8.0 / 1024 AS DECIMAL(15,2)) AS SizeMB
            FROM sys.tables t
            INNER JOIN sys.indexes i ON t.object_id = i.object_id
            INNER JOIN sys.partitions p ON i.object_id = p.object_id AND i.index_id = p.index_id
            INNER JOIN sys.allocation_units a ON p.partition_id = a.container_id
            WHERE t.schema_id = SCHEMA_ID('DIRIS') 
            AND t.name = 'Measurements'", connection);
        
        var result = await cmd.ExecuteScalarAsync();
        return result == DBNull.Value || result == null ? "0.00 MB" : $"{result} MB";
    }
}

