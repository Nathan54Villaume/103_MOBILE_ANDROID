using Microsoft.AspNetCore.Mvc;

namespace API_ATF_MOBILE.Controllers;

/// <summary>
/// Contrôleur pour accéder aux logs DIRIS en temps réel
/// </summary>
[ApiController]
[Route("api/diris/logs")]
public class DirisLogsController : ControllerBase
{
    private readonly ILogger<DirisLogsController> _logger;
    private readonly IWebHostEnvironment _environment;

    public DirisLogsController(
        ILogger<DirisLogsController> logger,
        IWebHostEnvironment environment)
    {
        _logger = logger;
        _environment = environment;
    }

    /// <summary>
    /// Récupérer les dernières lignes du fichier de log
    /// </summary>
    [HttpGet("recent")]
    public IActionResult GetRecentLogs([FromQuery] int lines = 100)
    {
        try
        {
            // Chercher le fichier de log le plus récent
            var logsPath = Path.Combine(_environment.ContentRootPath, "logs");
            
            if (!Directory.Exists(logsPath))
            {
                return Ok(new
                {
                    success = false,
                    message = "Logs directory not found",
                    logs = Array.Empty<string>()
                });
            }

            var logFiles = Directory.GetFiles(logsPath, "app-*.log")
                .OrderByDescending(f => new FileInfo(f).LastWriteTime)
                .ToList();

            if (!logFiles.Any())
            {
                return Ok(new
                {
                    success = false,
                    message = "No log files found",
                    logs = Array.Empty<string>()
                });
            }

            var latestLogFile = logFiles.First();
            var logLines = ReadLastLines(latestLogFile, lines);

            return Ok(new
            {
                success = true,
                logFile = Path.GetFileName(latestLogFile),
                linesReturned = logLines.Count,
                logs = logLines
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reading logs");
            return StatusCode(500, new
            {
                success = false,
                message = "Error reading logs",
                error = ex.Message
            });
        }
    }

    /// <summary>
    /// Récupérer les logs DIRIS uniquement (acquisition, devices, etc.)
    /// </summary>
    [HttpGet("acquisition")]
    public IActionResult GetAcquisitionLogs([FromQuery] int lines = 100)
    {
        try
        {
            var logsPath = Path.Combine(_environment.ContentRootPath, "logs");
            
            if (!Directory.Exists(logsPath))
            {
                return Ok(new
                {
                    success = false,
                    message = "Logs directory not found",
                    logs = Array.Empty<string>()
                });
            }

            var logFiles = Directory.GetFiles(logsPath, "app-*.log")
                .OrderByDescending(f => new FileInfo(f).LastWriteTime)
                .ToList();

            if (!logFiles.Any())
            {
                return Ok(new
                {
                    success = false,
                    message = "No log files found",
                    logs = Array.Empty<string>()
                });
            }

            var latestLogFile = logFiles.First();
            var allLines = ReadLastLines(latestLogFile, lines * 3); // Lire plus pour filtrer
            
            // Filtrer les lignes contenant des mots-clés DIRIS
            var dirisKeywords = new[] { "DIRIS", "DEVICE", "CYCLE", "WATCHDOG", "Acquisition" };
            var dirisLines = allLines
                .Where(line => dirisKeywords.Any(keyword => line.Contains(keyword, StringComparison.OrdinalIgnoreCase)))
                .Take(lines)
                .ToList();

            return Ok(new
            {
                success = true,
                logFile = Path.GetFileName(latestLogFile),
                linesReturned = dirisLines.Count,
                logs = dirisLines
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reading acquisition logs");
            return StatusCode(500, new
            {
                success = false,
                message = "Error reading acquisition logs",
                error = ex.Message
            });
        }
    }

    /// <summary>
    /// Récupérer les erreurs récentes uniquement
    /// </summary>
    [HttpGet("errors")]
    public IActionResult GetErrorLogs([FromQuery] int lines = 50)
    {
        try
        {
            var logsPath = Path.Combine(_environment.ContentRootPath, "logs");
            
            if (!Directory.Exists(logsPath))
            {
                return Ok(new
                {
                    success = false,
                    message = "Logs directory not found",
                    logs = Array.Empty<string>()
                });
            }

            var logFiles = Directory.GetFiles(logsPath, "app-*.log")
                .OrderByDescending(f => new FileInfo(f).LastWriteTime)
                .ToList();

            if (!logFiles.Any())
            {
                return Ok(new
                {
                    success = false,
                    message = "No log files found",
                    logs = Array.Empty<string>()
                });
            }

            var latestLogFile = logFiles.First();
            var allLines = ReadLastLines(latestLogFile, lines * 5); // Lire plus pour filtrer
            
            // Filtrer les lignes contenant ERR, WRN, CRT
            var errorKeywords = new[] { "[ERR]", "[WRN]", "[CRT]", "ERROR", "CRITICAL", "!!!" };
            var errorLines = allLines
                .Where(line => errorKeywords.Any(keyword => line.Contains(keyword, StringComparison.OrdinalIgnoreCase)))
                .Take(lines)
                .ToList();

            return Ok(new
            {
                success = true,
                logFile = Path.GetFileName(latestLogFile),
                linesReturned = errorLines.Count,
                logs = errorLines
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reading error logs");
            return StatusCode(500, new
            {
                success = false,
                message = "Error reading error logs",
                error = ex.Message
            });
        }
    }

    /// <summary>
    /// Lire les N dernières lignes d'un fichier
    /// </summary>
    private List<string> ReadLastLines(string filePath, int numberOfLines)
    {
        var lines = new List<string>();
        
        try
        {
            using var fileStream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
            using var reader = new StreamReader(fileStream);
            
            var allLines = new List<string>();
            string? line;
            while ((line = reader.ReadLine()) != null)
            {
                allLines.Add(line);
            }
            
            // Prendre les N dernières lignes
            lines = allLines.Skip(Math.Max(0, allLines.Count - numberOfLines)).ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reading file {FilePath}", filePath);
        }
        
        return lines;
    }

    /// <summary>
    /// Lister tous les fichiers de log disponibles
    /// </summary>
    [HttpGet("files")]
    public IActionResult GetLogFiles()
    {
        try
        {
            var logsPath = Path.Combine(_environment.ContentRootPath, "logs");
            
            if (!Directory.Exists(logsPath))
            {
                return Ok(new
                {
                    success = false,
                    message = "Logs directory not found",
                    files = Array.Empty<object>()
                });
            }

            var logFiles = Directory.GetFiles(logsPath, "app-*.log")
                .Select(f => new FileInfo(f))
                .OrderByDescending(f => f.LastWriteTime)
                .Select(f => new
                {
                    name = f.Name,
                    sizeMB = Math.Round(f.Length / 1024.0 / 1024.0, 2),
                    lastModified = f.LastWriteTime,
                    created = f.CreationTime
                })
                .ToList();

            return Ok(new
            {
                success = true,
                filesCount = logFiles.Count,
                files = logFiles
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing log files");
            return StatusCode(500, new
            {
                success = false,
                message = "Error listing log files",
                error = ex.Message
            });
        }
    }
}

