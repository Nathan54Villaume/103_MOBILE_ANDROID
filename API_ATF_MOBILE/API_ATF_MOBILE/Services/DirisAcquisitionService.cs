using Diris.Core.Interfaces;
using Diris.Core.Models;
using Microsoft.Extensions.Options;

namespace API_ATF_MOBILE.Services;

/// <summary>
/// Background service for DIRIS data acquisition
/// </summary>
public class DirisAcquisitionService : BackgroundService
{
    private readonly IDeviceRegistry _deviceRegistry;
    private readonly IDeviceReader _deviceReader;
    private readonly IMeasurementWriter _measurementWriter;
    private readonly ISystemMetricsCollector _metricsCollector;
    private readonly ILogger<DirisAcquisitionService> _logger;
    private readonly DirisAcquisitionOptions _options;
    private readonly DirisAcquisitionControlService _controlService;
    
    // Health tracking
    private DateTime _lastSuccessfulCycle = DateTime.UtcNow;
    private int _consecutiveErrors = 0;
    private int _totalCyclesCompleted = 0;

    public DirisAcquisitionService(
        IDeviceRegistry deviceRegistry,
        IDeviceReader deviceReader,
        IMeasurementWriter measurementWriter,
        ISystemMetricsCollector metricsCollector,
        ILogger<DirisAcquisitionService> logger,
        IOptions<DirisAcquisitionOptions> options,
        DirisAcquisitionControlService controlService)
    {
        _deviceRegistry = deviceRegistry;
        _deviceReader = deviceReader;
        _measurementWriter = measurementWriter;
        _metricsCollector = metricsCollector;
        _logger = logger;
        _options = options.Value;
        _controlService = controlService;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("========================================");
        _logger.LogInformation("DIRIS Acquisition service STARTED");
        _logger.LogInformation("Parallelism: {Parallelism}, Poll Interval: {Interval}ms", 
            _options.Parallelism, _options.DefaultPollIntervalMs);
        _logger.LogInformation("========================================");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                _logger.LogDebug("[CYCLE {CycleNumber}] Starting new acquisition cycle", _totalCyclesCompleted + 1);
                
                // Vérifier si l'acquisition est activée
                if (_controlService.IsRunning)
                {
                    var cycleStart = DateTime.UtcNow;
                    _logger.LogDebug("[CYCLE {CycleNumber}] Acquisition is ACTIVE, performing cycle...", _totalCyclesCompleted + 1);
                    
                    await PerformAcquisitionCycleAsync(stoppingToken);
                    
                    _totalCyclesCompleted++;
                    _lastSuccessfulCycle = DateTime.UtcNow;
                    _consecutiveErrors = 0;
                    
                    var cycleDuration = (DateTime.UtcNow - cycleStart).TotalMilliseconds;
                    _logger.LogDebug("[CYCLE {CycleNumber}] Cycle completed successfully in {Duration}ms", 
                        _totalCyclesCompleted, cycleDuration);
                    
                    // Log toutes les 100 cycles
                    if (_totalCyclesCompleted % 100 == 0)
                    {
                        _logger.LogInformation("DIRIS Acquisition: {Cycles} cycles completed, last success: {LastSuccess}", 
                            _totalCyclesCompleted, _lastSuccessfulCycle);
                    }
                    
                    // Attendre le prochain cycle avec l'intervalle de polling configuré
                    var delay = TimeSpan.FromMilliseconds(_options.DefaultPollIntervalMs);
                    _logger.LogTrace("[CYCLE {CycleNumber}] Waiting {Delay}ms before next cycle", _totalCyclesCompleted, delay.TotalMilliseconds);
                    await Task.Delay(delay, stoppingToken);
                }
                else
                {
                    // Acquisition arrêtée : attendre plus longtemps pour économiser du CPU
                    _logger.LogDebug("[CYCLE {CycleNumber}] Acquisition is PAUSED by control service, waiting 5s...", _totalCyclesCompleted + 1);
                    await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
                }
            }
            catch (OperationCanceledException)
            {
                _logger.LogInformation("DIRIS Acquisition service is STOPPING (CancellationRequested)");
                break;
            }
            catch (Exception ex)
            {
                _consecutiveErrors++;
                _logger.LogError(ex, "!!! ERROR in DIRIS acquisition cycle {CycleNumber} (consecutive errors: {ConsecutiveErrors}) !!!", 
                    _totalCyclesCompleted + 1, _consecutiveErrors);
                
                if (_consecutiveErrors >= 10)
                {
                    _logger.LogCritical("!!! CRITICAL: {ConsecutiveErrors} consecutive errors in DIRIS acquisition. Last success: {LastSuccess} !!!", 
                        _consecutiveErrors, _lastSuccessfulCycle);
                }
                
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            }
        }
        
        _logger.LogInformation("========================================");
        _logger.LogInformation("DIRIS Acquisition service STOPPED");
        _logger.LogInformation("Total cycles completed: {Cycles}, Last success: {LastSuccess}", 
            _totalCyclesCompleted, _lastSuccessfulCycle);
        _logger.LogInformation("========================================");
    }

    private async Task PerformAcquisitionCycleAsync(CancellationToken cancellationToken)
    {
        var startTime = DateTime.UtcNow;
        _logger.LogTrace("[CYCLE-DETAIL] Fetching enabled devices from registry...");
        
        var devices = await _deviceRegistry.GetEnabledDevicesAsync();
        var deviceList = devices.ToList();
        
        _logger.LogTrace("[CYCLE-DETAIL] Found {Count} enabled devices", deviceList.Count);

        if (!deviceList.Any())
        {
            _logger.LogWarning("No enabled DIRIS devices found for acquisition");
            return;
        }

        _logger.LogDebug("[CYCLE-DETAIL] Starting parallel processing of {Count} devices (parallelism: {Parallelism})", 
            deviceList.Count, _options.Parallelism);

        // Process devices in parallel with controlled concurrency
        var semaphore = new SemaphoreSlim(_options.Parallelism, _options.Parallelism);
        var tasks = deviceList.Select(device => ProcessDeviceAsync(device, semaphore, cancellationToken));
        
        _logger.LogTrace("[CYCLE-DETAIL] Waiting for all device tasks to complete...");
        await Task.WhenAll(tasks);

        var cycleDuration = DateTime.UtcNow - startTime;
        _logger.LogDebug("[CYCLE-DETAIL] All devices processed in {Duration}ms", cycleDuration.TotalMilliseconds);
    }

    private async Task ProcessDeviceAsync(Device device, SemaphoreSlim semaphore, CancellationToken cancellationToken)
    {
        _logger.LogTrace("[DEVICE {DeviceId}] Waiting for semaphore...", device.DeviceId);
        await semaphore.WaitAsync(cancellationToken);
        _logger.LogTrace("[DEVICE {DeviceId}] Semaphore acquired, starting processing", device.DeviceId);
        
        try
        {
            var startTime = DateTime.UtcNow;
            
            _logger.LogDebug("[DEVICE {DeviceId}] Reading from {Name} ({IpAddress})...", 
                device.DeviceId, device.Name, device.IpAddress);
            
            var reading = await _deviceReader.ReadAsync(device);
            var duration = DateTime.UtcNow - startTime;

            // Update device last seen
            if (reading.IsSuccess)
            {
                _logger.LogTrace("[DEVICE {DeviceId}] Read successful: {Count} measurements in {Duration}ms", 
                    device.DeviceId, reading.Measurements.Count, duration.TotalMilliseconds);
                
                await _deviceRegistry.UpdateDeviceLastSeenAsync(device.DeviceId, reading.UtcTs);
                _metricsCollector.RecordSuccessfulReading(device.DeviceId, duration);
                
                // Record measurement points
                foreach (var measurement in reading.Measurements)
                {
                    _metricsCollector.RecordMeasurementPoint();
                }
                
                // Write measurements to storage
                if (reading.Measurements.Any())
                {
                    _logger.LogTrace("[DEVICE {DeviceId}] Writing {Count} measurements to storage...", 
                        device.DeviceId, reading.Measurements.Count);
                    
                    await _measurementWriter.WriteAsync(reading.Measurements);
                    
                    _logger.LogTrace("[DEVICE {DeviceId}] Measurements written successfully", device.DeviceId);
                }
            }
            else
            {
                _metricsCollector.RecordFailedReading(device.DeviceId, reading.ErrorMessage ?? "Unknown error");
                _logger.LogWarning("[DEVICE {DeviceId}] !!! Failed to read from device {Name}: {Error}", 
                    device.DeviceId, device.Name, reading.ErrorMessage);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[DEVICE {DeviceId}] !!! EXCEPTION while processing device {Name} ({IpAddress})", 
                device.DeviceId, device.Name, device.IpAddress);
            _metricsCollector.RecordFailedReading(device.DeviceId, ex.Message);
        }
        finally
        {
            _logger.LogTrace("[DEVICE {DeviceId}] Releasing semaphore", device.DeviceId);
            semaphore.Release();
        }
    }
}

/// <summary>
/// DIRIS Acquisition service configuration
/// </summary>
public class DirisAcquisitionOptions
{
    public const string SectionName = "Acquisition";

    /// <summary>
    /// Number of parallel device readers
    /// </summary>
    public int Parallelism { get; set; } = 6;

    /// <summary>
    /// Default poll interval in milliseconds
    /// </summary>
    public int DefaultPollIntervalMs { get; set; } = 1500;

    /// <summary>
    /// Maximum batch size for measurements
    /// </summary>
    public int MaxBatchPoints { get; set; } = 1000;

    /// <summary>
    /// Jitter percentage for poll intervals
    /// </summary>
    public double JitterPct { get; set; } = 0.1;
}

