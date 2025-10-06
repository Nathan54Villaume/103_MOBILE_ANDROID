using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using API_ATF_MOBILE.Models;

namespace API_ATF_MOBILE.Controllers;

/// <summary>
/// Contrôleur pour la gestion de la configuration DIRIS
/// </summary>
[ApiController]
[Route("api/diris/config")]
[Authorize] // Require authentication for configuration endpoints
public class DirisConfigController : ControllerBase
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<DirisConfigController> _logger;
    private readonly string _configFilePath;

    public DirisConfigController(IConfiguration configuration, ILogger<DirisConfigController> logger)
    {
        _configuration = configuration;
        _logger = logger;
        _configFilePath = Path.Combine(Directory.GetCurrentDirectory(), "appsettings.json");
    }

    /// <summary>
    /// Obtenir la configuration DIRIS actuelle
    /// </summary>
    [HttpGet]
    public IActionResult GetConfiguration()
    {
        try
        {
            var config = new
            {
                acquisition = new
                {
                    parallelism = _configuration.GetValue<int>("Diris:Acquisition:Parallelism", 6),
                    defaultPollIntervalMs = _configuration.GetValue<int>("Diris:Acquisition:DefaultPollIntervalMs", 1500),
                    maxBatchPoints = _configuration.GetValue<int>("Diris:Acquisition:MaxBatchPoints", 1000)
                },
                dataRetention = new
                {
                    enabled = _configuration.GetValue<bool>("Diris:DataRetention:Enabled", true),
                    retentionDays = _configuration.GetValue<int>("Diris:DataRetention:RetentionDays", 10),
                    cleanupHour = _configuration.GetValue<int>("Diris:DataRetention:CleanupHour", 2)
                }
            };

            return Ok(new
            {
                success = true,
                data = config
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting DIRIS configuration");
            return StatusCode(500, new
            {
                success = false,
                message = "Failed to get configuration",
                error = ex.Message
            });
        }
    }

    /// <summary>
    /// Sauvegarder la configuration DIRIS
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> SaveConfiguration([FromBody] DirisConfigRequest request)
    {
        try
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(new
                {
                    success = false,
                    message = "Invalid configuration data",
                    errors = ModelState
                });
            }

            // Validate configuration values
            var validationResult = ValidateConfiguration(request);
            if (!validationResult.IsValid)
            {
                return BadRequest(new
                {
                    success = false,
                    message = "Configuration validation failed",
                    errors = validationResult.Errors
                });
            }

            // Backup current configuration
            await BackupCurrentConfiguration();

            // Update configuration in memory
            UpdateConfigurationInMemory(request);

            // Save to appsettings.json
            await SaveConfigurationToFile(request);

            _logger.LogInformation("DIRIS configuration updated successfully");

            return Ok(new
            {
                success = true,
                message = "Configuration saved successfully",
                data = request
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving DIRIS configuration");
            return StatusCode(500, new
            {
                success = false,
                message = "Failed to save configuration",
                error = ex.Message
            });
        }
    }

    /// <summary>
    /// Restaurer la configuration par défaut
    /// </summary>
    [HttpPost("reset")]
    public async Task<IActionResult> ResetToDefaults()
    {
        try
        {
            var defaultConfig = new DirisConfigRequest
            {
                Acquisition = new AcquisitionConfig
                {
                    Parallelism = 6,
                    DefaultPollIntervalMs = 1500,
                    MaxBatchPoints = 1000
                },
                DataRetention = new DataRetentionConfig
                {
                    Enabled = true,
                    RetentionDays = 10,
                    CleanupHour = 2
                }
            };

            await BackupCurrentConfiguration();
            await SaveConfigurationToFile(defaultConfig);

            _logger.LogInformation("DIRIS configuration reset to defaults");

            return Ok(new
            {
                success = true,
                message = "Configuration reset to defaults successfully",
                data = defaultConfig
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error resetting DIRIS configuration");
            return StatusCode(500, new
            {
                success = false,
                message = "Failed to reset configuration",
                error = ex.Message
            });
        }
    }

    private ConfigurationValidationResult ValidateConfiguration(DirisConfigRequest config)
    {
        var errors = new List<string>();

        // Validate acquisition settings
        if (config.Acquisition?.Parallelism < 1 || config.Acquisition?.Parallelism > 20)
            errors.Add("Parallelism must be between 1 and 20");

        if (config.Acquisition?.DefaultPollIntervalMs < 500 || config.Acquisition?.DefaultPollIntervalMs > 10000)
            errors.Add("Poll interval must be between 500ms and 10000ms");

        if (config.Acquisition?.MaxBatchPoints < 100 || config.Acquisition?.MaxBatchPoints > 5000)
            errors.Add("Max batch points must be between 100 and 5000");

        // Validate retention settings
        if (config.DataRetention?.RetentionDays < 1 || config.DataRetention?.RetentionDays > 365)
            errors.Add("Retention days must be between 1 and 365");

        if (config.DataRetention?.CleanupHour < 0 || config.DataRetention?.CleanupHour > 23)
            errors.Add("Cleanup hour must be between 0 and 23");

        return new ConfigurationValidationResult
        {
            IsValid = errors.Count == 0,
            Errors = errors
        };
    }

    private void UpdateConfigurationInMemory(DirisConfigRequest config)
    {
        // Update configuration in memory for immediate effect
        if (config.Acquisition != null)
        {
            _configuration["Diris:Acquisition:Parallelism"] = config.Acquisition.Parallelism.ToString();
            _configuration["Diris:Acquisition:DefaultPollIntervalMs"] = config.Acquisition.DefaultPollIntervalMs.ToString();
            _configuration["Diris:Acquisition:MaxBatchPoints"] = config.Acquisition.MaxBatchPoints.ToString();
        }

        if (config.DataRetention != null)
        {
            _configuration["Diris:DataRetention:Enabled"] = config.DataRetention.Enabled.ToString();
            _configuration["Diris:DataRetention:RetentionDays"] = config.DataRetention.RetentionDays.ToString();
            _configuration["Diris:DataRetention:CleanupHour"] = config.DataRetention.CleanupHour.ToString();
        }
    }

    private async Task SaveConfigurationToFile(DirisConfigRequest config)
    {
        try
        {
            // Read current appsettings.json
            var jsonContent = await System.IO.File.ReadAllTextAsync(_configFilePath);
            var jsonDoc = System.Text.Json.JsonDocument.Parse(jsonContent);
            var root = jsonDoc.RootElement.Clone();

            // Update DIRIS configuration
            var dirisConfig = new Dictionary<string, object>
            {
                ["Acquisition"] = new Dictionary<string, object>
                {
                    ["Parallelism"] = config.Acquisition?.Parallelism ?? 6,
                    ["DefaultPollIntervalMs"] = config.Acquisition?.DefaultPollIntervalMs ?? 1500,
                    ["MaxBatchPoints"] = config.Acquisition?.MaxBatchPoints ?? 1000
                },
                ["DataRetention"] = new Dictionary<string, object>
                {
                    ["Enabled"] = config.DataRetention?.Enabled ?? true,
                    ["RetentionDays"] = config.DataRetention?.RetentionDays ?? 10,
                    ["CleanupHour"] = config.DataRetention?.CleanupHour ?? 2
                }
            };

            // Create new configuration object
            var newConfig = new Dictionary<string, object>();
            
            // Copy existing configuration
            foreach (var property in root.EnumerateObject())
            {
                if (property.Name == "Diris")
                {
                    newConfig["Diris"] = dirisConfig;
                }
                else
                {
                    newConfig[property.Name] = property.Value;
                }
            }

            // Add Diris if it doesn't exist
            if (!root.TryGetProperty("Diris", out _))
            {
                newConfig["Diris"] = dirisConfig;
            }

            // Write back to file
            var options = new System.Text.Json.JsonSerializerOptions
            {
                WriteIndented = true
            };
            var newJson = System.Text.Json.JsonSerializer.Serialize(newConfig, options);
            await System.IO.File.WriteAllTextAsync(_configFilePath, newJson);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving configuration to file");
            throw;
        }
    }

    private async Task BackupCurrentConfiguration()
    {
        try
        {
            var backupPath = $"{_configFilePath}.backup.{DateTime.Now:yyyyMMdd_HHmmss}";
            var currentContent = await System.IO.File.ReadAllTextAsync(_configFilePath);
            await System.IO.File.WriteAllTextAsync(backupPath, currentContent);
            _logger.LogInformation("Configuration backed up to {BackupPath}", backupPath);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to backup configuration");
        }
    }
}

/// <summary>
/// Request model for DIRIS configuration
/// </summary>
public class DirisConfigRequest
{
    public AcquisitionConfig? Acquisition { get; set; }
    public DataRetentionConfig? DataRetention { get; set; }
}

/// <summary>
/// Acquisition configuration
/// </summary>
public class AcquisitionConfig
{
    public int Parallelism { get; set; }
    public int DefaultPollIntervalMs { get; set; }
    public int MaxBatchPoints { get; set; }
}

/// <summary>
/// Data retention configuration
/// </summary>
public class DataRetentionConfig
{
    public bool Enabled { get; set; }
    public int RetentionDays { get; set; }
    public int CleanupHour { get; set; }
}

/// <summary>
/// Configuration validation result
/// </summary>
public class ConfigurationValidationResult
{
    public bool IsValid { get; set; }
    public List<string> Errors { get; set; } = new();
}
