namespace Diris.Providers.SNMP.Models;

/// <summary>
/// Represents an SNMP response for a single OID
/// </summary>
public class SnmpResponseItem
{
    public string Oid { get; set; } = string.Empty;
    public object? Value { get; set; }
    public bool HasError { get; set; }
    public string? ErrorDescription { get; set; }
    public string? DataType { get; set; }
}

/// <summary>
/// Represents a complete SNMP response
/// </summary>
public class SnmpResponse
{
    public List<SnmpResponseItem> Results { get; set; } = new();
    public bool IsSuccess { get; set; }
    public string? ErrorMessage { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}
