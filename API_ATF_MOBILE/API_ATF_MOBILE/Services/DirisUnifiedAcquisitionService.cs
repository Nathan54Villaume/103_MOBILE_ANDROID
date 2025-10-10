using Diris.Core.Interfaces;
using Diris.Core.Models;
using Microsoft.Extensions.Options;
using System.Collections.Concurrent;
using Dapper;

namespace API_ATF_MOBILE.Services;

/// <summary>
/// Service DIRIS unifié qui combine :
/// - Acquisition respectant RecordingFrequencyMs (de DirisSignalSchedulerService)
/// - Toutes les fonctionnalités de monitoring et métriques (de DirisAcquisitionService)
/// </summary>
public class DirisUnifiedAcquisitionService : BackgroundService
{
    private readonly IDeviceRegistry _deviceRegistry;
    private readonly IDeviceReader _deviceReader;
    private readonly IMeasurementWriter _measurementWriter;
    private readonly ISystemMetricsCollector _metricsCollector;
    private readonly ILogger<DirisUnifiedAcquisitionService> _logger;
    private DirisAcquisitionOptions _options;
    private readonly DirisAcquisitionControlService _controlService;
    private readonly string _connectionString;

    // Dictionnaire des timers par signal (DeviceId.Signal)
    private readonly ConcurrentDictionary<string, Timer> _signalTimers = new();
    
    // Cache des fréquences pour éviter les requêtes répétées
    private readonly ConcurrentDictionary<string, int> _signalFrequencies = new();
    private DateTime _lastFrequencyRefresh = DateTime.MinValue;
    private readonly TimeSpan _frequencyRefreshInterval = TimeSpan.FromMinutes(5);

    // Health tracking (de DirisAcquisitionService)
    private DateTime _lastSuccessfulCycle = DateTime.UtcNow;
    private int _consecutiveErrors = 0;
    private int _totalCyclesCompleted = 0;

    public DirisUnifiedAcquisitionService(
        IDeviceRegistry deviceRegistry,
        IDeviceReader deviceReader,
        IMeasurementWriter measurementWriter,
        ISystemMetricsCollector metricsCollector,
        ILogger<DirisUnifiedAcquisitionService> logger,
        IOptionsMonitor<DirisAcquisitionOptions> optionsMonitor,
        DirisAcquisitionControlService controlService,
        IConfiguration configuration)
    {
        _deviceRegistry = deviceRegistry;
        _deviceReader = deviceReader;
        _measurementWriter = measurementWriter;
        _metricsCollector = metricsCollector;
        _logger = logger;
        _controlService = controlService;
        _options = optionsMonitor.CurrentValue;
        _connectionString = configuration.GetConnectionString("SqlAiAtr")
            ?? throw new InvalidOperationException("ConnectionStrings:SqlAiAtr manquante");

        optionsMonitor.OnChange(newOptions =>
        {
            _logger.LogInformation("DIRIS configuration reloaded. New Poll Interval: {Interval}ms, Parallelism: {Parallelism}",
                newOptions.DefaultPollIntervalMs, newOptions.Parallelism);
            _options = newOptions;
        });
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("========================================");
        _logger.LogInformation("DIRIS Unified Acquisition service STARTED");
        _logger.LogInformation("Combining signal-based scheduling with comprehensive monitoring");
        _logger.LogInformation("Parallelism: {Parallelism}, Request Timeout: {Timeout}ms", 
            _options.Parallelism, _options.RequestTimeoutMs);
        _logger.LogInformation("========================================");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                // Vérifier si l'acquisition est activée
                if (_controlService.IsRunning)
                {
                    await RefreshSignalTimersAsync(stoppingToken);
                    
                    _totalCyclesCompleted++;
                    _lastSuccessfulCycle = DateTime.UtcNow;
                    _consecutiveErrors = 0;
                    
                    // Log toutes les 100 cycles
                    if (_totalCyclesCompleted % 100 == 0)
                    {
                        _logger.LogInformation("DIRIS Unified Acquisition: {Cycles} cycles completed, Active timers: {Timers}, Last success: {LastSuccess}", 
                            _totalCyclesCompleted, _signalTimers.Count, _lastSuccessfulCycle);
                    }
                }
                else
                {
                    _logger.LogDebug("Acquisition is PAUSED by control service");
                }

                // Attendre avant la prochaine vérification (plus court pour réactivité)
                await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
            }
            catch (OperationCanceledException)
            {
                _logger.LogInformation("DIRIS Unified Acquisition service is STOPPING (CancellationRequested)");
                break;
            }
            catch (Exception ex)
            {
                _consecutiveErrors++;
                _logger.LogError(ex, "!!! ERROR in DIRIS unified acquisition cycle {CycleNumber} (consecutive errors: {ConsecutiveErrors}) !!!", 
                    _totalCyclesCompleted + 1, _consecutiveErrors);
                
                if (_consecutiveErrors >= 10)
                {
                    _logger.LogCritical("!!! CRITICAL: {ConsecutiveErrors} consecutive errors in DIRIS unified acquisition. Last success: {LastSuccess} !!!", 
                        _consecutiveErrors, _lastSuccessfulCycle);
                }
                
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            }
        }

        // Nettoyer tous les timers
        await StopAllTimersAsync();
        
        _logger.LogInformation("========================================");
        _logger.LogInformation("DIRIS Unified Acquisition service STOPPED");
        _logger.LogInformation("Total cycles completed: {Cycles}, Last success: {LastSuccess}", 
            _totalCyclesCompleted, _lastSuccessfulCycle);
        _logger.LogInformation("========================================");
    }

    /// <summary>
    /// Rafraîchit les timers des signaux basés sur les fréquences actuelles
    /// </summary>
    private async Task RefreshSignalTimersAsync(CancellationToken cancellationToken)
    {
        try
        {
            // Vérifier si on doit rafraîchir les fréquences
            if (DateTime.UtcNow - _lastFrequencyRefresh > _frequencyRefreshInterval)
            {
                await LoadSignalFrequenciesAsync();
                _lastFrequencyRefresh = DateTime.UtcNow;
            }

            var devices = await _deviceRegistry.GetEnabledDevicesAsync();
            var activeSignals = new HashSet<string>();

            foreach (var device in devices)
            {
                var tagMappings = await _deviceRegistry.GetTagMappingsAsync(device.DeviceId);
                
                foreach (var mapping in tagMappings.Where(tm => tm.Enabled))
                {
                    var signalKey = $"{device.DeviceId}.{mapping.Signal}";
                    activeSignals.Add(signalKey);

                    // Obtenir la fréquence pour ce signal
                    var frequency = GetSignalFrequency(signalKey, mapping.Signal);
                    
                    // Créer ou mettre à jour le timer
                    await CreateOrUpdateSignalTimerAsync(device, mapping, frequency);
                }
            }

            // Supprimer les timers pour les signaux qui ne sont plus actifs
            await RemoveInactiveTimersAsync(activeSignals);

            _logger.LogDebug("Signal timers refreshed. Active signals: {Count}, Total timers: {TimerCount}", 
                activeSignals.Count, _signalTimers.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error refreshing signal timers");
        }
    }

    /// <summary>
    /// Charge les fréquences des signaux depuis la base de données
    /// </summary>
    private async Task LoadSignalFrequenciesAsync()
    {
        try
        {
            using var connection = new Microsoft.Data.SqlClient.SqlConnection(_connectionString);
            
            var sql = @"
                SELECT 
                    DeviceId,
                    Signal,
                    RecordingFrequencyMs
                FROM [DIRIS].[TagMap]
                WHERE Enabled = 1";

            var frequencies = await connection.QueryAsync<(int DeviceId, string Signal, int RecordingFrequencyMs)>(sql);

            foreach (var (deviceId, signal, frequency) in frequencies)
            {
                var signalKey = $"{deviceId}.{signal}";
                _signalFrequencies[signalKey] = frequency;
            }

            _logger.LogDebug("Loaded {Count} signal frequencies from database", _signalFrequencies.Count);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not load signal frequencies from database, using defaults");
        }
    }

    /// <summary>
    /// Obtient la fréquence d'un signal (avec fallback par défaut)
    /// </summary>
    private int GetSignalFrequency(string signalKey, string signal)
    {
        if (_signalFrequencies.TryGetValue(signalKey, out var frequency))
        {
            return frequency;
        }

        // Fallback vers les fréquences par défaut
        return signal switch
        {
            var s when s.StartsWith("I_") || s.StartsWith("PV") || s.StartsWith("LV_") || s == "F_255" => 1000, // 1s - Critiques
            var s when s.Contains("RP") || s.Contains("IP") || s.Contains("AP") => 2000, // 2s - Puissances
            var s when s.StartsWith("THD_") => 5000, // 5s - THD
            var s when s.StartsWith("E") && s.EndsWith("_255") => 30000, // 30s - Énergies
            var s when s.StartsWith("AVG_") || s.StartsWith("MAXAVG") => 10000, // 10s - Moyennes/Max
            _ => 5000 // 5s - Par défaut
        };
    }

    /// <summary>
    /// Crée ou met à jour le timer pour un signal
    /// </summary>
    private async Task CreateOrUpdateSignalTimerAsync(Device device, TagMap mapping, int frequencyMs)
    {
        var signalKey = $"{device.DeviceId}.{mapping.Signal}";

        // Supprimer l'ancien timer s'il existe
        if (_signalTimers.TryRemove(signalKey, out var oldTimer))
        {
            await oldTimer.DisposeAsync();
        }

        // Créer un nouveau timer
        var timer = new Timer(
            async _ => await ProcessSignalAsync(device, mapping),
            null,
            TimeSpan.FromMilliseconds(frequencyMs), // Premier déclenchement
            TimeSpan.FromMilliseconds(frequencyMs)  // Intervalle
        );

        _signalTimers[signalKey] = timer;

        _logger.LogTrace("Created timer for signal {Signal} on device {DeviceId} with frequency {Frequency}ms", 
            mapping.Signal, device.DeviceId, frequencyMs);
    }

    /// <summary>
    /// Traite un signal individuel (appelé par le timer)
    /// </summary>
    private async Task ProcessSignalAsync(Device device, TagMap mapping)
    {
        try
        {
            if (!_controlService.IsRunning)
            {
                return; // Acquisition arrêtée
            }

            var startTime = DateTime.UtcNow;
            
            _logger.LogTrace("[SIGNAL {Signal}] Processing signal {Signal} on device {DeviceId}", 
                mapping.Signal, mapping.Signal, device.DeviceId);

            // Lire le device (le service de lecture retourne toutes les mesures du device)
            using var cts = new CancellationTokenSource(TimeSpan.FromMilliseconds(_options.RequestTimeoutMs));
            var reading = await _deviceReader.ReadAsync(device, cts.Token);
            
            if (reading.IsSuccess)
            {
                // Mettre à jour les métriques de lecture réussie
                var duration = DateTime.UtcNow - startTime;
                _metricsCollector.RecordSuccessfulReading(device.DeviceId, duration);
                
                // Mettre à jour le "last seen" du device
                await _deviceRegistry.UpdateDeviceLastSeenAsync(device.DeviceId, reading.UtcTs);
                
                // Filtrer seulement la mesure pour ce signal
                var measurement = reading.Measurements.FirstOrDefault(m => m.Signal == mapping.Signal);
                
                if (measurement != null)
                {
                    // Écrire la mesure
                    await _measurementWriter.WriteAsync(new[] { measurement });
                    
                    _logger.LogTrace("[SIGNAL {Signal}] Successfully recorded measurement in {Duration}ms", 
                        mapping.Signal, duration.TotalMilliseconds);
                    
                    _metricsCollector.RecordMeasurementPoint();
                }
                else
                {
                    _logger.LogWarning("[SIGNAL {Signal}] Signal not found in device reading", mapping.Signal);
                }
            }
            else
            {
                _logger.LogWarning("[SIGNAL {Signal}] Failed to read device {DeviceId}: {Error}", 
                    mapping.Signal, device.DeviceId, reading.ErrorMessage);
                _metricsCollector.RecordFailedReading(device.DeviceId, reading.ErrorMessage ?? "Unknown error");
            }
        }
        catch (OperationCanceledException)
        {
            _logger.LogWarning("[SIGNAL {Signal}] Timeout while reading from device {DeviceId} ({IpAddress}) after {Timeout}ms",
                mapping.Signal, device.DeviceId, device.IpAddress, _options.RequestTimeoutMs);
            _metricsCollector.RecordFailedReading(device.DeviceId, "Request timed out");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[SIGNAL {Signal}] Error processing signal on device {DeviceId}", 
                mapping.Signal, device.DeviceId);
            _metricsCollector.RecordFailedReading(device.DeviceId, ex.Message);
        }
    }

    /// <summary>
    /// Supprime les timers pour les signaux inactifs
    /// </summary>
    private async Task RemoveInactiveTimersAsync(HashSet<string> activeSignals)
    {
        var timersToRemove = new List<KeyValuePair<string, Timer>>();

        foreach (var timer in _signalTimers)
        {
            if (!activeSignals.Contains(timer.Key))
            {
                timersToRemove.Add(timer);
            }
        }

        foreach (var (signalKey, timer) in timersToRemove)
        {
            if (_signalTimers.TryRemove(signalKey, out _))
            {
                await timer.DisposeAsync();
                _logger.LogDebug("Removed timer for inactive signal {Signal}", signalKey);
            }
        }
    }

    /// <summary>
    /// Arrête tous les timers
    /// </summary>
    private async Task StopAllTimersAsync()
    {
        var tasks = _signalTimers.Values.Select(async timer => await timer.DisposeAsync());
        await Task.WhenAll(tasks);
        _signalTimers.Clear();
        
        _logger.LogInformation("Stopped all {Count} signal timers", _signalTimers.Count);
    }

    /// <summary>
    /// Obtient les statistiques complètes du service unifié
    /// </summary>
    public object GetServiceStats()
    {
        return new
        {
            // Statistiques du scheduler
            ActiveTimers = _signalTimers.Count,
            CachedFrequencies = _signalFrequencies.Count,
            LastFrequencyRefresh = _lastFrequencyRefresh,
            IsRunning = _controlService.IsRunning,
            TimersByFrequency = _signalTimers.Keys
                .Select(key => new { Signal = key, Frequency = GetSignalFrequency(key, key.Split('.')[1]) })
                .GroupBy(t => t.Frequency)
                .ToDictionary(g => g.Key, g => g.Count()),
            
            // Statistiques de health tracking (de DirisAcquisitionService)
            TotalCyclesCompleted = _totalCyclesCompleted,
            LastSuccessfulCycle = _lastSuccessfulCycle,
            ConsecutiveErrors = _consecutiveErrors,
            IsHealthy = _consecutiveErrors < _options.MaxConsecutiveErrors,
            
            // Configuration
            Parallelism = _options.Parallelism,
            RequestTimeoutMs = _options.RequestTimeoutMs,
            MaxConsecutiveErrors = _options.MaxConsecutiveErrors
        };
    }

    /// <summary>
    /// Obtient l'état de santé du service
    /// </summary>
    public object GetHealthStatus()
    {
        var isHealthy = _consecutiveErrors < _options.MaxConsecutiveErrors;
        var lastSuccessAge = DateTime.UtcNow - _lastSuccessfulCycle;
        
        return new
        {
            IsHealthy = isHealthy,
            Status = isHealthy ? "Healthy" : "Unhealthy",
            LastSuccessfulCycle = _lastSuccessfulCycle,
            LastSuccessAgeSeconds = lastSuccessAge.TotalSeconds,
            ConsecutiveErrors = _consecutiveErrors,
            MaxConsecutiveErrors = _options.MaxConsecutiveErrors,
            TotalCyclesCompleted = _totalCyclesCompleted,
            ActiveTimers = _signalTimers.Count,
            IsRunning = _controlService.IsRunning
        };
    }
}
