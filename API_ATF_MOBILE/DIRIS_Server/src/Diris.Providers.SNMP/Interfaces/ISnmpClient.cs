using Diris.Providers.SNMP.Models;

namespace Diris.Providers.SNMP.Interfaces;

/// <summary>
/// Interface for SNMP client operations
/// </summary>
public interface ISnmpClient
{
    /// <summary>
    /// Reads multiple OIDs from an SNMP agent
    /// </summary>
    /// <param name="host">Target host IP address</param>
    /// <param name="community">SNMP community string</param>
    /// <param name="oids">List of OIDs to read</param>
    /// <param name="port">SNMP port (default 161)</param>
    /// <returns>Dictionary of OID to value mappings</returns>
    Task<Dictionary<string, object?>> ReadAsync(string host, string community, IEnumerable<string> oids, int port = 161);

    /// <summary>
    /// Tests connectivity to an SNMP agent
    /// </summary>
    /// <param name="host">Target host IP address</param>
    /// <param name="community">SNMP community string</param>
    /// <param name="port">SNMP port (default 161)</param>
    /// <returns>True if connectivity is successful</returns>
    Task<bool> TestConnectivityAsync(string host, string community, int port = 161);

    /// <summary>
    /// Gets the request timeout in milliseconds
    /// </summary>
    int RequestTimeoutMs { get; }
}
