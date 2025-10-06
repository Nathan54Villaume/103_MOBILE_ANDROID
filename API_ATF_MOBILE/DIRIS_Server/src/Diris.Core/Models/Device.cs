namespace Diris.Core.Models;

/// <summary>
/// Represents a DIRIS device configuration
/// </summary>
public class Device
{
    public int DeviceId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string IpAddress { get; set; } = string.Empty;
    public string Protocol { get; set; } = "webmi";
    public bool Enabled { get; set; } = true;
    public int PollIntervalMs { get; set; } = 1500;
    public DateTime? LastSeenUtc { get; set; }
    public string? MetaJson { get; set; }
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }
    
    /// <summary>
    /// Gets the WebMI endpoint URL for this device
    /// </summary>
    public string GetWebMiEndpoint() => $"http://{IpAddress}/webMI/?read";
    
    /// <summary>
    /// Gets the device display name
    /// </summary>
    public string DisplayName => $"{Name} ({IpAddress})";
}
