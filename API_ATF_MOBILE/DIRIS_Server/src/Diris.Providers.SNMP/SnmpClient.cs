using System.Net;
using System.Net.Sockets;
using Lextm.SharpSnmpLib;
using Lextm.SharpSnmpLib.Messaging;
using Microsoft.Extensions.Logging;
using Diris.Providers.SNMP.Interfaces;
using Diris.Providers.SNMP.Models;

namespace Diris.Providers.SNMP;

/// <summary>
/// SNMP client implementation for Socomec M50 gateway
/// </summary>
public class SnmpClient : ISnmpClient
{
    private readonly ILogger<SnmpClient> _logger;
    private readonly int _requestTimeoutMs;

    public int RequestTimeoutMs => _requestTimeoutMs;

    public SnmpClient(ILogger<SnmpClient> logger, int requestTimeoutMs = 5000)
    {
        _logger = logger;
        _requestTimeoutMs = requestTimeoutMs;
    }

    public async Task<Dictionary<string, object?>> ReadAsync(string host, string community, IEnumerable<string> oids, int port = 161)
    {
        var result = new Dictionary<string, object?>();
        var oidList = oids.ToList();

        try
        {
            _logger.LogDebug("Reading {Count} OIDs from {Host}:{Port} with community '{Community}'", 
                oidList.Count, host, port, community);

            var endpoint = new IPEndPoint(IPAddress.Parse(host), port);
            var communityString = new OctetString(community);

            // Convert string OIDs to ObjectIdentifier objects
            var objectIdentifiers = oidList.Select(oid => new ObjectIdentifier(oid)).ToList();

            // Perform SNMP GET request
            var response = await Task.Run(() => 
                Messenger.Get(VersionCode.V2, endpoint, communityString, objectIdentifiers, _requestTimeoutMs));

            // Process response
            foreach (var variable in response)
            {
                var oid = variable.Id.ToString();
                object? value = null;

                // Convert SNMP data types to .NET types
                switch (variable.Data)
                {
                    case Integer32 int32:
                        value = int32.ToInt32();
                        break;
                    case Gauge32 gauge32:
                        value = gauge32.ToUInt32();
                        break;
                    case Counter32 counter32:
                        value = counter32.ToUInt32();
                        break;
                    case TimeTicks timeTicks:
                        value = timeTicks.ToUInt32();
                        break;
                    case OctetString octetString:
                        value = octetString.ToString();
                        break;
                    case Null nullValue:
                        value = null;
                        break;
                    default:
                        value = variable.Data.ToString();
                        break;
                }

                result[oid] = value;
                _logger.LogDebug("SNMP OID {Oid} = {Value} ({Type})", oid, value, variable.Data.TypeCode);
            }

            _logger.LogDebug("Successfully read {SuccessCount}/{TotalCount} OIDs from {Host}", 
                result.Count, oidList.Count, host);

            return result;
        }
        catch (SocketException ex)
        {
            _logger.LogError(ex, "Socket error reading SNMP from {Host}:{Port}", host, port);
            throw;
        }
        catch (SnmpException ex)
        {
            _logger.LogError(ex, "SNMP error reading from {Host}:{Port}", host, port);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error reading SNMP from {Host}:{Port}", host, port);
            throw;
        }
    }

    public async Task<bool> TestConnectivityAsync(string host, string community, int port = 161)
    {
        try
        {
            _logger.LogDebug("Testing SNMP connectivity to {Host}:{Port} with community '{Community}'", 
                host, port, community);

            // Try to read a common OID (system description)
            var testOids = new[] { "1.3.6.1.2.1.1.1.0" }; // sysDescr
            var result = await ReadAsync(host, community, testOids, port);

            var isReachable = result.Values.Any(v => v != null);
            _logger.LogDebug("SNMP connectivity test to {Host}:{Port}: {Status}", 
                host, port, isReachable ? "Success" : "Failed");

            return isReachable;
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "SNMP connectivity test failed for {Host}:{Port}", host, port);
            return false;
        }
    }
}
