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
        var deviceDtos = new List<DeviceDto>();

        foreach (var device in devices)
        {
            var tagMappings = await _deviceRegistry.GetTagMappingsAsync(device.DeviceId);
            deviceDtos.Add(new DeviceDto(device)
            {
                TotalSignalCount = tagMappings.Count(),
                ActiveSignalCount = tagMappings.Count(t => t.Enabled)
            });
        }
        
        return Ok(deviceDtos);
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
    /// Updates descriptions for all tag mappings
    /// </summary>
    [HttpPost("tagmaps/update-descriptions")]
    public async Task<IActionResult> UpdateTagMapDescriptions()
    {
        try
        {
            var devices = await _deviceRegistry.GetAllDevicesAsync();
            var totalUpdated = 0;

            foreach (var device in devices)
            {
                var tagMappings = await _deviceRegistry.GetTagMappingsAsync(device.DeviceId);
                var updatedMappings = new List<TagMap>();

                foreach (var mapping in tagMappings)
                {
                    // Mettre à jour la description selon le signal
                    mapping.Description = GetSignalDescription(mapping.Signal);
                    updatedMappings.Add(mapping);
                }

                if (updatedMappings.Any())
                {
                    await _deviceRegistry.UpdateTagMappingsAsync(device.DeviceId, updatedMappings);
                    totalUpdated += updatedMappings.Count;
                }
            }

            _logger.LogInformation("Updated descriptions for {Count} tag mappings across {DeviceCount} devices", 
                totalUpdated, devices.Count());

            return Ok(new { 
                success = true, 
                message = $"Descriptions updated for {totalUpdated} signals across {devices.Count()} devices",
                totalUpdated = totalUpdated,
                deviceCount = devices.Count()
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating tag map descriptions");
            return StatusCode(500, "Error updating descriptions");
        }
    }

    /// <summary>
    /// Gets the description for a signal
    /// </summary>
    private string GetSignalDescription(string signal)
    {
        return signal switch
        {
            // COURANTS (A)
            "I_PH1_255" => "Courant phase 1",
            "I_PH2_255" => "Courant phase 2",
            "I_PH3_255" => "Courant phase 3",
            "I_NUL_255" => "Courant neutre",
            "MAXAVGSUM_I1_255" => "Courant phase 1 - Maximum moyenne",
            "MAXAVGSUM_I2_255" => "Courant phase 2 - Maximum moyenne",
            "MAXAVGSUM_I3_255" => "Courant phase 3 - Maximum moyenne",
            "MAXAVG_IN_255" => "Courant neutre - Maximum moyenne",
            "AVG_I1_255" => "Courant phase 1 - Moyenne",
            "AVG_I2_255" => "Courant phase 2 - Moyenne",
            "AVG_I3_255" => "Courant phase 3 - Moyenne",
            "AVG_IN_255" => "Courant neutre - Moyenne",

            // THD COURANTS
            "THD_I1_255" => "THD courant phase 1",
            "THD_I2_255" => "THD courant phase 2",
            "THD_I3_255" => "THD courant phase 3",
            "THD_IN_255" => "THD courant neutre",

            // FRÉQUENCE
            "F_255" => "Fréquence réseau",

            // THD TENSIONS
            "THD_U1_255" => "THD tension phase 1",
            "THD_U2_255" => "THD tension phase 2",
            "THD_U3_255" => "THD tension phase 3",
            "THD_U12_255" => "THD tension phase-phase 12",
            "THD_U23_255" => "THD tension phase-phase 23",
            "THD_U31_255" => "THD tension phase-phase 31",

            // TENSIONS PHASE-NEUTRE
            "PV1_255" => "Tension phase 1 - neutre",
            "PV2_255" => "Tension phase 2 - neutre",
            "PV3_255" => "Tension phase 3 - neutre",
            "MAXAVG_V1_255" => "Tension phase 1 - Maximum moyenne",
            "MAXAVG_V2_255" => "Tension phase 2 - Maximum moyenne",
            "MAXAVG_V3_255" => "Tension phase 3 - Maximum moyenne",
            "AVG_V1_255" => "Tension phase 1 - Moyenne",
            "AVG_V2_255" => "Tension phase 2 - Moyenne",
            "AVG_V3_255" => "Tension phase 3 - Moyenne",

            // TENSIONS PHASE-PHASE
            "LV_U12_255" => "Tension phase-phase 12",
            "LV_U23_255" => "Tension phase-phase 23",
            "LV_U31_255" => "Tension phase-phase 31",
            "MAXAVG_U12_255" => "Tension phase-phase 12 - Maximum moyenne",
            "MAXAVG_U23_255" => "Tension phase-phase 23 - Maximum moyenne",
            "MAXAVG_U31_255" => "Tension phase-phase 31 - Maximum moyenne",
            "AVG_U12_255" => "Tension phase-phase 12 - Moyenne",
            "AVG_U23_255" => "Tension phase-phase 23 - Moyenne",
            "AVG_U31_255" => "Tension phase-phase 31 - Moyenne",

            // PUISSANCES ACTIVES (kW)
            "PH1_RP_255" => "Puissance active phase 1",
            "PH2_RP_255" => "Puissance active phase 2",
            "PH3_RP_255" => "Puissance active phase 3",
            "SUM_RP_255" => "Puissance active totale",
            "MAXAVGSUM_RPPOS_255" => "Puissance active positive - Maximum moyenne",
            "AVGSUM_RPPOS_255" => "Puissance active positive - Moyenne",
            "PRED_RP_255" => "Puissance active prédictive",
            "MAXAVGSUM_RPNEG_255" => "Puissance active négative - Maximum moyenne",
            "AVGSUM_RPNEG_255" => "Puissance active négative - Moyenne",

            // PUISSANCES RÉACTIVES (kVAR)
            "PH1_IP_255" => "Puissance réactive phase 1",
            "PH2_IP_255" => "Puissance réactive phase 2",
            "PH3_IP_255" => "Puissance réactive phase 3",
            "SUM_IP_255" => "Puissance réactive totale",
            "MAXAVGSUM_IPPOS_255" => "Puissance réactive positive - Maximum moyenne",
            "AVGSUM_IPPOS_255" => "Puissance réactive positive - Moyenne",
            "PRED_IP_255" => "Puissance réactive prédictive",
            "MAXAVGSUM_IPNEG_255" => "Puissance réactive négative - Maximum moyenne",
            "AVGSUM_IPNEG_255" => "Puissance réactive négative - Moyenne",

            // PUISSANCES APPARENTES (kVA)
            "PH1_AP_255" => "Puissance apparente phase 1",
            "PH2_AP_255" => "Puissance apparente phase 2",
            "PH3_AP_255" => "Puissance apparente phase 3",
            "SUM_AP_255" => "Puissance apparente totale",
            "MAXAVGSUM_AP_255" => "Puissance apparente - Maximum moyenne",
            "AVGSUM_AP_255" => "Puissance apparente - Moyenne",
            "PRED_AP_255" => "Puissance apparente prédictive",

            // FACTEURS DE PUISSANCE (%)
            "PH1_PF_255" => "Facteur de puissance phase 1",
            "PH2_PF_255" => "Facteur de puissance phase 2",
            "PH3_PF_255" => "Facteur de puissance phase 3",
            "SUM_PF_255" => "Facteur de puissance total",

            // ÉNERGIES (kWh)
            "E1_255" => "Énergie compteur 1",
            "E2_255" => "Énergie compteur 2",
            "E3_255" => "Énergie compteur 3",
            "E4_255" => "Énergie compteur 4",
            "E5_255" => "Énergie compteur 5",
            "E6_255" => "Énergie compteur 6",

            // TOTAUX CUMULATIFS
            "RP_POS_255" => "Puissance active positive cumulée",
            "RP_NEG_255" => "Puissance active négative cumulée",
            "IP_POS_255" => "Puissance réactive positive cumulée",
            "IP_NEG_255" => "Puissance réactive négative cumulée",
            "AP_255" => "Puissance apparente cumulée",

            _ => $"Signal {signal}"
        };
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
            new TagMap { DeviceId = deviceId, Signal = "I_PH1_255", WebMiKey = "I_PH1_255", Unit = "A", Scale = 1000, Enabled = true, Description = GetSignalDescription("I_PH1_255") },
            new TagMap { DeviceId = deviceId, Signal = "I_PH2_255", WebMiKey = "I_PH2_255", Unit = "A", Scale = 1000, Enabled = true, Description = GetSignalDescription("I_PH2_255") },
            new TagMap { DeviceId = deviceId, Signal = "I_PH3_255", WebMiKey = "I_PH3_255", Unit = "A", Scale = 1000, Enabled = true, Description = GetSignalDescription("I_PH3_255") },
            new TagMap { DeviceId = deviceId, Signal = "I_NUL_255", WebMiKey = "I_NUL_255", Unit = "A", Scale = 1000, Enabled = true, Description = GetSignalDescription("I_NUL_255") },
            new TagMap { DeviceId = deviceId, Signal = "MAXAVGSUM_I1_255", WebMiKey = "MAXAVGSUM_I1_255", Unit = "A", Scale = 1000, Enabled = true, Description = GetSignalDescription("MAXAVGSUM_I1_255") },
            new TagMap { DeviceId = deviceId, Signal = "MAXAVGSUM_I2_255", WebMiKey = "MAXAVGSUM_I2_255", Unit = "A", Scale = 1000, Enabled = true, Description = GetSignalDescription("MAXAVGSUM_I2_255") },
            new TagMap { DeviceId = deviceId, Signal = "MAXAVGSUM_I3_255", WebMiKey = "MAXAVGSUM_I3_255", Unit = "A", Scale = 1000, Enabled = true, Description = GetSignalDescription("MAXAVGSUM_I3_255") },
            new TagMap { DeviceId = deviceId, Signal = "MAXAVG_IN_255", WebMiKey = "MAXAVG_IN_255", Unit = "A", Scale = 1000, Enabled = true, Description = GetSignalDescription("MAXAVG_IN_255") },
            new TagMap { DeviceId = deviceId, Signal = "AVG_I1_255", WebMiKey = "AVG_I1_255", Unit = "A", Scale = 1000, Enabled = true, Description = GetSignalDescription("AVG_I1_255") },
            new TagMap { DeviceId = deviceId, Signal = "AVG_I2_255", WebMiKey = "AVG_I2_255", Unit = "A", Scale = 1000, Enabled = true, Description = GetSignalDescription("AVG_I2_255") },
            new TagMap { DeviceId = deviceId, Signal = "AVG_I3_255", WebMiKey = "AVG_I3_255", Unit = "A", Scale = 1000, Enabled = true, Description = GetSignalDescription("AVG_I3_255") },
            new TagMap { DeviceId = deviceId, Signal = "AVG_IN_255", WebMiKey = "AVG_IN_255", Unit = "A", Scale = 1000, Enabled = true, Description = GetSignalDescription("AVG_IN_255") },
            
            // ========== THD COURANTS (%) - Scale 100 ==========
            new TagMap { DeviceId = deviceId, Signal = "THD_I1_255", WebMiKey = "THD_I1_255", Unit = "%", Scale = 100, Enabled = true, Description = GetSignalDescription("THD_I1_255") },
            new TagMap { DeviceId = deviceId, Signal = "THD_I2_255", WebMiKey = "THD_I2_255", Unit = "%", Scale = 100, Enabled = true, Description = GetSignalDescription("THD_I2_255") },
            new TagMap { DeviceId = deviceId, Signal = "THD_I3_255", WebMiKey = "THD_I3_255", Unit = "%", Scale = 100, Enabled = true, Description = GetSignalDescription("THD_I3_255") },
            new TagMap { DeviceId = deviceId, Signal = "THD_IN_255", WebMiKey = "THD_IN_255", Unit = "", Scale = 1, Enabled = true, Description = GetSignalDescription("THD_IN_255") },
            
            // ========== FRÃ‰QUENCE (Hz) - Scale 100 ==========
            new TagMap { DeviceId = deviceId, Signal = "F_255", WebMiKey = "F_255", Unit = "Hz", Scale = 100, Enabled = true, Description = GetSignalDescription("F_255") },
            
            // ========== THD TENSIONS - Scale 1 ou 100 selon le signal ==========
            new TagMap { DeviceId = deviceId, Signal = "THD_U1_255", WebMiKey = "THD_U1_255", Unit = "", Scale = 1, Enabled = true, Description = GetSignalDescription("THD_U1_255") },
            new TagMap { DeviceId = deviceId, Signal = "THD_U2_255", WebMiKey = "THD_U2_255", Unit = "", Scale = 1, Enabled = true, Description = GetSignalDescription("THD_U2_255") },
            new TagMap { DeviceId = deviceId, Signal = "THD_U3_255", WebMiKey = "THD_U3_255", Unit = "", Scale = 1, Enabled = true, Description = GetSignalDescription("THD_U3_255") },
            new TagMap { DeviceId = deviceId, Signal = "THD_U12_255", WebMiKey = "THD_U12_255", Unit = "%", Scale = 100, Enabled = true, Description = GetSignalDescription("THD_U12_255") },
            new TagMap { DeviceId = deviceId, Signal = "THD_U23_255", WebMiKey = "THD_U23_255", Unit = "%", Scale = 100, Enabled = true, Description = GetSignalDescription("THD_U23_255") },
            new TagMap { DeviceId = deviceId, Signal = "THD_U31_255", WebMiKey = "THD_U31_255", Unit = "%", Scale = 100, Enabled = true, Description = GetSignalDescription("THD_U31_255") },
            
            // ========== TENSIONS PHASE-NEUTRE (V) - Scale 100 ==========
            new TagMap { DeviceId = deviceId, Signal = "PV1_255", WebMiKey = "PV1_255", Unit = "V", Scale = 100, Enabled = true, Description = GetSignalDescription("PV1_255") },
            new TagMap { DeviceId = deviceId, Signal = "PV2_255", WebMiKey = "PV2_255", Unit = "V", Scale = 100, Enabled = true, Description = GetSignalDescription("PV2_255") },
            new TagMap { DeviceId = deviceId, Signal = "PV3_255", WebMiKey = "PV3_255", Unit = "V", Scale = 100, Enabled = true, Description = GetSignalDescription("PV3_255") },
            new TagMap { DeviceId = deviceId, Signal = "MAXAVG_V1_255", WebMiKey = "MAXAVG_V1_255", Unit = "V", Scale = 100, Enabled = true, Description = GetSignalDescription("MAXAVG_V1_255") },
            new TagMap { DeviceId = deviceId, Signal = "MAXAVG_V2_255", WebMiKey = "MAXAVG_V2_255", Unit = "V", Scale = 100, Enabled = true, Description = GetSignalDescription("MAXAVG_V2_255") },
            new TagMap { DeviceId = deviceId, Signal = "MAXAVG_V3_255", WebMiKey = "MAXAVG_V3_255", Unit = "V", Scale = 100, Enabled = true, Description = GetSignalDescription("MAXAVG_V3_255") },
            new TagMap { DeviceId = deviceId, Signal = "AVG_V1_255", WebMiKey = "AVG_V1_255", Unit = "V", Scale = 100, Enabled = true, Description = GetSignalDescription("AVG_V1_255") },
            new TagMap { DeviceId = deviceId, Signal = "AVG_V2_255", WebMiKey = "AVG_V2_255", Unit = "V", Scale = 100, Enabled = true, Description = GetSignalDescription("AVG_V2_255") },
            new TagMap { DeviceId = deviceId, Signal = "AVG_V3_255", WebMiKey = "AVG_V3_255", Unit = "V", Scale = 100, Enabled = true, Description = GetSignalDescription("AVG_V3_255") },
            
            // ========== TENSIONS PHASE-PHASE (V) - Scale 100 ==========
            new TagMap { DeviceId = deviceId, Signal = "LV_U12_255", WebMiKey = "LV_U12_255", Unit = "V", Scale = 100, Enabled = true, Description = GetSignalDescription("LV_U12_255") },
            new TagMap { DeviceId = deviceId, Signal = "LV_U23_255", WebMiKey = "LV_U23_255", Unit = "V", Scale = 100, Enabled = true, Description = GetSignalDescription("LV_U23_255") },
            new TagMap { DeviceId = deviceId, Signal = "LV_U31_255", WebMiKey = "LV_U31_255", Unit = "V", Scale = 100, Enabled = true, Description = GetSignalDescription("LV_U31_255") },
            new TagMap { DeviceId = deviceId, Signal = "MAXAVG_U12_255", WebMiKey = "MAXAVG_U12_255", Unit = "V", Scale = 100, Enabled = true, Description = GetSignalDescription("MAXAVG_U12_255") },
            new TagMap { DeviceId = deviceId, Signal = "MAXAVG_U23_255", WebMiKey = "MAXAVG_U23_255", Unit = "V", Scale = 100, Enabled = true, Description = GetSignalDescription("MAXAVG_U23_255") },
            new TagMap { DeviceId = deviceId, Signal = "MAXAVG_U31_255", WebMiKey = "MAXAVG_U31_255", Unit = "V", Scale = 100, Enabled = true, Description = GetSignalDescription("MAXAVG_U31_255") },
            new TagMap { DeviceId = deviceId, Signal = "AVG_U12_255", WebMiKey = "AVG_U12_255", Unit = "V", Scale = 100, Enabled = true, Description = GetSignalDescription("AVG_U12_255") },
            new TagMap { DeviceId = deviceId, Signal = "AVG_U23_255", WebMiKey = "AVG_U23_255", Unit = "V", Scale = 100, Enabled = true, Description = GetSignalDescription("AVG_U23_255") },
            new TagMap { DeviceId = deviceId, Signal = "AVG_U31_255", WebMiKey = "AVG_U31_255", Unit = "V", Scale = 100, Enabled = true, Description = GetSignalDescription("AVG_U31_255") },
            
            // ========== PUISSANCES ACTIVES (kW) - Scale 100 ==========
            new TagMap { DeviceId = deviceId, Signal = "PH1_RP_255", WebMiKey = "PH1_RP_255", Unit = "kW", Scale = 100, Enabled = true, Description = GetSignalDescription("PH1_RP_255") },
            new TagMap { DeviceId = deviceId, Signal = "PH2_RP_255", WebMiKey = "PH2_RP_255", Unit = "kW", Scale = 100, Enabled = true, Description = GetSignalDescription("PH2_RP_255") },
            new TagMap { DeviceId = deviceId, Signal = "PH3_RP_255", WebMiKey = "PH3_RP_255", Unit = "kW", Scale = 100, Enabled = true, Description = GetSignalDescription("PH3_RP_255") },
            new TagMap { DeviceId = deviceId, Signal = "SUM_RP_255", WebMiKey = "SUM_RP_255", Unit = "kW", Scale = 100, Enabled = true, Description = GetSignalDescription("SUM_RP_255") },
            new TagMap { DeviceId = deviceId, Signal = "MAXAVGSUM_RPPOS_255", WebMiKey = "MAXAVGSUM_RPPOS_255", Unit = "kW", Scale = 100, Enabled = true, Description = GetSignalDescription("MAXAVGSUM_RPPOS_255") },
            new TagMap { DeviceId = deviceId, Signal = "AVGSUM_RPPOS_255", WebMiKey = "AVGSUM_RPPOS_255", Unit = "kW", Scale = 100, Enabled = true, Description = GetSignalDescription("AVGSUM_RPPOS_255") },
            new TagMap { DeviceId = deviceId, Signal = "PRED_RP_255", WebMiKey = "PRED_RP_255", Unit = "kW", Scale = 100, Enabled = true, Description = GetSignalDescription("PRED_RP_255") },
            new TagMap { DeviceId = deviceId, Signal = "MAXAVGSUM_RPNEG_255", WebMiKey = "MAXAVGSUM_RPNEG_255", Unit = "kW", Scale = 100, Enabled = true, Description = GetSignalDescription("MAXAVGSUM_RPNEG_255") },
            new TagMap { DeviceId = deviceId, Signal = "AVGSUM_RPNEG_255", WebMiKey = "AVGSUM_RPNEG_255", Unit = "kW", Scale = 100, Enabled = true, Description = GetSignalDescription("AVGSUM_RPNEG_255") },
            
            // ========== PUISSANCES RÃ‰ACTIVES (kVAR) - Scale 100 ==========
            new TagMap { DeviceId = deviceId, Signal = "PH1_IP_255", WebMiKey = "PH1_IP_255", Unit = "kVAR", Scale = 100, Enabled = true, Description = GetSignalDescription("PH1_IP_255") },
            new TagMap { DeviceId = deviceId, Signal = "PH2_IP_255", WebMiKey = "PH2_IP_255", Unit = "kVAR", Scale = 100, Enabled = true, Description = GetSignalDescription("PH2_IP_255") },
            new TagMap { DeviceId = deviceId, Signal = "PH3_IP_255", WebMiKey = "PH3_IP_255", Unit = "kVAR", Scale = 100, Enabled = true, Description = GetSignalDescription("PH3_IP_255") },
            new TagMap { DeviceId = deviceId, Signal = "SUM_IP_255", WebMiKey = "SUM_IP_255", Unit = "kVAR", Scale = 100, Enabled = true, Description = GetSignalDescription("SUM_IP_255") },
            new TagMap { DeviceId = deviceId, Signal = "MAXAVGSUM_IPPOS_255", WebMiKey = "MAXAVGSUM_IPPOS_255", Unit = "kVAR", Scale = 100, Enabled = true, Description = GetSignalDescription("MAXAVGSUM_IPPOS_255") },
            new TagMap { DeviceId = deviceId, Signal = "AVGSUM_IPPOS_255", WebMiKey = "AVGSUM_IPPOS_255", Unit = "kVAR", Scale = 100, Enabled = true, Description = GetSignalDescription("AVGSUM_IPPOS_255") },
            new TagMap { DeviceId = deviceId, Signal = "PRED_IP_255", WebMiKey = "PRED_IP_255", Unit = "kVAR", Scale = 100, Enabled = true, Description = GetSignalDescription("PRED_IP_255") },
            new TagMap { DeviceId = deviceId, Signal = "MAXAVGSUM_IPNEG_255", WebMiKey = "MAXAVGSUM_IPNEG_255", Unit = "kVAR", Scale = 100, Enabled = true, Description = GetSignalDescription("MAXAVGSUM_IPNEG_255") },
            new TagMap { DeviceId = deviceId, Signal = "AVGSUM_IPNEG_255", WebMiKey = "AVGSUM_IPNEG_255", Unit = "kVAR", Scale = 100, Enabled = true, Description = GetSignalDescription("AVGSUM_IPNEG_255") },
            
            // ========== PUISSANCES APPARENTES (kVA) - Scale 100 ==========
            new TagMap { DeviceId = deviceId, Signal = "PH1_AP_255", WebMiKey = "PH1_AP_255", Unit = "kVA", Scale = 100, Enabled = true, Description = GetSignalDescription("PH1_AP_255") },
            new TagMap { DeviceId = deviceId, Signal = "PH2_AP_255", WebMiKey = "PH2_AP_255", Unit = "kVA", Scale = 100, Enabled = true, Description = GetSignalDescription("PH2_AP_255") },
            new TagMap { DeviceId = deviceId, Signal = "PH3_AP_255", WebMiKey = "PH3_AP_255", Unit = "kVA", Scale = 100, Enabled = true, Description = GetSignalDescription("PH3_AP_255") },
            new TagMap { DeviceId = deviceId, Signal = "SUM_AP_255", WebMiKey = "SUM_AP_255", Unit = "kVA", Scale = 100, Enabled = true, Description = GetSignalDescription("SUM_AP_255") },
            new TagMap { DeviceId = deviceId, Signal = "MAXAVGSUM_AP_255", WebMiKey = "MAXAVGSUM_AP_255", Unit = "kVA", Scale = 100, Enabled = true, Description = GetSignalDescription("MAXAVGSUM_AP_255") },
            new TagMap { DeviceId = deviceId, Signal = "AVGSUM_AP_255", WebMiKey = "AVGSUM_AP_255", Unit = "kVA", Scale = 100, Enabled = true, Description = GetSignalDescription("AVGSUM_AP_255") },
            new TagMap { DeviceId = deviceId, Signal = "PRED_AP_255", WebMiKey = "PRED_AP_255", Unit = "kVA", Scale = 100, Enabled = true, Description = GetSignalDescription("PRED_AP_255") },
            
            // ========== FACTEURS DE PUISSANCE (%) - Scale 100 ==========
            new TagMap { DeviceId = deviceId, Signal = "PH1_PF_255", WebMiKey = "PH1_PF_255", Unit = "%", Scale = 100, Enabled = true, Description = GetSignalDescription("PH1_PF_255") },
            new TagMap { DeviceId = deviceId, Signal = "PH2_PF_255", WebMiKey = "PH2_PF_255", Unit = "%", Scale = 100, Enabled = true, Description = GetSignalDescription("PH2_PF_255") },
            new TagMap { DeviceId = deviceId, Signal = "PH3_PF_255", WebMiKey = "PH3_PF_255", Unit = "%", Scale = 100, Enabled = true, Description = GetSignalDescription("PH3_PF_255") },
            new TagMap { DeviceId = deviceId, Signal = "SUM_PF_255", WebMiKey = "SUM_PF_255", Unit = "%", Scale = 100, Enabled = true, Description = GetSignalDescription("SUM_PF_255") },
            
            // ========== Ã‰NERGIES (kWh) - Scale 100 ==========
            new TagMap { DeviceId = deviceId, Signal = "E1_255", WebMiKey = "E1_255", Unit = "kWh", Scale = 100, Enabled = true, Description = GetSignalDescription("E1_255") },
            new TagMap { DeviceId = deviceId, Signal = "E2_255", WebMiKey = "E2_255", Unit = "kWh", Scale = 100, Enabled = true, Description = GetSignalDescription("E2_255") },
            new TagMap { DeviceId = deviceId, Signal = "E3_255", WebMiKey = "E3_255", Unit = "kWh", Scale = 100, Enabled = true, Description = GetSignalDescription("E3_255") },
            new TagMap { DeviceId = deviceId, Signal = "E4_255", WebMiKey = "E4_255", Unit = "kWh", Scale = 100, Enabled = true, Description = GetSignalDescription("E4_255") },
            new TagMap { DeviceId = deviceId, Signal = "E5_255", WebMiKey = "E5_255", Unit = "kWh", Scale = 100, Enabled = true, Description = GetSignalDescription("E5_255") },
            new TagMap { DeviceId = deviceId, Signal = "E6_255", WebMiKey = "E6_255", Unit = "kWh", Scale = 100, Enabled = true, Description = GetSignalDescription("E6_255") },
            
            // ========== TOTAUX CUMULATIFS - Scale 100 ==========
            new TagMap { DeviceId = deviceId, Signal = "RP_POS_255", WebMiKey = "RP_POS_255", Unit = "kW", Scale = 100, Enabled = true, Description = GetSignalDescription("RP_POS_255") },
            new TagMap { DeviceId = deviceId, Signal = "RP_NEG_255", WebMiKey = "RP_NEG_255", Unit = "kW", Scale = 100, Enabled = true, Description = GetSignalDescription("RP_NEG_255") },
            new TagMap { DeviceId = deviceId, Signal = "IP_POS_255", WebMiKey = "IP_POS_255", Unit = "kVAR", Scale = 100, Enabled = true, Description = GetSignalDescription("IP_POS_255") },
            new TagMap { DeviceId = deviceId, Signal = "IP_NEG_255", WebMiKey = "IP_NEG_255", Unit = "kVAR", Scale = 100, Enabled = true, Description = GetSignalDescription("IP_NEG_255") },
            new TagMap { DeviceId = deviceId, Signal = "AP_255", WebMiKey = "AP_255", Unit = "kVA", Scale = 100, Enabled = true, Description = GetSignalDescription("AP_255") }
        };

        // Save to database
        await _deviceRegistry.UpdateTagMappingsAsync(deviceId, defaultTagMappings);

        _logger.LogInformation("Created {Count} complete tag mappings for device {DeviceId}", defaultTagMappings.Count, deviceId);

        return defaultTagMappings;
    }
}

/// <summary>
/// Data Transfer Object for a Device, including signal counts.
/// </summary>
public class DeviceDto : Device
{
    public int TotalSignalCount { get; set; }
    public int ActiveSignalCount { get; set; }

    public DeviceDto(Device device)
    {
        DeviceId = device.DeviceId;
        Name = device.Name;
        IpAddress = device.IpAddress;
        Protocol = device.Protocol;
        Enabled = device.Enabled;
        PollIntervalMs = device.PollIntervalMs;
        LastSeenUtc = device.LastSeenUtc;
        MetaJson = device.MetaJson;
        CreatedUtc = device.CreatedUtc;
        UpdatedUtc = device.UpdatedUtc;
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


