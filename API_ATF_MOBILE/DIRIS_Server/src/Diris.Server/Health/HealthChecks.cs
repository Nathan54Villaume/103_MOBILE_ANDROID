using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using System.Text.Json;
using Diris.Core.Interfaces;

namespace Diris.Server.Health;

/// <summary>
/// Health check extensions
/// </summary>
public static class HealthCheckExtensions
{
    /// <summary>
    /// Adds health checks for DIRIS services
    /// </summary>
    public static IServiceCollection AddDirisHealthChecks(this IServiceCollection services)
    {
        services.AddHealthChecks()
            .AddCheck<DatabaseHealthCheck>("database")
            .AddCheck<WebMiHealthCheck>("webmi");

        return services;
    }

    /// <summary>
    /// Maps health check endpoints
    /// </summary>
    public static IEndpointRouteBuilder MapDirisHealthChecks(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapHealthChecks("/api/health/live", new HealthCheckOptions
        {
            Predicate = _ => false // Liveness check - just check if service is running
        });

        endpoints.MapHealthChecks("/api/health/ready", new HealthCheckOptions
        {
            Predicate = check => check.Tags.Contains("ready"),
            ResponseWriter = WriteHealthCheckResponse
        });

        endpoints.MapHealthChecks("/api/health", new HealthCheckOptions
        {
            ResponseWriter = WriteHealthCheckResponse
        });

        return endpoints;
    }

    private static async Task WriteHealthCheckResponse(HttpContext context, HealthReport report)
    {
        context.Response.ContentType = "application/json";

        var response = new
        {
            Status = report.Status.ToString(),
            TotalDuration = report.TotalDuration.TotalMilliseconds,
            Checks = report.Entries.Select(entry => new
            {
                Name = entry.Key,
                Status = entry.Value.Status.ToString(),
                Duration = entry.Value.Duration.TotalMilliseconds,
                Description = entry.Value.Description,
                Data = entry.Value.Data,
                Exception = entry.Value.Exception?.Message
            })
        };

        await context.Response.WriteAsync(JsonSerializer.Serialize(response, new JsonSerializerOptions
        {
            WriteIndented = true
        }));
    }
}

/// <summary>
/// Database health check
/// </summary>
public class DatabaseHealthCheck : IHealthCheck
{
    private readonly string? _connectionString;
    private readonly ILogger<DatabaseHealthCheck> _logger;

    public DatabaseHealthCheck(IConfiguration configuration, ILogger<DatabaseHealthCheck> logger)
    {
        _connectionString = configuration.GetConnectionString("SqlAiAtr");
        _logger = logger;
    }

    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(_connectionString))
        {
            return HealthCheckResult.Degraded("Database connection string not configured");
        }

        try
        {
            using var connection = new Microsoft.Data.SqlClient.SqlConnection(_connectionString);
            await connection.OpenAsync(cancellationToken);
            
            using var command = connection.CreateCommand();
            command.CommandText = "SELECT 1";
            await command.ExecuteScalarAsync(cancellationToken);

            return HealthCheckResult.Healthy("Database connection successful");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Database health check failed");
            return HealthCheckResult.Unhealthy("Database connection failed", ex);
        }
    }
}

/// <summary>
/// WebMI health check
/// </summary>
public class WebMiHealthCheck : IHealthCheck
{
    private readonly IDeviceRegistry _deviceRegistry;
    private readonly ILogger<WebMiHealthCheck> _logger;

    public WebMiHealthCheck(IDeviceRegistry deviceRegistry, ILogger<WebMiHealthCheck> logger)
    {
        _deviceRegistry = deviceRegistry;
        _logger = logger;
    }

    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            var devices = await _deviceRegistry.GetEnabledDevicesAsync();
            var deviceList = devices.Take(3).ToList(); // Check first 3 devices

            if (!deviceList.Any())
            {
                return HealthCheckResult.Degraded("No enabled devices found");
            }

            var healthyDevices = 0;
            var totalDevices = deviceList.Count;

            foreach (var device in deviceList)
            {
                try
                {
                    using var httpClient = new HttpClient();
                    httpClient.Timeout = TimeSpan.FromSeconds(5);
                    
                    var response = await httpClient.GetAsync(device.GetWebMiEndpoint(), cancellationToken);
                    if (response.IsSuccessStatusCode)
                    {
                        healthyDevices++;
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogDebug(ex, "WebMI health check failed for device {DeviceId}", device.DeviceId);
                }
            }

            var healthPercentage = (double)healthyDevices / totalDevices;
            
            return healthPercentage switch
            {
                >= 0.8 => HealthCheckResult.Healthy($"WebMI connectivity good ({healthyDevices}/{totalDevices} devices)"),
                >= 0.5 => HealthCheckResult.Degraded($"WebMI connectivity degraded ({healthyDevices}/{totalDevices} devices)"),
                _ => HealthCheckResult.Unhealthy($"WebMI connectivity poor ({healthyDevices}/{totalDevices} devices)")
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "WebMI health check failed");
            return HealthCheckResult.Unhealthy("WebMI health check failed", ex);
        }
    }
}
