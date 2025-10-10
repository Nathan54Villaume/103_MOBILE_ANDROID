using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using API_ATF_MOBILE.Models;
using System.Text.Json;
using System.Text.Json.Nodes;

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
        _configFilePath = Path.Combine(AppContext.BaseDirectory, "appsettings.json");
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
                    requestTimeoutMs = _configuration.GetValue<int>("Diris:Acquisition:RequestTimeoutMs", 2000),
                    maxConsecutiveErrors = _configuration.GetValue<int>("Diris:Acquisition:MaxConsecutiveErrors", 5)
                },
                dataRetention = new
                {
                    enabled = _configuration.GetValue<bool>("Diris:DataRetention:Enabled", true),
                    retentionDays = _configuration.GetValue<int>("Diris:DataRetention:RetentionDays", 10),
                    cleanupHour = _configuration.GetValue<int>("Diris:DataRetention:CleanupHour", 2),
                    maxDatabaseSizeMB = _configuration.GetValue<int>("Diris:DataRetention:MaxDatabaseSizeMB", 1024)
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
                    RequestTimeoutMs = 2000,
                    MaxConsecutiveErrors = 5
                },
                DataRetention = new DataRetentionConfig
                {
                    Enabled = true,
                    RetentionDays = 10,
                    CleanupHour = 2,
                    MaxDatabaseSizeMB = 1024
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

        if (config.Acquisition?.RequestTimeoutMs < 500 || config.Acquisition?.RequestTimeoutMs > 15000)
            errors.Add("Request timeout must be between 500ms and 15000ms");

        if (config.Acquisition?.MaxConsecutiveErrors < 1 || config.Acquisition?.MaxConsecutiveErrors > 50)
            errors.Add("Max consecutive errors must be between 1 and 50");

        // Validate retention settings
        if (config.DataRetention?.RetentionDays < 1 || config.DataRetention?.RetentionDays > 365)
            errors.Add("Retention days must be between 1 and 365");

        if (config.DataRetention?.CleanupHour < 0 || config.DataRetention?.CleanupHour > 23)
            errors.Add("Cleanup hour must be between 0 and 23");

        if (config.DataRetention?.MaxDatabaseSizeMB < 100 || config.DataRetention?.MaxDatabaseSizeMB > 10240)
            errors.Add("Max database size must be between 100 MB and 10 GB (10240 MB)");

        return new ConfigurationValidationResult
        {
            IsValid = errors.Count == 0,
            Errors = errors
        };
    }

    private async Task SaveConfigurationToFile(DirisConfigRequest config)
    {
        try
        {
            var jsonContent = await System.IO.File.ReadAllTextAsync(_configFilePath);
            var jsonObj = JsonNode.Parse(jsonContent)?.AsObject();

            if (jsonObj == null)
            {
                throw new InvalidOperationException("Failed to parse appsettings.json");
            }

            var dirisConfig = new JsonObject
            {
                ["Acquisition"] = new JsonObject
                {
                    ["Parallelism"] = config.Acquisition?.Parallelism ?? 6,
                    ["DefaultPollIntervalMs"] = config.Acquisition?.DefaultPollIntervalMs ?? 1500,
                    ["RequestTimeoutMs"] = config.Acquisition?.RequestTimeoutMs ?? 2000,
                    ["MaxConsecutiveErrors"] = config.Acquisition?.MaxConsecutiveErrors ?? 5
                },
                ["DataRetention"] = new JsonObject
                {
                    ["Enabled"] = config.DataRetention?.Enabled ?? true,
                    ["RetentionDays"] = config.DataRetention?.RetentionDays ?? 10,
                    ["CleanupHour"] = config.DataRetention?.CleanupHour ?? 2,
                    ["MaxDatabaseSizeMB"] = config.DataRetention?.MaxDatabaseSizeMB ?? 1024
                }
            };

            jsonObj["Diris"] = dirisConfig;

            var options = new JsonSerializerOptions { WriteIndented = true };
            var newJson = jsonObj.ToJsonString(options);
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
    public int RequestTimeoutMs { get; set; }
    public int MaxConsecutiveErrors { get; set; }
}

/// <summary>
/// Data retention configuration
/// </summary>
public class DataRetentionConfig
{
    public bool Enabled { get; set; }
    public int RetentionDays { get; set; }
    public int CleanupHour { get; set; }
    public int MaxDatabaseSizeMB { get; set; }
}

/// <summary>
/// Configuration validation result
/// </summary>
public class ConfigurationValidationResult
{
    public bool IsValid { get; set; }
    public List<string> Errors { get; set; } = new();
}
