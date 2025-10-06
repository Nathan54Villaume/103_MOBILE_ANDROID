namespace Diris.Core.Models;

/// <summary>
/// Represents a single measurement reading
/// </summary>
public class Measurement
{
    public long Id { get; set; }
    public int DeviceId { get; set; }
    public DateTime UtcTs { get; set; }
    public string Signal { get; set; } = string.Empty;
    public double Value { get; set; }
    public byte Quality { get; set; } = 1; // 1=OK, 2=Warning, 3=Error
    public DateTime IngestTs { get; set; }
    
    /// <summary>
    /// Gets the quality description
    /// </summary>
    public string QualityDescription => Quality switch
    {
        1 => "OK",
        2 => "Warning", 
        3 => "Error",
        _ => "Unknown"
    };
}

/// <summary>
/// Represents a device reading with multiple measurements
/// </summary>
public class DeviceReading
{
    public int DeviceId { get; set; }
    public string DeviceName { get; set; } = string.Empty;
    public DateTime UtcTs { get; set; }
    public List<Measurement> Measurements { get; set; } = new();
    public TimeSpan PollDuration { get; set; }
    public bool IsSuccess { get; set; }
    public string? ErrorMessage { get; set; }
    
    /// <summary>
    /// Gets the number of successful measurements
    /// </summary>
    public int SuccessCount => Measurements.Count(m => m.Quality == 1);
    
    /// <summary>
    /// Gets the number of error measurements
    /// </summary>
    public int ErrorCount => Measurements.Count(m => m.Quality == 3);
}
