using Microsoft.Data.SqlClient;
using System.Text.Json;

namespace API_ATF_MOBILE.Services;

/// <summary>
/// Service de monitoring de la taille de la base de données DIRIS
/// Déclenche des actions automatiques selon les seuils configurés
/// </summary>
public class DirisDatabaseSizeMonitorService : BackgroundService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<DirisDatabaseSizeMonitorService> _logger;
    private readonly IServiceScopeFactory _serviceScopeFactory;
    private readonly TimeSpan _checkInterval = TimeSpan.FromMinutes(5); // Vérification toutes les 5 minutes
    
    private DateTime _lastCleanupTime = DateTime.MinValue;
    private DateTime _lastAlertTime = DateTime.MinValue;
    private bool _acquisitionStoppedDueToSize = false;

    public DirisDatabaseSizeMonitorService(
        IConfiguration configuration,
        ILogger<DirisDatabaseSizeMonitorService> logger,
        IServiceScopeFactory serviceScopeFactory)
    {
        _configuration = configuration;
        _logger = logger;
        _serviceScopeFactory = serviceScopeFactory;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("DIRIS Database Size Monitor service started");

        // Attendre 1 minute avant le premier check pour laisser le temps au système de démarrer
        await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CheckDatabaseSizeAndTakeAction(stoppingToken);
                await Task.Delay(_checkInterval, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                _logger.LogInformation("DIRIS Database Size Monitor service is stopping");
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in database size monitoring cycle");
                await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
            }
        }

        _logger.LogInformation("DIRIS Database Size Monitor service stopped");
    }

    private async Task CheckDatabaseSizeAndTakeAction(CancellationToken stoppingToken)
    {
        try
        {
            var connectionString = _configuration.GetConnectionString("SqlAiAtr");
            if (string.IsNullOrEmpty(connectionString))
            {
                _logger.LogWarning("Connection string SqlAiAtr not found");
                return;
            }

            var maxSizeMB = _configuration.GetValue<int>("Diris:DataRetention:MaxDatabaseSizeMB", 1024);
            
            using var connection = new SqlConnection(connectionString);
            await connection.OpenAsync(stoppingToken);

            var currentSizeMB = await GetCurrentDatabaseSizeMB(connection);
            var percentageUsed = (currentSizeMB / maxSizeMB) * 100;

            _logger.LogDebug("Database size check: {CurrentSize} MB / {MaxSize} MB ({Percentage}%)", 
                currentSizeMB, maxSizeMB, percentageUsed.ToString("F2"));

            // Seuil 1: 75-89% - Avertissement (alerte toutes les heures)
            if (percentageUsed >= 75 && percentageUsed < 90)
            {
                if ((DateTime.UtcNow - _lastAlertTime).TotalHours >= 1)
                {
                    _logger.LogWarning("⚠️ Database size warning: {Percentage}% used ({CurrentSize} MB / {MaxSize} MB)", 
                        percentageUsed.ToString("F2"), currentSizeMB, maxSizeMB);
                    _lastAlertTime = DateTime.UtcNow;
                }
            }
            
            // Seuil 2: 90-95% - Alerte critique (alerte toutes les 30 minutes)
            else if (percentageUsed >= 90 && percentageUsed < 95)
            {
                if ((DateTime.UtcNow - _lastAlertTime).TotalMinutes >= 30)
                {
                    _logger.LogError("🔴 Database size CRITICAL: {Percentage}% used ({CurrentSize} MB / {MaxSize} MB)", 
                        percentageUsed.ToString("F2"), currentSizeMB, maxSizeMB);
                    _lastAlertTime = DateTime.UtcNow;
                }
            }
            
            // Seuil 3: 95-98% - Nettoyage automatique (une fois toutes les 2 heures max)
            else if (percentageUsed >= 95 && percentageUsed < 98)
            {
                if ((DateTime.UtcNow - _lastCleanupTime).TotalHours >= 2)
                {
                    _logger.LogWarning("🧹 Database size exceeded 95% - Triggering automatic cleanup");
                    await TriggerAutomaticCleanup(connection, stoppingToken);
                    _lastCleanupTime = DateTime.UtcNow;
                    _lastAlertTime = DateTime.UtcNow;
                }
            }
            
            // Seuil 4: >98% - ARRÊT ACQUISITION (protection ultime)
            else if (percentageUsed >= 98)
            {
                if (!_acquisitionStoppedDueToSize)
                {
                    _logger.LogCritical("🛑 Database size CRITICAL (>98%) - STOPPING ACQUISITION to prevent data loss");
                    await StopAcquisitionForSafety(stoppingToken);
                    _acquisitionStoppedDueToSize = true;
                    _lastAlertTime = DateTime.UtcNow;
                }
            }
            else
            {
                // Si on repasse sous 90% et que l'acquisition était arrêtée, on peut la redémarrer
                if (_acquisitionStoppedDueToSize && percentageUsed < 90)
                {
                    _logger.LogInformation("✅ Database size back to safe level ({Percentage}%) - Acquisition can be restarted manually", 
                        percentageUsed.ToString("F2"));
                    _acquisitionStoppedDueToSize = false;
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking database size");
        }
    }

    private async Task<decimal> GetCurrentDatabaseSizeMB(SqlConnection connection)
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
        return result == DBNull.Value || result == null ? 0 : (decimal)result;
    }

    private async Task TriggerAutomaticCleanup(SqlConnection connection, CancellationToken stoppingToken)
    {
        try
        {
            // Supprimer les données de plus de 7 jours (plus agressif que la rétention normale)
            var cutoffDate = DateTime.UtcNow.AddDays(-7);
            
            using var cmd = new SqlCommand(@"
                DELETE FROM [DIRIS].[Measurements]
                WHERE UtcTs < @CutoffDate", connection);
            
            cmd.Parameters.AddWithValue("@CutoffDate", cutoffDate);
            
            var deletedCount = await cmd.ExecuteNonQueryAsync(stoppingToken);
            
            _logger.LogInformation("✅ Automatic cleanup completed: {DeletedCount} measurements deleted (older than 7 days)", 
                deletedCount);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during automatic cleanup");
        }
    }

    private async Task StopAcquisitionForSafety(CancellationToken stoppingToken)
    {
        try
        {
            using var scope = _serviceScopeFactory.CreateScope();
            var controlService = scope.ServiceProvider.GetRequiredService<DirisAcquisitionControlService>();
            
            await controlService.StopAcquisitionAsync();
            
            _logger.LogCritical("🛑 Acquisition stopped due to database size limit (>98%). Manual intervention required.");
            _logger.LogCritical("💡 Actions recommandées: 1) Augmenter MaxDatabaseSizeMB, 2) Nettoyer les données anciennes, 3) Redémarrer l'acquisition");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error stopping acquisition for safety");
        }
    }
}
