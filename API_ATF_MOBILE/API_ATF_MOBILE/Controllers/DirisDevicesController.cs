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
            // Validate required fields
            if (string.IsNullOrWhiteSpace(device.Name))
            {
                return BadRequest(new { error = "Device name is required" });
            }

            if (string.IsNullOrWhiteSpace(device.IpAddress))
            {
                return BadRequest(new { error = "Device IP address is required" });
            }

            // Set required properties that might be missing from frontend
            var now = DateTime.UtcNow;
            device.CreatedUtc = now;
            device.UpdatedUtc = now;
            device.Protocol = device.Protocol ?? "webmi";
            device.DeviceId = 0; // Will be set by the database

            var createdDevice = await _deviceRegistry.AddDeviceAsync(device);
            
            // Auto-discover and create default tag mappings
            try
            {
                await DiscoverAndCreateTagMappingsAsync(createdDevice.DeviceId);
                _logger.LogInformation("Auto-discovery of tag mappings completed for device {DeviceId}", createdDevice.DeviceId);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to auto-discover tag mappings for device {DeviceId}. Tags can be configured manually.", createdDevice.DeviceId);
                // Don't fail the device creation if tag discovery fails
            }
            
            return CreatedAtAction(nameof(GetDevice), new { id = createdDevice.DeviceId }, createdDevice);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating device: {Error}", ex.Message);
            return StatusCode(500, new { error = "Error creating device", message = ex.Message });
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

    /// <summary>
    /// Gets all tag mappings for a device
    /// </summary>
    [HttpGet("{id}/tagmaps")]
    public async Task<IActionResult> GetTagMappings(int id)
    {
        try
        {
            var device = await _deviceRegistry.GetDeviceAsync(id);
            if (device == null)
            {
                return NotFound();
            }

            var tagMappings = await _deviceRegistry.GetTagMappingsAsync(id);
            return Ok(tagMappings);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting tag mappings for device {DeviceId}", id);
            return StatusCode(500, "Error getting tag mappings");
        }
    }

    /// <summary>
    /// Updates the enabled status of tag mappings for a device
    /// </summary>
    [HttpPut("{id}/tagmaps/enabled")]
    public async Task<IActionResult> UpdateTagMappingsEnabled(int id, [FromBody] UpdateTagMappingsEnabledRequest request)
    {
        try
        {
            var device = await _deviceRegistry.GetDeviceAsync(id);
            if (device == null)
            {
                return NotFound();
            }

            var tagMappings = await _deviceRegistry.GetTagMappingsAsync(id);
            var updatedMappings = new List<TagMap>();

            foreach (var mapping in tagMappings)
            {
                mapping.Enabled = request.EnabledSignals.Contains(mapping.Signal);
                updatedMappings.Add(mapping);
            }

            await _deviceRegistry.UpdateTagMappingsAsync(id, updatedMappings);

            _logger.LogInformation("Updated enabled status for {Count} tag mappings for device {DeviceId}", 
                updatedMappings.Count, id);

            return Ok(new { success = true, message = "Tag mappings updated successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating tag mappings enabled status for device {DeviceId}", id);
            return StatusCode(500, "Error updating tag mappings");
        }
    }

    /// <summary>
    /// Toggle device enabled/disabled status
    /// </summary>
    [HttpPut("{id}/toggle")]
    public async Task<IActionResult> ToggleDevice(int id, [FromBody] ToggleDeviceRequest request)
    {
        try
        {
            var device = await _deviceRegistry.GetDeviceAsync(id);
            if (device == null)
            {
                return NotFound(new { success = false, message = "Device not found" });
            }

            device.Enabled = request.Enabled;
            await _deviceRegistry.UpdateDeviceAsync(device);

            _logger.LogInformation("Device {DeviceId} {Action}", id, request.Enabled ? "enabled" : "disabled");

            return Ok(new
            {
                success = true,
                message = $"Device {id} {(request.Enabled ? "enabled" : "disabled")} successfully",
                device = new
                {
                    device.DeviceId,
                    device.Name,
                    device.IpAddress,
                    device.Enabled,
                    device.PollIntervalMs
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error toggling device {DeviceId}", id);
            return StatusCode(500, new
            {
                success = false,
                message = "Error toggling device",
                error = ex.Message
            });
        }
    }

    /// <summary>
    /// Discover and create tag mappings for a device (manual trigger)
    /// </summary>
    [HttpPost("{id}/discover-tags")]
    public async Task<IActionResult> DiscoverTags(int id)
    {
        try
        {
            var device = await _deviceRegistry.GetDeviceAsync(id);
            if (device == null)
            {
                return NotFound(new { success = false, message = "Device not found" });
            }

            var tagMaps = await DiscoverAndCreateTagMappingsAsync(id);

            return Ok(new
            {
                success = true,
                message = $"Successfully discovered and created {tagMaps.Count()} tag mappings for device {id}",
                tagMappings = tagMaps
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error discovering tags for device {DeviceId}", id);
            return StatusCode(500, new
            {
                success = false,
                message = "Error discovering tags",
                error = ex.Message
            });
        }
    }

    /// <summary>
    /// Auto-discovers and creates default tag mappings for a DIRIS device
    /// Based on complete DIRIS A40/A41 signal set (81 signals)
    /// Includes: Currents, Voltages, Powers, THD, Energies, Power Factors, and Cumulative Totals
    /// </summary>
    private async Task<IEnumerable<TagMap>> DiscoverAndCreateTagMappingsAsync(int deviceId)
    {
        _logger.LogInformation("Starting auto-discovery of tag mappings for device {DeviceId}", deviceId);

        // Complete DIRIS A40/A41 signal mappings
        var defaultTagMappings = new List<TagMap>
        {
            // ========== COURANTS (A) - Scale 1000 (WebMI returns mA) ==========
            new TagMap { DeviceId = deviceId, Signal = "I_PH1_255", WebMiKey = "I_PH1_255", Unit = "A", Scale = 1000, Enabled = true, Description = "Courant phase 1" },
            new TagMap { DeviceId = deviceId, Signal = "I_PH2_255", WebMiKey = "I_PH2_255", Unit = "A", Scale = 1000, Enabled = true, Description = "Courant phase 2" },
            new TagMap { DeviceId = deviceId, Signal = "I_PH3_255", WebMiKey = "I_PH3_255", Unit = "A", Scale = 1000, Enabled = true, Description = "Courant phase 3" },
            new TagMap { DeviceId = deviceId, Signal = "I_NUL_255", WebMiKey = "I_NUL_255", Unit = "A", Scale = 1000, Enabled = true, Description = "Courant neutre" },
            new TagMap { DeviceId = deviceId, Signal = "MAXAVGSUM_I1_255", WebMiKey = "MAXAVGSUM_I1_255", Unit = "A", Scale = 1000, Enabled = true, Description = "Courant phase 1 - Maximum moyenne" },
            new TagMap { DeviceId = deviceId, Signal = "MAXAVGSUM_I2_255", WebMiKey = "MAXAVGSUM_I2_255", Unit = "A", Scale = 1000, Enabled = true, Description = "Courant phase 2 - Maximum moyenne" },
            new TagMap { DeviceId = deviceId, Signal = "MAXAVGSUM_I3_255", WebMiKey = "MAXAVGSUM_I3_255", Unit = "A", Scale = 1000, Enabled = true, Description = "Courant phase 3 - Maximum moyenne" },
            new TagMap { DeviceId = deviceId, Signal = "MAXAVG_IN_255", WebMiKey = "MAXAVG_IN_255", Unit = "A", Scale = 1000, Enabled = true, Description = "Courant neutre - Maximum moyenne" },
            new TagMap { DeviceId = deviceId, Signal = "AVG_I1_255", WebMiKey = "AVG_I1_255", Unit = "A", Scale = 1000, Enabled = true, Description = "Courant phase 1 - Moyenne" },
            new TagMap { DeviceId = deviceId, Signal = "AVG_I2_255", WebMiKey = "AVG_I2_255", Unit = "A", Scale = 1000, Enabled = true, Description = "Courant phase 2 - Moyenne" },
            new TagMap { DeviceId = deviceId, Signal = "AVG_I3_255", WebMiKey = "AVG_I3_255", Unit = "A", Scale = 1000, Enabled = true, Description = "Courant phase 3 - Moyenne" },
            new TagMap { DeviceId = deviceId, Signal = "AVG_IN_255", WebMiKey = "AVG_IN_255", Unit = "A", Scale = 1000, Enabled = true, Description = "Courant neutre - Moyenne" },
            
            // ========== THD COURANTS (%) - Scale 100 ==========
            new TagMap { DeviceId = deviceId, Signal = "THD_I1_255", WebMiKey = "THD_I1_255", Unit = "%", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "THD_I2_255", WebMiKey = "THD_I2_255", Unit = "%", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "THD_I3_255", WebMiKey = "THD_I3_255", Unit = "%", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "THD_IN_255", WebMiKey = "THD_IN_255", Unit = "", Scale = 1, Enabled = true },
            
            // ========== FRÃ‰QUENCE (Hz) - Scale 100 ==========
            new TagMap { DeviceId = deviceId, Signal = "F_255", WebMiKey = "F_255", Unit = "Hz", Scale = 100, Enabled = true },
            
            // ========== THD TENSIONS - Scale 1 ou 100 selon le signal ==========
            new TagMap { DeviceId = deviceId, Signal = "THD_U1_255", WebMiKey = "THD_U1_255", Unit = "", Scale = 1, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "THD_U2_255", WebMiKey = "THD_U2_255", Unit = "", Scale = 1, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "THD_U3_255", WebMiKey = "THD_U3_255", Unit = "", Scale = 1, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "THD_U12_255", WebMiKey = "THD_U12_255", Unit = "%", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "THD_U23_255", WebMiKey = "THD_U23_255", Unit = "%", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "THD_U31_255", WebMiKey = "THD_U31_255", Unit = "%", Scale = 100, Enabled = true },
            
            // ========== TENSIONS PHASE-NEUTRE (V) - Scale 100 ==========
            new TagMap { DeviceId = deviceId, Signal = "PV1_255", WebMiKey = "PV1_255", Unit = "V", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "PV2_255", WebMiKey = "PV2_255", Unit = "V", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "PV3_255", WebMiKey = "PV3_255", Unit = "V", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "MAXAVG_V1_255", WebMiKey = "MAXAVG_V1_255", Unit = "V", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "MAXAVG_V2_255", WebMiKey = "MAXAVG_V2_255", Unit = "V", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "MAXAVG_V3_255", WebMiKey = "MAXAVG_V3_255", Unit = "V", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "AVG_V1_255", WebMiKey = "AVG_V1_255", Unit = "V", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "AVG_V2_255", WebMiKey = "AVG_V2_255", Unit = "V", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "AVG_V3_255", WebMiKey = "AVG_V3_255", Unit = "V", Scale = 100, Enabled = true },
            
            // ========== TENSIONS PHASE-PHASE (V) - Scale 100 ==========
            new TagMap { DeviceId = deviceId, Signal = "LV_U12_255", WebMiKey = "LV_U12_255", Unit = "V", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "LV_U23_255", WebMiKey = "LV_U23_255", Unit = "V", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "LV_U31_255", WebMiKey = "LV_U31_255", Unit = "V", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "MAXAVG_U12_255", WebMiKey = "MAXAVG_U12_255", Unit = "V", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "MAXAVG_U23_255", WebMiKey = "MAXAVG_U23_255", Unit = "V", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "MAXAVG_U31_255", WebMiKey = "MAXAVG_U31_255", Unit = "V", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "AVG_U12_255", WebMiKey = "AVG_U12_255", Unit = "V", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "AVG_U23_255", WebMiKey = "AVG_U23_255", Unit = "V", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "AVG_U31_255", WebMiKey = "AVG_U31_255", Unit = "V", Scale = 100, Enabled = true },
            
            // ========== PUISSANCES ACTIVES (kW) - Scale 100 ==========
            new TagMap { DeviceId = deviceId, Signal = "PH1_RP_255", WebMiKey = "PH1_RP_255", Unit = "kW", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "PH2_RP_255", WebMiKey = "PH2_RP_255", Unit = "kW", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "PH3_RP_255", WebMiKey = "PH3_RP_255", Unit = "kW", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "SUM_RP_255", WebMiKey = "SUM_RP_255", Unit = "kW", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "MAXAVGSUM_RPPOS_255", WebMiKey = "MAXAVGSUM_RPPOS_255", Unit = "kW", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "AVGSUM_RPPOS_255", WebMiKey = "AVGSUM_RPPOS_255", Unit = "kW", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "PRED_RP_255", WebMiKey = "PRED_RP_255", Unit = "kW", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "MAXAVGSUM_RPNEG_255", WebMiKey = "MAXAVGSUM_RPNEG_255", Unit = "kW", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "AVGSUM_RPNEG_255", WebMiKey = "AVGSUM_RPNEG_255", Unit = "kW", Scale = 100, Enabled = true },
            
            // ========== PUISSANCES RÃ‰ACTIVES (kVAR) - Scale 100 ==========
            new TagMap { DeviceId = deviceId, Signal = "PH1_IP_255", WebMiKey = "PH1_IP_255", Unit = "kVAR", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "PH2_IP_255", WebMiKey = "PH2_IP_255", Unit = "kVAR", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "PH3_IP_255", WebMiKey = "PH3_IP_255", Unit = "kVAR", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "SUM_IP_255", WebMiKey = "SUM_IP_255", Unit = "kVAR", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "MAXAVGSUM_IPPOS_255", WebMiKey = "MAXAVGSUM_IPPOS_255", Unit = "kVAR", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "AVGSUM_IPPOS_255", WebMiKey = "AVGSUM_IPPOS_255", Unit = "kVAR", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "PRED_IP_255", WebMiKey = "PRED_IP_255", Unit = "kVAR", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "MAXAVGSUM_IPNEG_255", WebMiKey = "MAXAVGSUM_IPNEG_255", Unit = "kVAR", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "AVGSUM_IPNEG_255", WebMiKey = "AVGSUM_IPNEG_255", Unit = "kVAR", Scale = 100, Enabled = true },
            
            // ========== PUISSANCES APPARENTES (kVA) - Scale 100 ==========
            new TagMap { DeviceId = deviceId, Signal = "PH1_AP_255", WebMiKey = "PH1_AP_255", Unit = "kVA", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "PH2_AP_255", WebMiKey = "PH2_AP_255", Unit = "kVA", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "PH3_AP_255", WebMiKey = "PH3_AP_255", Unit = "kVA", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "SUM_AP_255", WebMiKey = "SUM_AP_255", Unit = "kVA", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "MAXAVGSUM_AP_255", WebMiKey = "MAXAVGSUM_AP_255", Unit = "kVA", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "AVGSUM_AP_255", WebMiKey = "AVGSUM_AP_255", Unit = "kVA", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "PRED_AP_255", WebMiKey = "PRED_AP_255", Unit = "kVA", Scale = 100, Enabled = true },
            
            // ========== FACTEURS DE PUISSANCE (%) - Scale 100 ==========
            new TagMap { DeviceId = deviceId, Signal = "PH1_PF_255", WebMiKey = "PH1_PF_255", Unit = "%", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "PH2_PF_255", WebMiKey = "PH2_PF_255", Unit = "%", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "PH3_PF_255", WebMiKey = "PH3_PF_255", Unit = "%", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "SUM_PF_255", WebMiKey = "SUM_PF_255", Unit = "%", Scale = 100, Enabled = true },
            
            // ========== Ã‰NERGIES (kWh) - Scale 100 ==========
            new TagMap { DeviceId = deviceId, Signal = "E1_255", WebMiKey = "E1_255", Unit = "kWh", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "E2_255", WebMiKey = "E2_255", Unit = "kWh", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "E3_255", WebMiKey = "E3_255", Unit = "kWh", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "E4_255", WebMiKey = "E4_255", Unit = "kWh", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "E5_255", WebMiKey = "E5_255", Unit = "kWh", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "E6_255", WebMiKey = "E6_255", Unit = "kWh", Scale = 100, Enabled = true },
            
            // ========== TOTAUX CUMULATIFS - Scale 100 ==========
            new TagMap { DeviceId = deviceId, Signal = "RP_POS_255", WebMiKey = "RP_POS_255", Unit = "kW", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "RP_NEG_255", WebMiKey = "RP_NEG_255", Unit = "kW", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "IP_POS_255", WebMiKey = "IP_POS_255", Unit = "kVAR", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "IP_NEG_255", WebMiKey = "IP_NEG_255", Unit = "kVAR", Scale = 100, Enabled = true },
            new TagMap { DeviceId = deviceId, Signal = "AP_255", WebMiKey = "AP_255", Unit = "kVA", Scale = 100, Enabled = true }
        };

        // Save to database
        await _deviceRegistry.UpdateTagMappingsAsync(deviceId, defaultTagMappings);

        _logger.LogInformation("Created {Count} complete tag mappings for device {DeviceId}", defaultTagMappings.Count, deviceId);

        return defaultTagMappings;
    }
}

/// <summary>
/// Request model for toggling device status
/// </summary>
public class ToggleDeviceRequest
{
    public bool Enabled { get; set; }
}

/// <summary>
/// Request model for updating tag mappings enabled status
/// </summary>
public class UpdateTagMappingsEnabledRequest
{
    public List<string> EnabledSignals { get; set; } = new();
}


