using Diris.Core.Models;

namespace Diris.Core.Interfaces;

/// <summary>
/// Measurement writer interface for storing data
/// </summary>
public interface IMeasurementWriter
{
    /// <summary>
    /// Writes measurements to storage
    /// </summary>
    Task WriteAsync(IEnumerable<Measurement> measurements);
    
    /// <summary>
    /// Gets the number of pending measurements in the buffer
    /// </summary>
    Task<int> GetPendingCountAsync();
    
    /// <summary>
    /// Gets the current buffer size
    /// </summary>
    int GetBufferSize();
    
    /// <summary>
    /// Gets the maximum buffer size
    /// </summary>
    int GetMaxBufferSize();
    
    /// <summary>
    /// Forces a flush of the current buffer
    /// </summary>
    Task FlushAsync();
    
    /// <summary>
    /// Gets queue metrics
    /// </summary>
    QueueMetrics GetQueueMetrics();
}
