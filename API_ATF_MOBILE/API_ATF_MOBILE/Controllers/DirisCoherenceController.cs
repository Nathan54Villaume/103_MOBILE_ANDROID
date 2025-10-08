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
    public async Task<IActionResult> GetCoherenceStats([FromQuery] string? since = null)
    {
        try
        {
            var connectionString = _configuration.GetConnectionString("SqlAiAtr");
            
            // Charger chaque stat avec sa propre connexion et le filtre de date
            var general = await GetGeneralStatsWithConnection(connectionString, since);
            var frequency = await GetFrequencyStatsWithConnection(connectionString, since);
            var quality = await GetQualityStatsWithConnection(connectionString, since);
            var gaps = await GetGapsWithConnection(connectionString, since);
            var deviceStats = await GetDeviceStatsWithConnection(connectionString, since);

            var result = new
            {
                general = general,
                frequency = frequency,
                quality = quality,
                gaps = gaps,
                deviceStats = deviceStats,
                since = since // Inclure l'info pour debug
            };

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erreur lors de la récupération des statistiques de cohérence");
            return StatusCode(500, new { error = ex.Message, stackTrace = ex.StackTrace });
        }
    }

    private async Task<object> GetGeneralStatsWithConnection(string connectionString, string? since = null)
    {
        using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync();
        return await GetGeneralStats(connection, since);
    }

    private async Task<IEnumerable<object>> GetFrequencyStatsWithConnection(string connectionString, string? since = null)
    {
        using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync();
        return await GetFrequencyStats(connection, since);
    }

    private async Task<object> GetQualityStatsWithConnection(string connectionString, string? since = null)
    {
        using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync();
        return await GetQualityStats(connection, since);
    }

    private async Task<IEnumerable<object>> GetGapsWithConnection(string connectionString, string? since = null)
    {
        using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync();
        return await GetGaps(connection, since);
    }

    private async Task<IEnumerable<object>> GetDeviceStatsWithConnection(string connectionString, string? since = null)
    {
        using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync();
        return await GetDeviceStats(connection, since);
    }

    private async Task<object> GetGeneralStats(SqlConnection connection, string? since = null)
    {
        string whereClause = since != null ? "@SinceDate" : "DATEADD(HOUR, -1, GETUTCDATE())";
        string sql = $@"
            SELECT 
                COUNT(*) as TotalMeasures,
                COUNT(DISTINCT DeviceId) as NbDevices,
                COUNT(DISTINCT Signal) as NbSignals,
                MIN(UtcTs) as FirstMeasure,
                MAX(UtcTs) as LastMeasure,
                DATEDIFF(SECOND, MAX(UtcTs), GETUTCDATE()) as SecondsSinceLast
            FROM [DIRIS].[Measurements]
            WHERE UtcTs > {whereClause}";

        using var command = new SqlCommand(sql, connection);
        if (since != null && DateTime.TryParse(since, out var sinceDate))
        {
            command.Parameters.AddWithValue("@SinceDate", sinceDate);
        }
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

    private async Task<IEnumerable<object>> GetFrequencyStats(SqlConnection connection, string? since = null)
    {
        string whereClause = since != null ? "@SinceDate" : "DATEADD(MINUTE, -10, GETUTCDATE())";
        string sql = $@"
            WITH Intervals AS (
                SELECT 
                    DeviceId,
                    UtcTs,
                    LAG(UtcTs) OVER (PARTITION BY DeviceId ORDER BY UtcTs) as PrevTs,
                    DATEDIFF(MILLISECOND, LAG(UtcTs) OVER (PARTITION BY DeviceId ORDER BY UtcTs), UtcTs) as IntervalMs
                FROM [DIRIS].[Measurements]
                WHERE UtcTs > {whereClause}
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
        if (since != null && DateTime.TryParse(since, out var sinceDate))
        {
            command.Parameters.AddWithValue("@SinceDate", sinceDate);
        }
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

    private async Task<object> GetQualityStats(SqlConnection connection, string? since = null)
    {
        string whereClause = since != null ? "@SinceDate" : "DATEADD(HOUR, -1, GETUTCDATE())";
        string sql = $@"
            SELECT 
                Quality,
                COUNT(*) as NbMeasures,
                CAST(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM [DIRIS].[Measurements] WHERE UtcTs > {whereClause}) as DECIMAL(5,2)) as PercentTotal
            FROM [DIRIS].[Measurements]
            WHERE UtcTs > {whereClause}
            GROUP BY Quality
            ORDER BY Quality";

        var results = new List<object>();
        bool perfectQuality = false;
        
        using var command = new SqlCommand(sql, connection);
        if (since != null && DateTime.TryParse(since, out var sinceDate))
        {
            command.Parameters.AddWithValue("@SinceDate", sinceDate);
        }
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

    private async Task<IEnumerable<object>> GetGaps(SqlConnection connection, string? since = null)
    {
        string whereClause = since != null ? "@SinceDate" : "DATEADD(MINUTE, -30, GETUTCDATE())";
        string sql = $@"
            WITH Gaps AS (
                SELECT 
                    DeviceId,
                    UtcTs,
                    LAG(UtcTs) OVER (PARTITION BY DeviceId ORDER BY UtcTs) as PrevTs,
                    DATEDIFF(SECOND, LAG(UtcTs) OVER (PARTITION BY DeviceId ORDER BY UtcTs), UtcTs) as GapSeconds
                FROM [DIRIS].[Measurements]
                WHERE UtcTs > {whereClause}
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
        if (since != null && DateTime.TryParse(since, out var sinceDate))
        {
            command.Parameters.AddWithValue("@SinceDate", sinceDate);
        }
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

    private async Task<IEnumerable<object>> GetDeviceStats(SqlConnection connection, string? since = null)
    {
        string whereClause = since != null ? "@SinceDate" : "DATEADD(MINUTE, -30, GETUTCDATE())";
        string sql = $@"
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
            WHERE m.UtcTs > {whereClause}
            GROUP BY m.DeviceId, d.Name
            ORDER BY m.DeviceId";

        var results = new List<object>();
        using var command = new SqlCommand(sql, connection);
        if (since != null && DateTime.TryParse(since, out var sinceDate))
        {
            command.Parameters.AddWithValue("@SinceDate", sinceDate);
        }
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
    public async Task<IActionResult> GetCoherenceScore([FromQuery] string? since = null)
    {
        try
        {
            var connectionString = _configuration.GetConnectionString("SqlAiAtr");
            
            // Calculer chaque composante du score de manière isolée
            int qualityScore = await CalculateQualityScore(connectionString, since);
            int regularityScore = await CalculateRegularityScore(connectionString, since);
            int gapsScore = await CalculateGapsScore(connectionString, since);
            
            int totalScore = qualityScore + regularityScore + gapsScore;

            return Ok(new
            {
                score = totalScore,
                rating = totalScore >= 90 ? "Excellent" : totalScore >= 75 ? "Bon" : totalScore >= 50 ? "Moyen" : "Faible",
                details = new
                {
                    qualityScore = qualityScore,
                    regularityScore = regularityScore,
                    gapsScore = gapsScore
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erreur lors du calcul du score de cohérence");
            return StatusCode(500, new { error = ex.Message, stackTrace = ex.StackTrace });
        }
    }

    private async Task<int> CalculateQualityScore(string connectionString, string? since = null)
    {
        using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync();
        
        var quality = await GetQualityStats(connection, since);
        var qualityObj = (dynamic)quality;
        
        return qualityObj.perfectQuality ? 40 : 0;
    }

    private async Task<int> CalculateRegularityScore(string connectionString, string? since = null)
    {
        using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync();
        
        // Si on utilise le paramètre 'since', vérifier d'abord s'il y a assez de données
        if (since != null && DateTime.TryParse(since, out var sinceDate))
        {
            // Vérifier le nombre total de mesures depuis 'since'
            var countSql = $@"
                SELECT COUNT(*) 
                FROM [DIRIS].[Measurements] 
                WHERE UtcTs > @SinceDate";
                
            using var countCommand = new SqlCommand(countSql, connection);
            countCommand.Parameters.AddWithValue("@SinceDate", sinceDate);
            var totalMeasures = (int)await countCommand.ExecuteScalarAsync();
            
            // Si moins de 20 mesures, considérer comme score parfait (pas assez de données pour juger)
            if (totalMeasures < 20)
            {
                return 30;
            }
        }
        
        string whereClause = since != null ? "@SinceDate" : "DATEADD(MINUTE, -10, GETUTCDATE())";
        string sql = $@"
            WITH Intervals AS (
                SELECT DATEDIFF(MILLISECOND, LAG(UtcTs) OVER (PARTITION BY DeviceId ORDER BY UtcTs), UtcTs) as IntervalMs
                FROM [DIRIS].[Measurements]
                WHERE UtcTs > {whereClause}
            )
            SELECT AVG(CAST(IntervalMs AS FLOAT)) as AvgStdDev
            FROM (
                SELECT STDEV(CAST(IntervalMs AS FLOAT)) as IntervalMs
                FROM Intervals
                WHERE IntervalMs IS NOT NULL
            ) t";
        
        using var command = new SqlCommand(sql, connection);
        if (since != null && DateTime.TryParse(since, out var sinceDate2))
        {
            command.Parameters.AddWithValue("@SinceDate", sinceDate2);
        }
        var result = await command.ExecuteScalarAsync();
        
        if (result == null || result == DBNull.Value)
            return 30; // Pas de données = score parfait par défaut
        
        var avgStdDev = Convert.ToDouble(result);
        
        if (avgStdDev < 100)
            return 30;
        else if (avgStdDev < 200)
            return 20;
        else if (avgStdDev < 500)
            return 10;
        
        return 0;
    }

    private async Task<int> CalculateGapsScore(string connectionString, string? since = null)
    {
        using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync();
        
        // Si on utilise le paramètre 'since', vérifier d'abord s'il y a assez de données
        if (since != null && DateTime.TryParse(since, out var sinceDate))
        {
            // Vérifier le nombre total de mesures depuis 'since'
            var countSql = $@"
                SELECT COUNT(*) 
                FROM [DIRIS].[Measurements] 
                WHERE UtcTs > @SinceDate";
                
            using var countCommand = new SqlCommand(countSql, connection);
            countCommand.Parameters.AddWithValue("@SinceDate", sinceDate);
            var totalMeasures = (int)await countCommand.ExecuteScalarAsync();
            
            // Si moins de 20 mesures, considérer comme score parfait (pas assez de données pour juger)
            if (totalMeasures < 20)
            {
                return 30;
            }
        }
        
        // Vérifier d'abord la régularité - si elle est excellente, ignorer les gaps mineurs
        var regularityScore = await CalculateRegularityScore(connectionString, since);
        
        var gaps = await GetGaps(connection, since);
        var gapCount = gaps.Count();
        
        // Si la régularité est excellente (30/30), être plus tolérant avec les gaps
        if (regularityScore == 30)
        {
            if (gapCount == 0)
                return 30;
            else if (gapCount <= 5)  // Plus tolérant
                return 25;
            else if (gapCount <= 10)
                return 15;
            else
                return 5;
        }
        else
        {
            // Régularité moyenne ou mauvaise, être strict avec les gaps
            if (gapCount == 0)
                return 30;
            else if (gapCount <= 2)
                return 20;
            else if (gapCount <= 5)
                return 10;
            else
                return 0;
        }
    }

    /// <summary>
    /// Supprime les données de cohérence récentes pour repartir sur de bonnes bases
    /// </summary>
    [HttpPost("clear-data")]
    public async Task<IActionResult> ClearCoherenceData([FromQuery] int minutesToKeep = 5)
    {
        try
        {
            var connectionString = _configuration.GetConnectionString("SqlAiAtr");
            using var connection = new SqlConnection(connectionString);
            await connection.OpenAsync();

            // Supprimer les mesures anciennes (garder seulement les X dernières minutes)
            var sql = @"
                DELETE FROM [DIRIS].[Measurements] 
                WHERE UtcTs < DATEADD(MINUTE, -@minutesToKeep, GETUTCDATE())";

            using var command = new SqlCommand(sql, connection);
            command.Parameters.AddWithValue("@minutesToKeep", minutesToKeep);
            
            var deletedRows = await command.ExecuteNonQueryAsync();

            _logger.LogInformation("Nettoyage des données de cohérence: {DeletedRows} lignes supprimées (gardé {MinutesToKeep} dernières minutes)", 
                deletedRows, minutesToKeep);

            return Ok(new
            {
                success = true,
                message = $"Données de cohérence nettoyées: {deletedRows} mesures supprimées",
                deletedRows = deletedRows,
                keptMinutes = minutesToKeep
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erreur lors du nettoyage des données de cohérence");
            return StatusCode(500, new { error = ex.Message });
        }
    }
}
