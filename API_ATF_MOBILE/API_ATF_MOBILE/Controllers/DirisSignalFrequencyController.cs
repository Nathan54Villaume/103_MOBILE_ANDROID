using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Dapper;
using Diris.Core.Interfaces;
using Diris.Core.Models;

namespace API_ATF_MOBILE.Controllers;

/// <summary>
/// Contrôleur pour gérer les fréquences d'enregistrement des signaux DIRIS
/// </summary>
[ApiController]
[Route("api/diris/signals/frequency")]
public class DirisSignalFrequencyController : ControllerBase
{
    private readonly IDeviceRegistry _deviceRegistry;
    private readonly ILogger<DirisSignalFrequencyController> _logger;
    private readonly string _connectionString;
    
    // Stockage temporaire des presets
    private static Dictionary<string, SignalPreset> _signalPresets = new();

    public DirisSignalFrequencyController(
        IDeviceRegistry deviceRegistry,
        ILogger<DirisSignalFrequencyController> logger,
        IConfiguration configuration)
    {
        _deviceRegistry = deviceRegistry;
        _logger = logger;
        _connectionString = configuration.GetConnectionString("SqlAiAtr")
            ?? throw new InvalidOperationException("ConnectionStrings:SqlAiAtr manquante");
    }

    /// <summary>
    /// Obtient les fréquences d'enregistrement pour tous les signaux d'un device
    /// </summary>
    [HttpGet("device/{deviceId}")]
    public async Task<IActionResult> GetSignalFrequencies(int deviceId)
    {
        try
        {
            var device = await _deviceRegistry.GetDeviceAsync(deviceId);
            if (device == null)
            {
                return NotFound(new { success = false, message = "Device not found" });
            }

            var tagMappings = await _deviceRegistry.GetTagMappingsAsync(deviceId);
            
            var frequencies = tagMappings.Select(tm => new
            {
                tm.Signal,
                tm.Description,
                tm.Unit,
                tm.Enabled,
                RecordingFrequencyMs = tm.RecordingFrequencyMs, // Utiliser la valeur de la base de données
                RecordingFrequencySeconds = tm.RecordingFrequencyMs / 1000.0,
                FrequencyDescription = GetFrequencyDescription(tm.RecordingFrequencyMs)
            }).ToList();

            return Ok(new
            {
                success = true,
                deviceId = deviceId,
                deviceName = device.Name,
                signalCount = frequencies.Count,
                frequencies = frequencies
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting signal frequencies for device {DeviceId}", deviceId);
            return StatusCode(500, new { success = false, message = "Error getting signal frequencies" });
        }
    }

    /// <summary>
    /// Met à jour la fréquence d'enregistrement d'un signal
    /// </summary>
    [HttpPut("device/{deviceId}/signal/{signal}")]
    public async Task<IActionResult> UpdateSignalFrequency(int deviceId, string signal, [FromBody] UpdateFrequencyRequest request)
    {
        try
        {
            // Valider la fréquence (entre 1s et 10min)
            if (request.RecordingFrequencyMs < 1000 || request.RecordingFrequencyMs > 600000)
            {
                return BadRequest(new { success = false, message = "Frequency must be between 1000ms (1s) and 600000ms (10min)" });
            }

            var device = await _deviceRegistry.GetDeviceAsync(deviceId);
            if (device == null)
            {
                return NotFound(new { success = false, message = "Device not found" });
            }

            // Mettre à jour dans la base de données
            using var connection = new SqlConnection(_connectionString);
            
            var sql = @"
                UPDATE [DIRIS].[TagMap] 
                SET RecordingFrequencyMs = @Frequency 
                WHERE DeviceId = @DeviceId AND Signal = @Signal";
            
            var rowsAffected = await connection.ExecuteAsync(sql, new
            {
                DeviceId = deviceId,
                Signal = signal,
                Frequency = request.RecordingFrequencyMs
            });

            if (rowsAffected == 0)
            {
                return NotFound(new { success = false, message = "Signal not found" });
            }

            _logger.LogInformation("Updated recording frequency for signal {Signal} on device {DeviceId} to {Frequency}ms", 
                signal, deviceId, request.RecordingFrequencyMs);

            return Ok(new
            {
                success = true,
                message = $"Frequency updated to {request.RecordingFrequencyMs}ms ({request.RecordingFrequencyMs / 1000.0}s)",
                deviceId = deviceId,
                signal = signal,
                recordingFrequencyMs = request.RecordingFrequencyMs,
                recordingFrequencySeconds = request.RecordingFrequencyMs / 1000.0,
                frequencyDescription = GetFrequencyDescription(request.RecordingFrequencyMs)
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating frequency for signal {Signal} on device {DeviceId}", signal, deviceId);
            return StatusCode(500, new { success = false, message = "Error updating signal frequency" });
        }
    }

    /// <summary>
    /// Met à jour les fréquences de plusieurs signaux en lot
    /// </summary>
    [HttpPut("device/{deviceId}/bulk")]
    public async Task<IActionResult> UpdateBulkFrequencies(int deviceId, [FromBody] BulkUpdateFrequencyRequest request)
    {
        try
        {
            var device = await _deviceRegistry.GetDeviceAsync(deviceId);
            if (device == null)
            {
                return NotFound(new { success = false, message = "Device not found" });
            }

            // Valider toutes les fréquences
            var invalidSignals = request.Frequencies.Where(f => f.RecordingFrequencyMs < 1000 || f.RecordingFrequencyMs > 600000).ToList();
            if (invalidSignals.Any())
            {
                return BadRequest(new { 
                    success = false, 
                    message = "Invalid frequencies detected", 
                    invalidSignals = invalidSignals.Select(s => new { s.Signal, s.RecordingFrequencyMs })
                });
            }

            using var connection = new SqlConnection(_connectionString);
            
            var updatedCount = 0;
            var errors = new List<string>();

            foreach (var freq in request.Frequencies)
            {
                try
                {
                    var sql = @"
                        UPDATE [DIRIS].[TagMap] 
                        SET RecordingFrequencyMs = @Frequency 
                        WHERE DeviceId = @DeviceId AND Signal = @Signal";
                    
                    var rowsAffected = await connection.ExecuteAsync(sql, new
                    {
                        DeviceId = deviceId,
                        Signal = freq.Signal,
                        Frequency = freq.RecordingFrequencyMs
                    });

                    if (rowsAffected > 0)
                    {
                        updatedCount++;
                    }
                }
                catch (Exception ex)
                {
                    errors.Add($"Error updating {freq.Signal}: {ex.Message}");
                }
            }

            _logger.LogInformation("Bulk updated {Count} signal frequencies for device {DeviceId}", updatedCount, deviceId);

            return Ok(new
            {
                success = true,
                message = $"Updated {updatedCount} signal frequencies",
                deviceId = deviceId,
                totalRequested = request.Frequencies.Count,
                updatedCount = updatedCount,
                errors = errors
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error bulk updating frequencies for device {DeviceId}", deviceId);
            return StatusCode(500, new { success = false, message = "Error bulk updating signal frequencies" });
        }
    }

    /// <summary>
    /// Applique des fréquences prédéfinies par type de signal
    /// </summary>
    [HttpPost("device/{deviceId}/apply-presets")]
    public async Task<IActionResult> ApplyPresetsToDevice(int deviceId)
    {
        try
        {
            var device = await _deviceRegistry.GetDeviceAsync(deviceId);
            if (device == null)
            {
                return NotFound(new { success = false, message = "Device not found" });
            }

            if (_signalPresets == null || !_signalPresets.Any())
            {
                return BadRequest(new { success = false, message = "No presets configured. Please save a preset configuration first." });
            }

            var tagMappings = await _deviceRegistry.GetTagMappingsAsync(deviceId);
            var updatedCount = 0;
            var signalsNotFound = new List<string>();

            using var connection = new SqlConnection(_connectionString);
            await connection.OpenAsync();

            using var transaction = connection.BeginTransaction();

            foreach (var mapping in tagMappings)
            {
                if (_signalPresets.TryGetValue(mapping.Signal, out var preset))
                {
                    var sql = @"
                        UPDATE [DIRIS].[TagMap] 
                        SET RecordingFrequencyMs = @Frequency, Enabled = @Enabled
                        WHERE DeviceId = @DeviceId AND Signal = @Signal";
                    
                    var rowsAffected = await connection.ExecuteAsync(sql, new
                    {
                        DeviceId = deviceId,
                        Signal = mapping.Signal,
                        Frequency = preset.RecordingFrequencyMs,
                        Enabled = preset.Enabled
                    }, transaction);

                    if (rowsAffected > 0)
                    {
                        updatedCount++;
                    }
                }
                else
                {
                    signalsNotFound.Add(mapping.Signal);
                }
            }

            await transaction.CommitAsync();

            _logger.LogInformation("Applied presets to {Count} signals for device {DeviceId}", updatedCount, deviceId);

            return Ok(new
            {
                success = true,
                message = $"Applied presets to {updatedCount} signals",
                deviceId = deviceId,
                updatedCount = updatedCount,
                signalsNotFoundInPreset = signalsNotFound
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error applying presets for device {DeviceId}", deviceId);
            return StatusCode(500, new { success = false, message = "Error applying presets" });
        }
    }

    /// <summary>
    /// Obtient les fréquences prédéfinies disponibles
    /// </summary>
    [HttpGet("presets")]
    public IActionResult GetFrequencyPresets()
    {
        var presets = new[]
        {
            new { Value = 1000, Label = "1 seconde", Description = "Critique - Courants, tensions, fréquence" },
            new { Value = 2000, Label = "2 secondes", Description = "Puissances actives/réactives/apparentes" },
            new { Value = 5000, Label = "5 secondes", Description = "THD (distorsion harmonique)" },
            new { Value = 10000, Label = "10 secondes", Description = "Moyennes et maximums" },
            new { Value = 30000, Label = "30 secondes", Description = "Énergies (compteurs)" },
            new { Value = 60000, Label = "1 minute", Description = "Surveillance générale" },
            new { Value = 300000, Label = "5 minutes", Description = "Surveillance lente" },
            new { Value = 600000, Label = "10 minutes", Description = "Surveillance très lente" }
        };

        return Ok(new
        {
            success = true,
            presets = presets,
            currentPresets = _signalPresets.ToDictionary(
                kvp => kvp.Key,
                kvp => new { kvp.Value.RecordingFrequencyMs, kvp.Value.Enabled }
            )
        });
    }

    /// <summary>
    /// Sauvegarde la configuration des presets par défaut
    /// </summary>
    [HttpPost("presets")]
    public async Task<IActionResult> SaveFrequencyPresets([FromBody] SavePresetsWithSignalsRequest request)
    {
        try
        {
            // Sauvegarder les presets dans la variable statique
            _signalPresets = request.Signals ?? new Dictionary<string, SignalPreset>();
            
            _logger.LogInformation("Signal presets updated for {Count} signals.", _signalPresets.Count);

            return Ok(new
            {
                success = true,
                message = "Configuration des presets sauvegardée",
                presetsCount = _signalPresets.Count
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving frequency presets");
            return StatusCode(500, new { success = false, message = "Error saving frequency presets" });
        }
    }

    #region Helper Methods

    /// <summary>
    /// Obtient la fréquence par défaut selon le type de signal (hardcodée)
    /// </summary>
    private int GetDefaultFrequencyForSignal(string signal)
    {
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
    /// Obtient la fréquence configurée selon le type de signal (utilise les presets sauvegardés)
    /// </summary>
    private int GetConfiguredFrequencyForSignal(string signal)
    {
        return _signalPresets.TryGetValue(signal, out var preset) ? preset.RecordingFrequencyMs : GetDefaultFrequencyForSignal(signal);
    }

    /// <summary>
    /// Obtient une description lisible de la fréquence
    /// </summary>
    private string GetFrequencyDescription(int frequencyMs)
    {
        return frequencyMs switch
        {
            1000 => "1 seconde",
            2000 => "2 secondes",
            5000 => "5 secondes",
            10000 => "10 secondes",
            30000 => "30 secondes",
            60000 => "1 minute",
            300000 => "5 minutes",
            600000 => "10 minutes",
            _ => $"{frequencyMs / 1000.0} secondes"
        };
    }

    #endregion
}

/// <summary>
/// Modèle de requête pour mettre à jour une fréquence
/// </summary>
public class UpdateFrequencyRequest
{
    public int RecordingFrequencyMs { get; set; }
}

/// <summary>
/// Modèle de requête pour mise à jour en lot
/// </summary>
public class BulkUpdateFrequencyRequest
{
    public List<SignalFrequencyUpdate> Frequencies { get; set; } = new();
}

/// <summary>
/// Modèle pour une mise à jour de fréquence individuelle
/// </summary>
public class SignalFrequencyUpdate
{
    public string Signal { get; set; } = string.Empty;
    public int RecordingFrequencyMs { get; set; }
}

/// <summary>
/// Modèle pour un preset de signal individuel
/// </summary>
public class SignalPreset
{
    public int RecordingFrequencyMs { get; set; }
    public bool Enabled { get; set; }
}

/// <summary>
/// Modèle pour sauvegarder la configuration complète des presets
/// </summary>
public class SavePresetsWithSignalsRequest
{
    public Dictionary<string, SignalPreset> Signals { get; set; } = new();
}
