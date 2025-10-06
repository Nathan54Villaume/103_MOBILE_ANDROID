using Diris.Core.Interfaces;
using Diris.Core.Models;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Diris.Server.Services;

/// <summary>
/// Background service for data acquisition
/// </summary>
public class AcquisitionService : BackgroundService
{
    private readonly IDeviceRegistry _deviceRegistry;
    private readonly IDeviceReader _deviceReader;
    private readonly IMeasurementWriter _measurementWriter;
    private readonly ISystemMetricsCollector _metricsCollector;
    private readonly ILogger<AcquisitionService> _logger;
    private readonly AcquisitionOptions _options;

    public AcquisitionService(
        IDeviceRegistry deviceRegistry,
        IDeviceReader deviceReader,
        IMeasurementWriter measurementWriter,
        ISystemMetricsCollector metricsCollector,
        ILogger<AcquisitionService> logger,
        IOptions<AcquisitionOptions> options)
    {
        _deviceRegistry = deviceRegistry;
        _deviceReader = deviceReader;
        _measurementWriter = measurementWriter;
        _metricsCollector = metricsCollector;
        _logger = logger;
        _options = options.Value;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Acquisition service started with parallelism {Parallelism}", _options.Parallelism);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await PerformAcquisitionCycleAsync(stoppingToken);
                
                // Wait for the next cycle
                var delay = TimeSpan.FromMilliseconds(_options.DefaultPollIntervalMs);
                await Task.Delay(delay, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                _logger.LogInformation("Acquisition service is stopping");
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in acquisition cycle");
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            }
        }
    }

    private async Task PerformAcquisitionCycleAsync(CancellationToken cancellationToken)
    {
        var startTime = DateTime.UtcNow;
        var devices = await _deviceRegistry.GetEnabledDevicesAsync();
        var deviceList = devices.ToList();

        if (!deviceList.Any())
        {
            _logger.LogDebug("No enabled devices found for acquisition");
            return;
        }

        _logger.LogDebug("Starting acquisition cycle for {Count} devices", deviceList.Count);

        // Process devices in parallel with controlled concurrency
        var semaphore = new SemaphoreSlim(_options.Parallelism, _options.Parallelism);
        var tasks = deviceList.Select(device => ProcessDeviceAsync(device, semaphore, cancellationToken));
        
        await Task.WhenAll(tasks);

        var cycleDuration = DateTime.UtcNow - startTime;
        _logger.LogDebug("Acquisition cycle completed in {Duration}ms", cycleDuration.TotalMilliseconds);
    }

    private async Task ProcessDeviceAsync(Device device, SemaphoreSlim semaphore, CancellationToken cancellationToken)
    {
        await semaphore.WaitAsync(cancellationToken);
        try
        {
            var startTime = DateTime.UtcNow;
            
            _logger.LogDebug("Reading from device {DeviceId} ({Name})", device.DeviceId, device.Name);
            
            var reading = await _deviceReader.ReadAsync(device);
            var duration = DateTime.UtcNow - startTime;

            // Update device last seen
            if (reading.IsSuccess)
            {
                await _deviceRegistry.UpdateDeviceLastSeenAsync(device.DeviceId, reading.UtcTs);
                _metricsCollector.RecordSuccessfulReading(device.DeviceId, duration);
                
                // Record measurement points
                foreach (var measurement in reading.Measurements)
                {
                    _metricsCollector.RecordMeasurementPoint();
                }
            }
            else
            {
                _metricsCollector.RecordFailedReading(device.DeviceId, reading.ErrorMessage ?? "Unknown error");
                _logger.LogWarning("Failed to read from device {DeviceId}: {Error}", 
                    device.DeviceId, reading.ErrorMessage);
            }

            // Write measurements to storage
            if (reading.Measurements.Any())
            {
                await _measurementWriter.WriteAsync(reading.Measurements);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing device {DeviceId}", device.DeviceId);
            _metricsCollector.RecordFailedReading(device.DeviceId, ex.Message);
        }
        finally
        {
            semaphore.Release();
        }
    }
}

/// <summary>
/// Acquisition service configuration
/// </summary>
public class AcquisitionOptions
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
