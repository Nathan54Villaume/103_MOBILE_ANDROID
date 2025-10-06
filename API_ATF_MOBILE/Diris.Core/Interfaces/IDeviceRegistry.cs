using Diris.Core.Models;

namespace Diris.Core.Interfaces;

/// <summary>
/// Device registry interface for managing DIRIS devices
/// </summary>
public interface IDeviceRegistry
{
    /// <summary>
    /// Gets all enabled devices
    /// </summary>
    Task<IEnumerable<Device>> GetEnabledDevicesAsync();
    
    /// <summary>
    /// Gets a specific device by ID
    /// </summary>
    Task<Device?> GetDeviceAsync(int deviceId);
    
    /// <summary>
    /// Gets all devices (enabled and disabled)
    /// </summary>
    Task<IEnumerable<Device>> GetAllDevicesAsync();
    
    /// <summary>
    /// Updates the last seen timestamp for a device
    /// </summary>
    Task UpdateDeviceLastSeenAsync(int deviceId, DateTime utc);
    
    /// <summary>
    /// Adds a new device
    /// </summary>
    Task<Device> AddDeviceAsync(Device device);
    
    /// <summary>
    /// Updates an existing device
    /// </summary>
    Task UpdateDeviceAsync(Device device);
    
    /// <summary>
    /// Deletes a device
    /// </summary>
    Task DeleteDeviceAsync(int deviceId);
    
    /// <summary>
    /// Gets the tag mappings for a device
    /// </summary>
    Task<IEnumerable<TagMap>> GetTagMappingsAsync(int deviceId);
    
    /// <summary>
    /// Updates tag mappings for a device
    /// </summary>
    Task UpdateTagMappingsAsync(int deviceId, IEnumerable<TagMap> mappings);
}
