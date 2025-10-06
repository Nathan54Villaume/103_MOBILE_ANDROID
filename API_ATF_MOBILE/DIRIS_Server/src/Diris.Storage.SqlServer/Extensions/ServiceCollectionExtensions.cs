using Diris.Core.Interfaces;
using Diris.Storage.SqlServer.Configuration;
using Diris.Storage.SqlServer.Repositories;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace Diris.Storage.SqlServer;

/// <summary>
/// Service collection extensions for SQL Server storage
/// </summary>
public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Adds SQL Server storage services to the DI container
    /// </summary>
    public static IServiceCollection AddSqlServerStorage(this IServiceCollection services, IConfiguration configuration)
    {
        // Configure options with connection string
        services.Configure<SqlServerOptions>(options =>
        {
            // Set connection string directly
            options.ConnectionString = configuration.GetConnectionString("SqlAiAtr") ?? 
                "Server=SQLAIATF\\SQL_AI_ATF;Database=AI_ATR;User Id=mes;Password=samsam;Encrypt=False;TrustServerCertificate=True;";
            
            // Set other options from configuration
            configuration.GetSection(SqlServerOptions.SectionName).Bind(options);
        });

        // Register services
        services.AddSingleton<IDeviceRegistry, DeviceRepository>();
        services.AddSingleton<IMeasurementWriter, BulkWriter>();

        return services;
    }
}
