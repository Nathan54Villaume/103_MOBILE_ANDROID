using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Management;

namespace API_ATF_MOBILE.Services
{
    public interface ISystemMonitorService
    {
        SystemMetrics GetSystemMetrics();
        ProcessMetrics GetProcessMetrics();
    }

    public class SystemMonitorService : ISystemMonitorService
    {
        private readonly Process _currentProcess;
        private readonly PerformanceCounter? _cpuCounter;
        private readonly PerformanceCounter? _memoryCounter;
        private DateTime _lastCpuCheck = DateTime.MinValue;
        private double _lastCpuValue = 0;

        public SystemMonitorService()
        {
            _currentProcess = Process.GetCurrentProcess();
            
            try
            {
                // Compteurs de performance pour le système
                _cpuCounter = new PerformanceCounter("Processor", "% Processor Time", "_Total");
                _memoryCounter = new PerformanceCounter("Memory", "Available MBytes");
                
                // Premier appel pour initialiser
                _cpuCounter.NextValue();
            }
            catch (Exception)
            {
                // Les compteurs de performance peuvent ne pas être disponibles
                _cpuCounter = null;
                _memoryCounter = null;
            }
        }

        public SystemMetrics GetSystemMetrics()
        {
            return new SystemMetrics
            {
                CpuUsagePercent = GetSystemCpuUsage(),
                MemoryUsageMB = GetSystemMemoryUsage(),
                TotalMemoryMB = GetTotalPhysicalMemory() / (1024.0 * 1024.0),
                AvailableMemoryMB = GetAvailableMemory(),
                ProcessorCount = Environment.ProcessorCount,
                MachineName = Environment.MachineName,
                OsVersion = RuntimeInformation.OSDescription,
                Timestamp = DateTime.Now
            };
        }

        public ProcessMetrics GetProcessMetrics()
        {
            _currentProcess.Refresh();
            
            return new ProcessMetrics
            {
                ProcessId = _currentProcess.Id,
                ProcessName = _currentProcess.ProcessName,
                CpuUsagePercent = GetProcessCpuUsage(),
                MemoryUsageMB = _currentProcess.WorkingSet64 / (1024.0 * 1024.0),
                PrivateMemoryMB = _currentProcess.PrivateMemorySize64 / (1024.0 * 1024.0),
                ThreadCount = _currentProcess.Threads.Count,
                HandleCount = _currentProcess.HandleCount,
                StartTime = _currentProcess.StartTime,
                Uptime = DateTime.Now - _currentProcess.StartTime,
                Timestamp = DateTime.Now
            };
        }

        private double GetSystemCpuUsage()
        {
            try
            {
                if (_cpuCounter != null)
                {
                    // Les compteurs de performance nécessitent un délai entre les appels
                    var now = DateTime.Now;
                    if ((now - _lastCpuCheck).TotalMilliseconds > 1000)
                    {
                        _lastCpuValue = _cpuCounter.NextValue();
                        _lastCpuCheck = now;
                    }
                    return Math.Round(_lastCpuValue, 1);
                }

                // Méthode alternative avec WMI (plus lente)
                return GetCpuUsageWMI();
            }
            catch
            {
                return 0;
            }
        }

        private double GetCpuUsageWMI()
        {
            try
            {
                if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
                {
                    using var searcher = new ManagementObjectSearcher("SELECT LoadPercentage FROM Win32_Processor");
                    var cpuUsages = new List<double>();
                    
                    foreach (ManagementObject obj in searcher.Get())
                    {
                        if (obj["LoadPercentage"] != null)
                        {
                            cpuUsages.Add(Convert.ToDouble(obj["LoadPercentage"]));
                        }
                    }
                    
                    return cpuUsages.Count > 0 ? Math.Round(cpuUsages.Average(), 1) : 0;
                }
                return 0;
            }
            catch
            {
                return 0;
            }
        }

        private double GetSystemMemoryUsage()
        {
            var totalMemory = GetTotalPhysicalMemory() / (1024.0 * 1024.0);
            var availableMemory = GetAvailableMemory();
            return Math.Round(totalMemory - availableMemory, 0);
        }

        private double GetAvailableMemory()
        {
            try
            {
                if (_memoryCounter != null)
                {
                    return _memoryCounter.NextValue();
                }

                // Méthode alternative avec WMI
                if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
                {
                    using var searcher = new ManagementObjectSearcher("SELECT AvailableBytes FROM Win32_PerfRawData_PerfOS_Memory");
                    foreach (ManagementObject obj in searcher.Get())
                    {
                        if (obj["AvailableBytes"] != null)
                        {
                            return Convert.ToDouble(obj["AvailableBytes"]) / (1024.0 * 1024.0);
                        }
                    }
                }
                return 0;
            }
            catch
            {
                return 0;
            }
        }

        private double GetProcessCpuUsage()
        {
            try
            {
                var startTime = DateTime.UtcNow;
                var startCpuUsage = _currentProcess.TotalProcessorTime;

                Thread.Sleep(100);

                _currentProcess.Refresh();
                var endTime = DateTime.UtcNow;
                var endCpuUsage = _currentProcess.TotalProcessorTime;

                var cpuUsedMs = (endCpuUsage - startCpuUsage).TotalMilliseconds;
                var totalMsPassed = (endTime - startTime).TotalMilliseconds;
                var cpuUsageTotal = cpuUsedMs / (Environment.ProcessorCount * totalMsPassed);

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
                    using var searcher = new ManagementObjectSearcher("SELECT TotalVisibleMemorySize FROM Win32_OperatingSystem");
                    foreach (ManagementObject obj in searcher.Get())
                    {
                        var totalMemoryKB = Convert.ToInt64(obj["TotalVisibleMemorySize"]);
                        return totalMemoryKB * 1024;
                    }
                }
                return 16L * 1024 * 1024 * 1024; // 16 GB par défaut
            }
            catch
            {
                return 16L * 1024 * 1024 * 1024;
            }
        }

        public void Dispose()
        {
            _cpuCounter?.Dispose();
            _memoryCounter?.Dispose();
            _currentProcess?.Dispose();
        }
    }

    public class SystemMetrics
    {
        public double CpuUsagePercent { get; set; }
        public double MemoryUsageMB { get; set; }
        public double TotalMemoryMB { get; set; }
        public double AvailableMemoryMB { get; set; }
        public int ProcessorCount { get; set; }
        public string MachineName { get; set; } = string.Empty;
        public string OsVersion { get; set; } = string.Empty;
        public DateTime Timestamp { get; set; }
    }

    public class ProcessMetrics
    {
        public int ProcessId { get; set; }
        public string ProcessName { get; set; } = string.Empty;
        public double CpuUsagePercent { get; set; }
        public double MemoryUsageMB { get; set; }
        public double PrivateMemoryMB { get; set; }
        public int ThreadCount { get; set; }
        public int HandleCount { get; set; }
        public DateTime StartTime { get; set; }
        public TimeSpan Uptime { get; set; }
        public DateTime Timestamp { get; set; }
    }
}
