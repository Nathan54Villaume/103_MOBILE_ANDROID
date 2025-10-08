using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using System.Data;

namespace API_ATF_MOBILE.Controllers;

/// <summary>
/// Contrôleur pour les statistiques de cohérence DIRIS
/// </summary>
[ApiController]
[Route("api/diris/coherence")]
public class DirisCoherenceController : ControllerBase
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<DirisCoherenceController> _logger;

    public DirisCoherenceController(
        IConfiguration configuration,
        ILogger<DirisCoherenceController> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    /// <summary>
    /// Obtient les statistiques de cohérence complètes
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetCoherenceStats()
    {
        try
        {
            var connectionString = _configuration.GetConnectionString("SqlAiAtr");
            
            // Charger chaque stat avec sa propre connexion
            var general = await GetGeneralStatsWithConnection(connectionString);
            var frequency = await GetFrequencyStatsWithConnection(connectionString);
            var quality = await GetQualityStatsWithConnection(connectionString);
            var gaps = await GetGapsWithConnection(connectionString);
            var deviceStats = await GetDeviceStatsWithConnection(connectionString);

            var result = new
            {
                general = general,
                frequency = frequency,
                quality = quality,
                gaps = gaps,
                deviceStats = deviceStats
            };

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erreur lors de la récupération des statistiques de cohérence");
            return StatusCode(500, new { error = ex.Message, stackTrace = ex.StackTrace });
        }
    }

    private async Task<object> GetGeneralStatsWithConnection(string connectionString)
    {
        using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync();
        return await GetGeneralStats(connection);
    }

    private async Task<IEnumerable<object>> GetFrequencyStatsWithConnection(string connectionString)
    {
        using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync();
        return await GetFrequencyStats(connection);
    }

    private async Task<object> GetQualityStatsWithConnection(string connectionString)
    {
        using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync();
        return await GetQualityStats(connection);
    }

    private async Task<IEnumerable<object>> GetGapsWithConnection(string connectionString)
    {
        using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync();
        return await GetGaps(connection);
    }

    private async Task<IEnumerable<object>> GetDeviceStatsWithConnection(string connectionString)
    {
        using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync();
        return await GetDeviceStats(connection);
    }

    private async Task<object> GetGeneralStats(SqlConnection connection)
    {
        const string sql = @"
            SELECT 
                COUNT(*) as TotalMeasures,
                COUNT(DISTINCT DeviceId) as NbDevices,
                COUNT(DISTINCT Signal) as NbSignals,
                MIN(UtcTs) as FirstMeasure,
                MAX(UtcTs) as LastMeasure,
                DATEDIFF(SECOND, MAX(UtcTs), GETUTCDATE()) as SecondsSinceLast
            FROM [DIRIS].[Measurements]
            WHERE UtcTs > DATEADD(HOUR, -1, GETUTCDATE())";

        using var command = new SqlCommand(sql, connection);
        using var reader = await command.ExecuteReaderAsync();
        
        if (await reader.ReadAsync())
        {
            return new
            {
                totalMeasures = reader.GetInt32(0),
                nbDevices = reader.GetInt32(1),
                nbSignals = reader.GetInt32(2),
                firstMeasure = reader.IsDBNull(3) ? (DateTime?)null : reader.GetDateTime(3),
                lastMeasure = reader.IsDBNull(4) ? (DateTime?)null : reader.GetDateTime(4),
                secondsSinceLast = reader.IsDBNull(5) ? 0 : reader.GetInt32(5)
            };
        }
        
        return new { totalMeasures = 0, nbDevices = 0, nbSignals = 0 };
    }

    private async Task<IEnumerable<object>> GetFrequencyStats(SqlConnection connection)
    {
        const string sql = @"
            WITH Intervals AS (
                SELECT 
                    DeviceId,
                    UtcTs,
                    LAG(UtcTs) OVER (PARTITION BY DeviceId ORDER BY UtcTs) as PrevTs,
                    DATEDIFF(MILLISECOND, LAG(UtcTs) OVER (PARTITION BY DeviceId ORDER BY UtcTs), UtcTs) as IntervalMs
                FROM [DIRIS].[Measurements]
                WHERE UtcTs > DATEADD(MINUTE, -10, GETUTCDATE())
            )
            SELECT 
                DeviceId,
                COUNT(*) as NbMeasures,
                AVG(IntervalMs) as AvgMs,
                MIN(IntervalMs) as MinMs,
                MAX(IntervalMs) as MaxMs,
                STDEV(IntervalMs) as StdDevMs
            FROM Intervals
            WHERE IntervalMs IS NOT NULL
            GROUP BY DeviceId
            ORDER BY DeviceId";

        var results = new List<object>();
        using var command = new SqlCommand(sql, connection);
        using var reader = await command.ExecuteReaderAsync();
        
        while (await reader.ReadAsync())
        {
            results.Add(new
            {
                deviceId = reader.GetInt32(0),
                nbMeasures = reader.GetInt32(1),
                avgMs = reader.IsDBNull(2) ? 0 : reader.GetInt32(2),
                minMs = reader.IsDBNull(3) ? 0 : reader.GetInt32(3),
                maxMs = reader.IsDBNull(4) ? 0 : reader.GetInt32(4),
                stdDevMs = reader.IsDBNull(5) ? 0.0 : reader.GetDouble(5)
            });
        }
        
        return results;
    }

    private async Task<object> GetQualityStats(SqlConnection connection)
    {
        const string sql = @"
            SELECT 
                Quality,
                COUNT(*) as NbMeasures,
                CAST(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM [DIRIS].[Measurements] WHERE UtcTs > DATEADD(HOUR, -1, GETUTCDATE())) as DECIMAL(5,2)) as PercentTotal
            FROM [DIRIS].[Measurements]
            WHERE UtcTs > DATEADD(HOUR, -1, GETUTCDATE())
            GROUP BY Quality
            ORDER BY Quality";

        var results = new List<object>();
        bool perfectQuality = false;
        
        using var command = new SqlCommand(sql, connection);
        using var reader = await command.ExecuteReaderAsync();
        
        while (await reader.ReadAsync())
        {
            byte quality = reader.GetByte(0);
            int nbMeasures = reader.GetInt32(1);
            decimal percentTotal = reader.GetDecimal(2);
            
            results.Add(new
            {
                quality = quality,
                nbMeasures = nbMeasures,
                percentTotal = percentTotal
            });
            
            if (quality == 1 && percentTotal == 100.0m)
            {
                perfectQuality = true;
            }
        }
        
        return new
        {
            qualityBreakdown = results,
            perfectQuality = perfectQuality
        };
    }

    private async Task<IEnumerable<object>> GetGaps(SqlConnection connection)
    {
        const string sql = @"
            WITH Gaps AS (
                SELECT 
                    DeviceId,
                    UtcTs,
                    LAG(UtcTs) OVER (PARTITION BY DeviceId ORDER BY UtcTs) as PrevTs,
                    DATEDIFF(SECOND, LAG(UtcTs) OVER (PARTITION BY DeviceId ORDER BY UtcTs), UtcTs) as GapSeconds
                FROM [DIRIS].[Measurements]
                WHERE UtcTs > DATEADD(MINUTE, -30, GETUTCDATE())
            )
            SELECT TOP 10
                g.DeviceId,
                d.Name as DeviceName,
                g.PrevTs,
                g.UtcTs,
                g.GapSeconds
            FROM Gaps g
            LEFT JOIN [DIRIS].[Devices] d ON g.DeviceId = d.DeviceId
            WHERE g.GapSeconds > 5
            ORDER BY g.GapSeconds DESC";

        var results = new List<object>();
        using var command = new SqlCommand(sql, connection);
        using var reader = await command.ExecuteReaderAsync();
        
        while (await reader.ReadAsync())
        {
            results.Add(new
            {
                deviceId = reader.GetInt32(0),
                deviceName = reader.IsDBNull(1) ? $"Device {reader.GetInt32(0)}" : reader.GetString(1),
                prevTs = reader.IsDBNull(2) ? (DateTime?)null : reader.GetDateTime(2),
                utcTs = reader.GetDateTime(3),
                gapSeconds = reader.GetInt32(4)
            });
        }
        
        return results;
    }

    private async Task<IEnumerable<object>> GetDeviceStats(SqlConnection connection)
    {
        const string sql = @"
            SELECT 
                m.DeviceId,
                d.Name as DeviceName,
                COUNT(*) as NbMeasures,
                COUNT(DISTINCT m.Signal) as NbSignals,
                MIN(m.UtcTs) as FirstMeasure,
                MAX(m.UtcTs) as LastMeasure,
                DATEDIFF(SECOND, MIN(m.UtcTs), MAX(m.UtcTs)) as DurationSeconds,
                CAST(COUNT(*) * 1.0 / NULLIF(DATEDIFF(SECOND, MIN(m.UtcTs), MAX(m.UtcTs)), 0) as DECIMAL(10,2)) as MeasuresPerSecond
            FROM [DIRIS].[Measurements] m
            LEFT JOIN [DIRIS].[Devices] d ON m.DeviceId = d.DeviceId
            WHERE m.UtcTs > DATEADD(MINUTE, -30, GETUTCDATE())
            GROUP BY m.DeviceId, d.Name
            ORDER BY m.DeviceId";

        var results = new List<object>();
        using var command = new SqlCommand(sql, connection);
        using var reader = await command.ExecuteReaderAsync();
        
        while (await reader.ReadAsync())
        {
            results.Add(new
            {
                deviceId = reader.GetInt32(0),
                deviceName = reader.IsDBNull(1) ? $"Device {reader.GetInt32(0)}" : reader.GetString(1),
                nbMeasures = reader.GetInt32(2),
                nbSignals = reader.GetInt32(3),
                firstMeasure = reader.IsDBNull(4) ? (DateTime?)null : reader.GetDateTime(4),
                lastMeasure = reader.IsDBNull(5) ? (DateTime?)null : reader.GetDateTime(5),
                durationSeconds = reader.IsDBNull(6) ? 0 : reader.GetInt32(6),
                measuresPerSecond = reader.IsDBNull(7) ? 0.0m : reader.GetDecimal(7)
            });
        }
        
        return results;
    }

    /// <summary>
    /// Calcule un score de cohérence global
    /// </summary>
    [HttpGet("score")]
    public async Task<IActionResult> GetCoherenceScore()
    {
        try
        {
            var connectionString = _configuration.GetConnectionString("SqlAiAtr");
            using var connection = new SqlConnection(connectionString);
            await connection.OpenAsync();

            var quality = await GetQualityStats(connection);
            var frequency = await GetFrequencyStats(connection);
            var gaps = await GetGaps(connection);

            var qualityData = (dynamic)quality;
            int score = 0;

            // Qualité parfaite = 40 points
            if (qualityData.perfectQuality)
            {
                score += 40;
            }

            // Régularité de la fréquence = 30 points
            var freqList = frequency.ToList();
            if (freqList.Any())
            {
                var avgStdDev = freqList.Average(f => (double?)((dynamic)f).StdDevMs ?? 0);
                if (avgStdDev < 100)
                    score += 30;
                else if (avgStdDev < 200)
                    score += 20;
                else if (avgStdDev < 500)
                    score += 10;
            }

            // Absence de trous significatifs = 30 points
            var gapList = gaps.ToList();
            if (!gapList.Any())
                score += 30;
            else if (gapList.Count() <= 2)
                score += 20;
            else if (gapList.Count() <= 5)
                score += 10;

            return Ok(new
            {
                score = score,
                rating = score >= 90 ? "Excellent" : score >= 75 ? "Bon" : score >= 50 ? "Moyen" : "Faible",
                details = new
                {
                    qualityScore = qualityData.perfectQuality ? 40 : 0,
                    regularityScore = score >= 70 ? 30 : score >= 50 ? 20 : 10,
                    gapsScore = !gapList.Any() ? 30 : gapList.Count() <= 2 ? 20 : 10
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erreur lors du calcul du score de cohérence");
            return StatusCode(500, new { error = ex.Message });
        }
    }
}
