using Microsoft.Extensions.DependencyInjection;
using Diris.Providers.SNMP.Interfaces;

namespace Diris.Providers.SNMP.Extensions;

/// <summary>
/// Extension methods for registering SNMP services
/// </summary>
public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Adds SNMP services to the dependency injection container
    /// </summary>
    /// <param name="services">The service collection</param>
    /// <param name="requestTimeoutMs">Request timeout in milliseconds (default: 5000)</param>
    /// <returns>The service collection for chaining</returns>
    public static IServiceCollection AddSnmpServices(this IServiceCollection services, int requestTimeoutMs = 5000)
    {
        services.AddSingleton<ISnmpClient>(provider =>
        {
            var logger = provider.GetRequiredService<ILogger<SnmpClient>>();
            return new SnmpClient(logger, requestTimeoutMs);
        });

        return services;
    }
}
