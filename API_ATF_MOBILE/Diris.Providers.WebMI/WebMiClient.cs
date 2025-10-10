using System.Text;
using System.Text.Json;
using Diris.Core.Interfaces;
using Diris.Providers.WebMI.Models;
using Microsoft.Extensions.Logging;

namespace Diris.Providers.WebMI;

/// <summary>
/// WebMI client implementation for DIRIS devices
/// </summary>
public class WebMiClient : IWebMiClient
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<WebMiClient> _logger;
    private readonly JsonSerializerOptions _jsonOptions;

    public int RequestTimeoutMs { get; }

    public WebMiClient(HttpClient httpClient, ILogger<WebMiClient> logger, int requestTimeoutMs = 1500)
    {
        _httpClient = httpClient;
        _logger = logger;
        RequestTimeoutMs = requestTimeoutMs;
        
        _httpClient.Timeout = TimeSpan.FromMilliseconds(requestTimeoutMs);
        
        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };
    }

    public async Task<Dictionary<string, double?>> ReadAsync(string endpoint, IEnumerable<string> addresses, CancellationToken cancellationToken = default)
    {
        try
        {
            var addressList = addresses.ToList();
            if (!addressList.Any())
            {
                _logger.LogWarning("No addresses provided for WebMI read");
                return new Dictionary<string, double?>();
            }

            _logger.LogDebug("Reading {Count} addresses from {Endpoint}", addressList.Count, endpoint);

            // Build the request body
            var body = string.Join("&", addressList.Select(addr => $"address[]={Uri.EscapeDataString(addr)}"));
            var content = new StringContent(body, Encoding.UTF8, "application/x-www-form-urlencoded");

            // Send the request
            var response = await _httpClient.PostAsync(endpoint, content, cancellationToken);
            response.EnsureSuccessStatusCode();

            var jsonContent = await response.Content.ReadAsStringAsync(cancellationToken);
            var webMiResponse = JsonSerializer.Deserialize<WebMiResponse>(jsonContent, _jsonOptions);

            if (webMiResponse?.Result == null)
            {
                _logger.LogError("Invalid WebMI response structure from {Endpoint}", endpoint);
                return new Dictionary<string, double?>();
            }

            // Map results to addresses
            var result = new Dictionary<string, double?>();
            for (int i = 0; i < Math.Min(addressList.Count, webMiResponse.Result.Count); i++)
            {
                var address = addressList[i];
                var resultItem = webMiResponse.Result[i];
                
                if (resultItem.HasError)
                {
                    _logger.LogWarning("WebMI error for address {Address}: {Error}", address, resultItem.ErrorDescription);
                    result[address] = null;
                }
                else
                {
                    result[address] = resultItem.Value;
                }
            }

            _logger.LogDebug("Successfully read {SuccessCount}/{TotalCount} addresses from {Endpoint}", 
                result.Values.Count(v => v.HasValue), addressList.Count, endpoint);

            return result;
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "HTTP error reading from {Endpoint}", endpoint);
            throw;
        }
        catch (TaskCanceledException ex) when (ex.InnerException is TimeoutException)
        {
            _logger.LogError("Timeout reading from {Endpoint} after {TimeoutMs}ms", endpoint, RequestTimeoutMs);
            throw new TimeoutException($"WebMI request timed out after {RequestTimeoutMs}ms", ex);
        }
        catch (JsonException ex)
        {
            _logger.LogError(ex, "JSON deserialization error for response from {Endpoint}", endpoint);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error reading from {Endpoint}", endpoint);
            throw;
        }
    }

    public async Task<bool> TestConnectivityAsync(string endpoint)
    {
        try
        {
            _logger.LogDebug("Testing connectivity to {Endpoint}", endpoint);
            
            // Try to read a single test address
            var testAddresses = new[] { "F_255" }; // Frequency is usually available
            var result = await ReadAsync(endpoint, testAddresses);
            
            var isReachable = result.Values.Any(v => v.HasValue);
            _logger.LogDebug("Connectivity test to {Endpoint}: {Status}", endpoint, isReachable ? "Success" : "Failed");
            
            return isReachable;
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Connectivity test failed for {Endpoint}", endpoint);
            return false;
        }
    }
}
