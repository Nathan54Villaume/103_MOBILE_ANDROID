using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Options;

namespace API_ATF_MOBILE.Services;

/// <summary>
/// Watchdog service qui surveille l'acquisition DIRIS et détecte les blocages
/// </summary>
public class DirisAcquisitionWatchdogService : BackgroundService
{
    private readonly ILogger<DirisAcquisitionWatchdogService> _logger;
    private readonly IConfiguration _configuration;
    private readonly DirisAcquisitionControlService _controlService;
    private DateTime _lastDataCheck = DateTime.UtcNow;
    private int _consecutiveFailures = 0;

    public DirisAcquisitionWatchdogService(
        ILogger<DirisAcquisitionWatchdogService> logger,
        IConfiguration configuration,
        DirisAcquisitionControlService controlService)
    {
        _logger = logger;
        _configuration = configuration;
        _controlService = controlService;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("========================================");
        _logger.LogInformation("DIRIS Acquisition WATCHDOG started");
        _logger.LogInformation("Monitoring interval: 2 minutes");
        _logger.LogInformation("========================================");

        // Attendre 5 minutes avant le premier check pour laisser l'acquisition démarrer
        await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CheckAcquisitionHealthAsync(stoppingToken);
                
                // Check toutes les 2 minutes
                await Task.Delay(TimeSpan.FromMinutes(2), stoppingToken);
            }
            catch (OperationCanceledException)
            {
                _logger.LogInformation("DIRIS Acquisition Watchdog is stopping");
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in DIRIS Acquisition Watchdog");
                await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
            }
        }

        _logger.LogInformation("DIRIS Acquisition WATCHDOG stopped");
    }

    private async Task CheckAcquisitionHealthAsync(CancellationToken cancellationToken)
    {
        var checkTime = DateTime.UtcNow;
        _logger.LogDebug("[WATCHDOG] Starting health check at {Time}", checkTime);

        // 1. Vérifier que l'acquisition est marquée comme "Running"
        var isRunning = _controlService.IsRunning;
        _logger.LogDebug("[WATCHDOG] Acquisition status: {Status}", isRunning ? "RUNNING" : "STOPPED");

        if (!isRunning)
        {
            _logger.LogInformation("[WATCHDOG] Acquisition is stopped, skipping health check");
            _consecutiveFailures = 0;
            return;
        }

        // 2. Vérifier qu'il y a eu des données récentes dans la base
        try
        {
            var connectionString = _configuration.GetConnectionString("SqlAiAtr");
            if (string.IsNullOrEmpty(connectionString))
            {
                _logger.LogWarning("[WATCHDOG] Connection string 'SqlAiAtr' not found");
                return;
            }

            using var connection = new SqlConnection(connectionString);
            await connection.OpenAsync(cancellationToken);

            // Chercher la dernière mesure
            var query = @"
                SELECT TOP 1 
                    UtcTs,
                    IngestTs,
                    DeviceId,
                    Signal
                FROM [DIRIS].[Measurements]
                ORDER BY IngestTs DESC";

            using var command = new SqlCommand(query, connection);
            command.CommandTimeout = 10;

            using var reader = await command.ExecuteReaderAsync(cancellationToken);

            if (await reader.ReadAsync(cancellationToken))
            {
                var lastUtcTs = reader.GetDateTime(0);
                var lastIngestTs = reader.GetDateTime(1);
                var deviceId = reader.GetInt32(2);
                var signal = reader.GetString(3);

                var timeSinceLastData = DateTime.UtcNow - lastIngestTs;

                _logger.LogDebug("[WATCHDOG] Last data: {Time} ago (Device {DeviceId}, Signal {Signal})", 
                    timeSinceLastData, deviceId, signal);

                // Si pas de données depuis plus de 5 minutes, c'est suspect
                if (timeSinceLastData.TotalMinutes > 5)
                {
                    _consecutiveFailures++;
                    _logger.LogWarning("[WATCHDOG] !!! NO DATA for {Minutes} minutes (consecutive failures: {Failures}) !!!", 
                        (int)timeSinceLastData.TotalMinutes, _consecutiveFailures);

                    if (_consecutiveFailures >= 3)
                    {
                        _logger.LogCritical("[WATCHDOG] !!! CRITICAL: Acquisition appears BLOCKED. No data for {Minutes} minutes !!!", 
                            (int)timeSinceLastData.TotalMinutes);
                        _logger.LogCritical("[WATCHDOG] !!! ACTION REQUIRED: Restart the API to fix the issue !!!");
                    }
                }
                else
                {
                    // Tout va bien
                    _consecutiveFailures = 0;
                    _logger.LogDebug("[WATCHDOG] Health check: OK (last data {Seconds}s ago)", (int)timeSinceLastData.TotalSeconds);
                }
            }
            else
            {
                _logger.LogWarning("[WATCHDOG] No data found in DIRIS.Measurements table");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[WATCHDOG] Error checking database for recent data");
        }
    }
}

