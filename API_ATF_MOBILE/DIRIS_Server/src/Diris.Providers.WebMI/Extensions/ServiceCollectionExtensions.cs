using Diris.Core.Interfaces;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Polly;
using Polly.Extensions.Http;

namespace Diris.Providers.WebMI;

/// <summary>
/// Service collection extensions for WebMI provider
/// </summary>
public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Adds WebMI provider services to the DI container
    /// </summary>
    public static IServiceCollection AddWebMiProvider(this IServiceCollection services, int requestTimeoutMs = 1500)
    {
        // Configure HttpClient with Polly policies
        services.AddHttpClient<IWebMiClient, WebMiClient>(client =>
        {
            client.Timeout = TimeSpan.FromMilliseconds(requestTimeoutMs);
        })
        .AddPolicyHandler(GetRetryPolicy())
        .AddPolicyHandler(GetTimeoutPolicy(requestTimeoutMs));

        // Register services
        services.AddSingleton<IWebMiClient>(provider =>
        {
            var httpClient = provider.GetRequiredService<HttpClient>();
            var logger = provider.GetRequiredService<ILogger<WebMiClient>>();
            return new WebMiClient(httpClient, logger, requestTimeoutMs);
        });

        services.AddScoped<IDeviceReader, WebMiReaderSimple>();

        return services;
    }

    /// <summary>
    /// Gets the retry policy for HTTP requests
    /// </summary>
    private static IAsyncPolicy<HttpResponseMessage> GetRetryPolicy()
    {
        return HttpPolicyExtensions
            .HandleTransientHttpError()
            .OrResult(msg => !msg.IsSuccessStatusCode)
            .WaitAndRetryAsync(
                retryCount: 3,
                sleepDurationProvider: retryAttempt => TimeSpan.FromMilliseconds(150 * Math.Pow(2, retryAttempt - 1)),
                onRetry: (outcome, timespan, retryCount, context) =>
                {
                    var logger = context.GetLogger();
                    logger?.LogWarning("Retry {RetryCount} for {RequestUri} after {Delay}ms", 
                        retryCount, context.GetRequestUri(), timespan.TotalMilliseconds);
                });
    }

    /// <summary>
    /// Gets the timeout policy for HTTP requests
    /// </summary>
    private static IAsyncPolicy<HttpResponseMessage> GetTimeoutPolicy(int timeoutMs)
    {
        return Policy.TimeoutAsync<HttpResponseMessage>(TimeSpan.FromMilliseconds(timeoutMs));
    }
}

/// <summary>
/// Extension methods for Polly context
/// </summary>
public static class PollyContextExtensions
{
    private const string LoggerKey = "Logger";
    private const string RequestUriKey = "RequestUri";

    public static void SetLogger(this Context context, ILogger logger)
    {
        context[LoggerKey] = logger;
    }

    public static ILogger? GetLogger(this Context context)
    {
        return context.TryGetValue(LoggerKey, out var logger) ? logger as ILogger : null;
    }

    public static void SetRequestUri(this Context context, string requestUri)
    {
        context[RequestUriKey] = requestUri;
    }

    public static string? GetRequestUri(this Context context)
    {
        return context.TryGetValue(RequestUriKey, out var uri) ? uri as string : null;
    }
}
