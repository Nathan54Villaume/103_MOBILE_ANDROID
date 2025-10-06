using Diris.Core.Models;

namespace Diris.Core.Interfaces;

/// <summary>
/// System metrics collection interface
/// </summary>
public interface ISystemMetricsCollector
{
    /// <summary>
    /// Gets current system metrics
    /// </summary>
    SystemMetrics GetCurrentMetrics();
    
    /// <summary>
    /// Gets current acquisition metrics
    /// </summary>
    AcquisitionMetrics GetAcquisitionMetrics();
    
    /// <summary>
    /// Records a successful device reading
    /// </summary>
    void RecordSuccessfulReading(int deviceId, TimeSpan duration);
    
    /// <summary>
    /// Records a failed device reading
    /// </summary>
    void RecordFailedReading(int deviceId, string error);
    
    /// <summary>
    /// Records a measurement point
    /// </summary>
    void RecordMeasurementPoint();
    
    /// <summary>
    /// Gets the throughput rate (points per second)
    /// </summary>
    double GetThroughputRate();
}
