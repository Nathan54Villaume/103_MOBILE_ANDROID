using System.Diagnostics;
using System.Runtime.InteropServices;

namespace API_ATF_MOBILE.Services
{
    public interface IServerMonitorService
    {
        ServerMetrics GetServerMetrics();
        ServerStatus GetServerStatus();
    }

    public class ServerMonitorService : IServerMonitorService
    {
        private readonly DateTime _startTime;
        private readonly ISystemMonitorService _systemMonitor;

        public ServerMonitorService(ISystemMonitorService systemMonitor)
        {
            _startTime = DateTime.Now;
            _systemMonitor = systemMonitor;
        }

        public ServerMetrics GetServerMetrics()
        {
            var systemMetrics = _systemMonitor.GetSystemMetrics();
            var processMetrics = _systemMonitor.GetProcessMetrics();

            return new ServerMetrics
            {
                // Métriques système (machine hôte)
                CpuUsagePercent = systemMetrics.CpuUsagePercent,
                MemoryUsageMB = systemMetrics.MemoryUsageMB,
                TotalMemoryMB = systemMetrics.TotalMemoryMB,
                AvailableMemoryMB = systemMetrics.AvailableMemoryMB,
                
                // Métriques processus
                ProcessCpuPercent = processMetrics.CpuUsagePercent,
                ProcessMemoryMB = processMetrics.MemoryUsageMB,
                ThreadCount = processMetrics.ThreadCount,
                HandleCount = processMetrics.HandleCount,
                
                Uptime = DateTime.Now - _startTime,
                Timestamp = DateTime.Now
            };
        }

        public ServerStatus GetServerStatus()
        {
            var systemMetrics = _systemMonitor.GetSystemMetrics();
            
            return new ServerStatus
            {
                IsRunning = true,
                StartTime = _startTime,
                CurrentTime = DateTime.Now,
                Uptime = DateTime.Now - _startTime,
                Environment = System.Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production",
                MachineName = systemMetrics.MachineName,
                ProcessorCount = systemMetrics.ProcessorCount,
                OsVersion = systemMetrics.OsVersion,
                FrameworkVersion = RuntimeInformation.FrameworkDescription
            };
        }
    }

    public class ServerMetrics
    {
        // Métriques système (machine hôte)
        public double CpuUsagePercent { get; set; }
        public double MemoryUsageMB { get; set; }
        public double TotalMemoryMB { get; set; }
        public double AvailableMemoryMB { get; set; }
        
        // Métriques processus
        public double ProcessCpuPercent { get; set; }
        public double ProcessMemoryMB { get; set; }
        public int ThreadCount { get; set; }
        public int HandleCount { get; set; }
        
        public TimeSpan Uptime { get; set; }
        public DateTime Timestamp { get; set; }
    }

    public class ServerStatus
    {
        public bool IsRunning { get; set; }
        public DateTime StartTime { get; set; }
        public DateTime CurrentTime { get; set; }
        public TimeSpan Uptime { get; set; }
        public string Environment { get; set; } = string.Empty;
        public string MachineName { get; set; } = string.Empty;
        public int ProcessorCount { get; set; }
        public string OsVersion { get; set; } = string.Empty;
        public string FrameworkVersion { get; set; } = string.Empty;
    }
}

