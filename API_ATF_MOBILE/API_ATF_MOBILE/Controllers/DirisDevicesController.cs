using Diris.Core.Interfaces;
using Diris.Core.Models;
using Microsoft.AspNetCore.Mvc;

namespace API_ATF_MOBILE.Controllers;

/// <summary>
/// DIRIS Devices API controller
/// </summary>
[ApiController]
[Route("api/diris/devices")]
public class DirisDevicesController : ControllerBase
{
    private readonly IDeviceRegistry _deviceRegistry;
    private readonly IDeviceReader _deviceReader;
    private readonly ILogger<DirisDevicesController> _logger;

    public DirisDevicesController(
        IDeviceRegistry deviceRegistry, 
        IDeviceReader deviceReader,
        ILogger<DirisDevicesController> logger)
    {
        _deviceRegistry = deviceRegistry;
        _deviceReader = deviceReader;
        _logger = logger;
    }

    /// <summary>
    /// Gets all devices
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetDevices()
    {
        var devices = await _deviceRegistry.GetAllDevicesAsync();
        return Ok(devices);
    }

    /// <summary>
    /// Gets enabled devices only
    /// </summary>
    [HttpGet("enabled")]
    public async Task<IActionResult> GetEnabledDevices()
    {
        var devices = await _deviceRegistry.GetEnabledDevicesAsync();
        return Ok(devices);
    }

    /// <summary>
    /// Gets a specific device by ID
    /// </summary>
    [HttpGet("{id}")]
    public async Task<IActionResult> GetDevice(int id)
    {
        var device = await _deviceRegistry.GetDeviceAsync(id);
        if (device == null)
        {
            return NotFound();
        }
        return Ok(device);
    }

    /// <summary>
    /// Creates a new device
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> CreateDevice([FromBody] Device device)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        try
        {
            var createdDevice = await _deviceRegistry.AddDeviceAsync(device);
            return CreatedAtAction(nameof(GetDevice), new { id = createdDevice.DeviceId }, createdDevice);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating device");
            return StatusCode(500, "Error creating device");
        }
    }

    /// <summary>
    /// Updates an existing device
    /// </summary>
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateDevice(int id, [FromBody] Device device)
    {
        if (id != device.DeviceId)
        {
            return BadRequest("Device ID mismatch");
        }

        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        try
        {
            await _deviceRegistry.UpdateDeviceAsync(device);
            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating device {DeviceId}", id);
            return StatusCode(500, "Error updating device");
        }
    }

    /// <summary>
    /// Deletes a device
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteDevice(int id)
    {
        try
        {
            await _deviceRegistry.DeleteDeviceAsync(id);
            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting device {DeviceId}", id);
            return StatusCode(500, "Error deleting device");
        }
    }

    /// <summary>
    /// Gets tag mappings for a device
    /// </summary>
    [HttpGet("{id}/tags")]
    public async Task<IActionResult> GetTagMappings(int id)
    {
        var mappings = await _deviceRegistry.GetTagMappingsAsync(id);
        return Ok(mappings);
    }

    /// <summary>
    /// Updates tag mappings for a device
    /// </summary>
    [HttpPut("{id}/tags")]
    public async Task<IActionResult> UpdateTagMappings(int id, [FromBody] IEnumerable<TagMap> mappings)
    {
        try
        {
            await _deviceRegistry.UpdateTagMappingsAsync(id, mappings);
            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating tag mappings for device {DeviceId}", id);
            return StatusCode(500, "Error updating tag mappings");
        }
    }

    /// <summary>
    /// Triggers a manual poll for a device (admin only)
    /// </summary>
    [HttpPost("{id}/poll")]
    public async Task<IActionResult> TriggerPoll(int id)
    {
        try
        {
            var device = await _deviceRegistry.GetDeviceAsync(id);
            if (device == null)
            {
                return NotFound();
            }

            var reading = await _deviceReader.ReadAsync(device);
            return Ok(reading);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error triggering poll for device {DeviceId}", id);
            return StatusCode(500, "Error triggering poll");
        }
    }

    /// <summary>
    /// Gets device health status
    /// </summary>
    [HttpGet("{id}/health")]
    public async Task<IActionResult> GetDeviceHealth(int id)
    {
        try
        {
            var device = await _deviceRegistry.GetDeviceAsync(id);
            if (device == null)
            {
                return NotFound();
            }

            var isHealthy = await _deviceReader.IsHealthyAsync(device);
            var circuitBreakerState = _deviceReader.GetCircuitBreakerState(id);
            var errorCount = _deviceReader.GetErrorCount(id);

            return Ok(new
            {
                DeviceId = id,
                IsHealthy = isHealthy,
                CircuitBreakerState = circuitBreakerState,
                ErrorCount = errorCount,
                LastChecked = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking health for device {DeviceId}", id);
            return StatusCode(500, "Error checking device health");
        }
    }
}

