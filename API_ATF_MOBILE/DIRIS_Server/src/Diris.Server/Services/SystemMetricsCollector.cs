using Diris.Core.Interfaces;
using Diris.Core.Models;
using System.Diagnostics;
using System.Runtime;

namespace Diris.Server.Services;

/// <summary>
/// System metrics collector implementation
/// </summary>
public class SystemMetricsCollector : ISystemMetricsCollector
{
    private readonly Process _currentProcess;
    private readonly DateTime _startTime;
    private readonly object _lock = new();
    private readonly Queue<double> _latencySamples = new();
    private readonly Dictionary<int, int> _deviceErrorCounts = new();
    private readonly Dictionary<int, int> _deviceSuccessCounts = new();
    private readonly Dictionary<int, DateTime> _deviceLastReads = new();
    private long _totalMeasurementPoints;
    private long _totalSuccessfulReadings;
    private long _totalFailedReadings;
    private DateTime _lastResetTime = DateTime.UtcNow;

    public SystemMetricsCollector()
    {
        _currentProcess = Process.GetCurrentProcess();
        _startTime = DateTime.UtcNow;
    }

    public SystemMetrics GetCurrentMetrics()
    {
        var processUptime = DateTime.UtcNow - _startTime;
        var systemUptime = TimeSpan.FromMilliseconds(Environment.TickCount64);

        // Get process metrics
        var processMetrics = new ProcessMetrics
        {
            CpuPercent = GetCpuPercent(),
            MemoryMB = _currentProcess.WorkingSet64 / (1024.0 * 1024.0),
            WorkingSetMB = _currentProcess.WorkingSet64 / (1024.0 * 1024.0),
            PrivateMemoryMB = _currentProcess.PrivateMemorySize64 / (1024.0 * 1024.0),
            Threads = _currentProcess.Threads.Count,
            Handles = _currentProcess.HandleCount,
            Uptime = processUptime
        };

        // Get system metrics
        var systemInfo = new SystemInfo
        {
            CpuPercent = GetSystemCpuPercent(),
            MemoryTotalMB = (long)(GC.GetTotalMemory(false) / (1024.0 * 1024.0)),
            MemoryAvailableMB = GetAvailableMemoryMB(),
            Uptime = systemUptime
        };

        // Get GC metrics
        var gcInfo = GC.GetGCMemoryInfo();
        var gcMetrics = new GcMetrics
        {
            Gen0Collections = GC.CollectionCount(0),
            Gen1Collections = GC.CollectionCount(1),
            Gen2Collections = GC.CollectionCount(2),
            TotalMemoryMB = gcInfo.HeapSizeBytes / (1024.0 * 1024.0),
            LohSizeMB = gcInfo.HighMemoryLoadThresholdBytes / (1024.0 * 1024.0)
        };

        return new SystemMetrics
        {
            Process = processMetrics,
            System = systemInfo,
            Gc = gcMetrics
        };
    }

    public AcquisitionMetrics GetAcquisitionMetrics()
    {
        lock (_lock)
        {
            var now = DateTime.UtcNow;
            var timeSinceReset = (now - _lastResetTime).TotalSeconds;
            
            var throughput = new ThroughputMetrics
            {
                PointsPerSecond = timeSinceReset > 0 ? _totalMeasurementPoints / timeSinceReset : 0,
                DevicesPerSecond = timeSinceReset > 0 ? _totalSuccessfulReadings / timeSinceReset : 0,
                AveragePollDurationMs = GetAverageLatency(),
                P95LatencyMs = GetPercentileLatency(0.95),
                P99LatencyMs = GetPercentileLatency(0.99)
            };

            var devices = _deviceSuccessCounts.Keys.Union(_deviceErrorCounts.Keys)
                .Select(deviceId => new DeviceMetrics
                {
                    DeviceId = deviceId,
                    Name = $"Device-{deviceId}",
                    Status = GetDeviceStatus(deviceId),
                    LastPollUtc = _deviceLastReads.GetValueOrDefault(deviceId),
                    PollDurationMs = 0, // Would need to track per device
                    ErrorCount = _deviceErrorCounts.GetValueOrDefault(deviceId, 0),
                    CircuitBreakerState = "Closed", // Would need to get from reader
                    SuccessRate = GetDeviceSuccessRate(deviceId)
                })
                .ToList();

            var queues = new QueueMetrics
            {
                MeasurementBufferSize = 0, // Would need to get from writer
                SqlBulkQueueSize = 0,
                PendingWrites = 0,
                MaxBufferSize = 1000
            };

            return new AcquisitionMetrics
            {
                Throughput = throughput,
                Devices = devices,
                Queues = queues
            };
        }
    }

    public void RecordSuccessfulReading(int deviceId, TimeSpan duration)
    {
        lock (_lock)
        {
            _totalSuccessfulReadings++;
            _deviceSuccessCounts[deviceId] = _deviceSuccessCounts.GetValueOrDefault(deviceId, 0) + 1;
            _deviceLastReads[deviceId] = DateTime.UtcNow;
            
            // Add latency sample (keep only last 1000 samples)
            _latencySamples.Enqueue(duration.TotalMilliseconds);
            while (_latencySamples.Count > 1000)
            {
                _latencySamples.Dequeue();
            }
        }
    }

    public void RecordFailedReading(int deviceId, string error)
    {
        lock (_lock)
        {
            _totalFailedReadings++;
            _deviceErrorCounts[deviceId] = _deviceErrorCounts.GetValueOrDefault(deviceId, 0) + 1;
        }
    }

    public void RecordMeasurementPoint()
    {
        Interlocked.Increment(ref _totalMeasurementPoints);
    }

    public double GetThroughputRate()
    {
        lock (_lock)
        {
            var timeSinceReset = (DateTime.UtcNow - _lastResetTime).TotalSeconds;
            return timeSinceReset > 0 ? _totalMeasurementPoints / timeSinceReset : 0;
        }
    }

    private double GetCpuPercent()
    {
        try
        {
            // This is a simplified CPU calculation
            // In production, you'd want to use PerformanceCounter
            return 0.0; // Placeholder
        }
        catch
        {
            return 0.0;
        }
    }

    private double GetSystemCpuPercent()
    {
        try
        {
            // This is a simplified system CPU calculation
            // In production, you'd want to use PerformanceCounter
            return 0.0; // Placeholder
        }
        catch
        {
            return 0.0;
        }
    }

    private long GetAvailableMemoryMB()
    {
        try
        {
            var gcInfo = GC.GetGCMemoryInfo();
            return gcInfo.TotalAvailableMemoryBytes / (1024 * 1024);
        }
        catch
        {
            return 0;
        }
    }

    private double GetAverageLatency()
    {
        lock (_lock)
        {
            if (!_latencySamples.Any()) return 0;
            return _latencySamples.Average();
        }
    }

    private double GetPercentileLatency(double percentile)
    {
        lock (_lock)
        {
            if (!_latencySamples.Any()) return 0;
            
            var sortedSamples = _latencySamples.OrderBy(x => x).ToArray();
            var index = (int)(percentile * (sortedSamples.Length - 1));
            return sortedSamples[index];
        }
    }

    private string GetDeviceStatus(int deviceId)
    {
        var lastRead = _deviceLastReads.GetValueOrDefault(deviceId);
        if (lastRead == default) return "Unknown";
        
        var timeSinceLastRead = DateTime.UtcNow - lastRead;
        return timeSinceLastRead.TotalMinutes switch
        {
            < 1 => "Healthy",
            < 5 => "Warning",
            _ => "Error"
        };
    }

    private double GetDeviceSuccessRate(int deviceId)
    {
        var successCount = _deviceSuccessCounts.GetValueOrDefault(deviceId, 0);
        var errorCount = _deviceErrorCounts.GetValueOrDefault(deviceId, 0);
        var total = successCount + errorCount;
        
        return total > 0 ? (double)successCount / total * 100 : 0;
    }
}
