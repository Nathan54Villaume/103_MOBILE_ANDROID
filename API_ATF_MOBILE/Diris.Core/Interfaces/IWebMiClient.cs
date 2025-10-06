namespace Diris.Core.Interfaces;

/// <summary>
/// WebMI client interface for communicating with DIRIS devices
/// </summary>
public interface IWebMiClient
{
    /// <summary>
    /// Reads data from a WebMI endpoint
    /// </summary>
    /// <param name="endpoint">The WebMI endpoint URL</param>
    /// <param name="addresses">List of WebMI addresses to read</param>
    /// <returns>Dictionary of address -> value mappings</returns>
    Task<Dictionary<string, double?>> ReadAsync(string endpoint, IEnumerable<string> addresses);
    
    /// <summary>
    /// Tests connectivity to a WebMI endpoint
    /// </summary>
    /// <param name="endpoint">The WebMI endpoint URL</param>
    /// <returns>True if reachable, false otherwise</returns>
    Task<bool> TestConnectivityAsync(string endpoint);
    
    /// <summary>
    /// Gets the request timeout in milliseconds
    /// </summary>
    int RequestTimeoutMs { get; }
}
