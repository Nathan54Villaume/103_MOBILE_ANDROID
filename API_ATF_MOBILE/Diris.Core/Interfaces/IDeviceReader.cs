using Diris.Core.Models;

namespace Diris.Core.Interfaces;

/// <summary>
/// Device reader interface for acquiring data from DIRIS devices
/// </summary>
public interface IDeviceReader
{
    /// <summary>
    /// Reads data from a specific device
    /// </summary>
    Task<DeviceReading> ReadAsync(Device device, CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Checks if a device is healthy and reachable
    /// </summary>
    Task<bool> IsHealthyAsync(Device device);
    
    /// <summary>
    /// Gets the circuit breaker state for a device
    /// </summary>
    string GetCircuitBreakerState(int deviceId);
    
    /// <summary>
    /// Gets the error count for a device
    /// </summary>
    int GetErrorCount(int deviceId);
    
    /// <summary>
    /// Resets the circuit breaker for a device
    /// </summary>
    void ResetCircuitBreaker(int deviceId);
}
