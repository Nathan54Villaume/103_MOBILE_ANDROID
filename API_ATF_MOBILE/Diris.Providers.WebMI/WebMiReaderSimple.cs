using Diris.Core.Interfaces;
using Diris.Core.Models;
using Microsoft.Extensions.Logging;

namespace Diris.Providers.WebMI;

/// <summary>
/// WebMI device reader (simplified version)
/// </summary>
public class WebMiReaderSimple : IDeviceReader
{
    private readonly IWebMiClient _webMiClient;
    private readonly IDeviceRegistry _deviceRegistry;
    private readonly ILogger<WebMiReaderSimple> _logger;
    private readonly Dictionary<int, int> _errorCounts = new();
    private readonly object _lock = new();

    public WebMiReaderSimple(
        IWebMiClient webMiClient, 
        IDeviceRegistry deviceRegistry, 
        ILogger<WebMiReaderSimple> logger)
    {
        _webMiClient = webMiClient;
        _deviceRegistry = deviceRegistry;
        _logger = logger;
    }

    public async Task<DeviceReading> ReadAsync(Device device, CancellationToken cancellationToken = default)
    {
        var startTime = DateTime.UtcNow;
        var reading = new DeviceReading
        {
            DeviceId = device.DeviceId,
            DeviceName = device.Name,
            UtcTs = startTime
        };

        try
        {
            // Get tag mappings for this device
            var tagMappings = await _deviceRegistry.GetTagMappingsAsync(device.DeviceId);
            var enabledMappings = tagMappings.Where(t => t.Enabled).ToList();
            
            if (!enabledMappings.Any())
            {
                _logger.LogWarning("No enabled tag mappings found for device {DeviceId}", device.DeviceId);
                return reading;
            }

            // Read from WebMI
            var addresses = enabledMappings.Select(t => t.WebMiKey).ToList();
            var webMiResults = await _webMiClient.ReadAsync(device.GetWebMiEndpoint(), addresses, cancellationToken);

            // Convert to measurements
            var measurements = new List<Measurement>();
            foreach (var mapping in enabledMappings)
            {
                var rawValue = webMiResults.GetValueOrDefault(mapping.WebMiKey);
                var value = rawValue.HasValue ? mapping.ApplyScale(rawValue.Value) : 0.0;
                var quality = rawValue.HasValue ? (byte)1 : (byte)3; // OK or Error

                measurements.Add(new Measurement
                {
                    DeviceId = device.DeviceId,
                    UtcTs = startTime,
                    Signal = mapping.Signal,
                    Value = value,
                    Quality = quality,
                    IngestTs = DateTime.UtcNow
                });
            }

            reading.Measurements = measurements;
            reading.IsSuccess = true;
            reading.PollDuration = DateTime.UtcNow - startTime;

            // Reset error count on success
            lock (_lock)
            {
                _errorCounts[device.DeviceId] = 0;
            }

            _logger.LogDebug("Successfully read {Count} measurements from device {DeviceId} in {Duration}ms", 
                measurements.Count, device.DeviceId, reading.PollDuration.TotalMilliseconds);

            return reading;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reading from device {DeviceId}", device.DeviceId);
            reading.IsSuccess = false;
            reading.ErrorMessage = ex.Message;
            reading.PollDuration = DateTime.UtcNow - startTime;
            
            RecordError(device.DeviceId);
            return reading;
        }
    }

    public async Task<bool> IsHealthyAsync(Device device)
    {
        try
        {
            return await _webMiClient.TestConnectivityAsync(device.GetWebMiEndpoint());
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Health check failed for device {DeviceId}", device.DeviceId);
            return false;
        }
    }

    public string GetCircuitBreakerState(int deviceId)
    {
        return "Closed"; // Simplified - always closed
    }

    public int GetErrorCount(int deviceId)
    {
        lock (_lock)
        {
            return _errorCounts.GetValueOrDefault(deviceId, 0);
        }
    }

    public void ResetCircuitBreaker(int deviceId)
    {
        lock (_lock)
        {
            _errorCounts[deviceId] = 0;
            _logger.LogInformation("Error count reset for device {DeviceId}", deviceId);
        }
    }

    private void RecordError(int deviceId)
    {
        lock (_lock)
        {
            _errorCounts[deviceId] = _errorCounts.GetValueOrDefault(deviceId, 0) + 1;
        }
    }
}
