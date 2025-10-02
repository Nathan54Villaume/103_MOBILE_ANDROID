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
        private readonly Process _currentProcess;

        public ServerMonitorService()
        {
            _startTime = DateTime.Now;
            _currentProcess = Process.GetCurrentProcess();
        }

        public ServerMetrics GetServerMetrics()
        {
            _currentProcess.Refresh();

            return new ServerMetrics
            {
                CpuUsagePercent = GetCpuUsage(),
                MemoryUsageMB = _currentProcess.WorkingSet64 / (1024.0 * 1024.0),
                TotalMemoryMB = GetTotalPhysicalMemory() / (1024.0 * 1024.0),
                ThreadCount = _currentProcess.Threads.Count,
                HandleCount = _currentProcess.HandleCount,
                Uptime = DateTime.Now - _startTime,
                Timestamp = DateTime.Now
            };
        }

        public ServerStatus GetServerStatus()
        {
            return new ServerStatus
            {
                IsRunning = true,
                StartTime = _startTime,
                CurrentTime = DateTime.Now,
                Uptime = DateTime.Now - _startTime,
                Environment = System.Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production",
                MachineName = System.Environment.MachineName,
                ProcessorCount = System.Environment.ProcessorCount,
                OsVersion = RuntimeInformation.OSDescription,
                FrameworkVersion = RuntimeInformation.FrameworkDescription
            };
        }

        private double GetCpuUsage()
        {
            try
            {
                var startTime = DateTime.UtcNow;
                var startCpuUsage = _currentProcess.TotalProcessorTime;

                Thread.Sleep(100); // Petite pause pour mesurer

                _currentProcess.Refresh();
                var endTime = DateTime.UtcNow;
                var endCpuUsage = _currentProcess.TotalProcessorTime;

                var cpuUsedMs = (endCpuUsage - startCpuUsage).TotalMilliseconds;
                var totalMsPassed = (endTime - startTime).TotalMilliseconds;
                var cpuUsageTotal = cpuUsedMs / (System.Environment.ProcessorCount * totalMsPassed);

                return Math.Round(cpuUsageTotal * 100, 2);
            }
            catch
            {
                return 0;
            }
        }

        private long GetTotalPhysicalMemory()
        {
            try
            {
                if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
                {
                    var searcher = new System.Management.ManagementObjectSearcher("SELECT TotalVisibleMemorySize FROM Win32_OperatingSystem");
                    foreach (var obj in searcher.Get())
                    {
                        var totalMemoryKB = Convert.ToInt64(obj["TotalVisibleMemorySize"]);
                        return totalMemoryKB * 1024; // Convertir en bytes
                    }
                }
                // Valeur par défaut si impossible à déterminer
                return 16L * 1024 * 1024 * 1024; // 16 GB par défaut
            }
            catch
            {
                return 16L * 1024 * 1024 * 1024;
            }
        }
    }

    public class ServerMetrics
    {
        public double CpuUsagePercent { get; set; }
        public double MemoryUsageMB { get; set; }
        public double TotalMemoryMB { get; set; }
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

