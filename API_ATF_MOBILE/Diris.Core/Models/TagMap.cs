namespace Diris.Core.Models;

/// <summary>
/// Represents the mapping between WebMI addresses and signal names
/// </summary>
public class TagMap
{
    public int DeviceId { get; set; }
    public string Signal { get; set; } = string.Empty;
    public string WebMiKey { get; set; } = string.Empty;
    public string? Unit { get; set; }
    public double Scale { get; set; } = 1.0;
    public bool Enabled { get; set; } = true;
    public string? Description { get; set; }
    
    /// <summary>
    /// Applies the scale factor to a raw value
    /// </summary>
    public double ApplyScale(double rawValue)
    {
        return rawValue / Scale;
    }
}

/// <summary>
/// Represents a WebMI address configuration
/// </summary>
public class WebMiAddress
{
    public string Key { get; set; } = string.Empty;
    public string Signal { get; set; } = string.Empty;
    public string Unit { get; set; } = string.Empty;
    public double Scale { get; set; } = 1.0;
    public bool Enabled { get; set; } = true;
}
