namespace Diris.Core.Models;

/// <summary>
/// System performance metrics
/// </summary>
public class SystemMetrics
{
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public ProcessMetrics Process { get; set; } = new();
    public SystemInfo System { get; set; } = new();
    public GcMetrics Gc { get; set; } = new();
}

/// <summary>
/// Process-specific metrics
/// </summary>
public class ProcessMetrics
{
    public double CpuPercent { get; set; }
    public double MemoryMB { get; set; }
    public double WorkingSetMB { get; set; }
    public double PrivateMemoryMB { get; set; }
    public int Threads { get; set; }
    public int Handles { get; set; }
    public TimeSpan Uptime { get; set; }
}

/// <summary>
/// System-wide metrics
/// </summary>
public class SystemInfo
{
    public double CpuPercent { get; set; }
    public long MemoryTotalMB { get; set; }
    public long MemoryAvailableMB { get; set; }
    public TimeSpan Uptime { get; set; }
}

/// <summary>
/// Garbage Collection metrics
/// </summary>
public class GcMetrics
{
    public int Gen0Collections { get; set; }
    public int Gen1Collections { get; set; }
    public int Gen2Collections { get; set; }
    public double TotalMemoryMB { get; set; }
    public double LohSizeMB { get; set; }
}

/// <summary>
/// Data acquisition metrics
/// </summary>
public class AcquisitionMetrics
{
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public ThroughputMetrics Throughput { get; set; } = new();
    public List<DeviceMetrics> Devices { get; set; } = new();
    public QueueMetrics Queues { get; set; } = new();
}

/// <summary>
/// Throughput metrics
/// </summary>
public class ThroughputMetrics
{
    public double PointsPerSecond { get; set; }
    public double DevicesPerSecond { get; set; }
    public double AveragePollDurationMs { get; set; }
    public double P95LatencyMs { get; set; }
    public double P99LatencyMs { get; set; }
}

/// <summary>
/// Per-device metrics
/// </summary>
public class DeviceMetrics
{
    public int DeviceId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime? LastPollUtc { get; set; }
    public double PollDurationMs { get; set; }
    public int ErrorCount { get; set; }
    public string CircuitBreakerState { get; set; } = "Closed";
    public double SuccessRate { get; set; }
}

/// <summary>
/// Queue metrics
/// </summary>
public class QueueMetrics
{
    public int MeasurementBufferSize { get; set; }
    public int SqlBulkQueueSize { get; set; }
    public int PendingWrites { get; set; }
    public int MaxBufferSize { get; set; }
}
