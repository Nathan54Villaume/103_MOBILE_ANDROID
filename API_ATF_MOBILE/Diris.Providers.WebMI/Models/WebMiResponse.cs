using System.Text.Json.Serialization;

namespace Diris.Providers.WebMI.Models;

/// <summary>
/// WebMI API response structure
/// </summary>
public class WebMiResponse
{
    [JsonPropertyName("result")]
    public List<WebMiResult> Result { get; set; } = new();
    
    [JsonPropertyName("error")]
    public int Error { get; set; }
}

/// <summary>
/// Individual WebMI result item
/// </summary>
public class WebMiResult
{
    [JsonPropertyName("value")]
    public double? Value { get; set; }
    
    [JsonPropertyName("error")]
    public int Error { get; set; }
    
    [JsonPropertyName("status")]
    public int Status { get; set; }
    
    [JsonPropertyName("timestamp")]
    public long Timestamp { get; set; }
    
    /// <summary>
    /// Gets whether this result has an error
    /// </summary>
    public bool HasError => Error != 0;
    
    /// <summary>
    /// Gets the error description
    /// </summary>
    public string ErrorDescription => Error switch
    {
        0 => "OK",
        1 => "Invalid address",
        2 => "Device not found",
        3 => "Communication error",
        4 => "Timeout",
        _ => $"Unknown error {Error}"
    };
}
