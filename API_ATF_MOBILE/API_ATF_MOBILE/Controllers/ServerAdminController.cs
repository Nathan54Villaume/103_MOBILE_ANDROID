using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using API_ATF_MOBILE.Services;
using API_ATF_MOBILE.Models;
using System.Diagnostics;

namespace API_ATF_MOBILE.Controllers
{
    [ApiController]
    [Route("api/admin")]
    [Authorize] // Tous les endpoints nécessitent une authentification
    public class ServerAdminController : ControllerBase
    {
        private readonly IServerMonitorService _serverMonitor;
        private readonly IDatabaseHealthService _databaseHealth;
        private readonly IS7MonitorService _s7Monitor;
        private readonly ILogReaderService _logReader;
        private readonly IConfiguration _configuration;
        private readonly ILogger<ServerAdminController> _logger;

        public ServerAdminController(
            IServerMonitorService serverMonitor,
            IDatabaseHealthService databaseHealth,
            IS7MonitorService s7Monitor,
            ILogReaderService logReader,
            IConfiguration configuration,
            ILogger<ServerAdminController> logger)
        {
            _serverMonitor = serverMonitor;
            _databaseHealth = databaseHealth;
            _s7Monitor = s7Monitor;
            _logReader = logReader;
            _configuration = configuration;
            _logger = logger;
        }

        /// <summary>
        /// Obtenir l'état général du serveur
        /// </summary>
        [HttpGet("status")]
        public ActionResult<ServerStatus> GetServerStatus()
        {
            try
            {
                var status = _serverMonitor.GetServerStatus();
                return Ok(status);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur lors de la récupération du statut serveur");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Obtenir les métriques du serveur (CPU, mémoire, etc.)
        /// </summary>
        [HttpGet("metrics")]
        public ActionResult<ServerMetrics> GetServerMetrics()
        {
            try
            {
                var metrics = _serverMonitor.GetServerMetrics();
                return Ok(metrics);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur lors de la récupération des métriques");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Health check général de l'API
        /// </summary>
        [HttpGet("health")]
        public async Task<ActionResult<HealthCheckResult>> GetHealthCheck()
        {
            try
            {
                var result = new HealthCheckResult
                {
                    Status = "Healthy",
                    CheckTime = DateTime.Now,
                    ServerStatus = _serverMonitor.GetServerStatus(),
                    DatabaseHealth = await _databaseHealth.CheckAllDatabasesAsync(),
                    S7Status = await _s7Monitor.GetConnectionStatusAsync()
                };

                // Déterminer le statut global
                var hasUnhealthyDb = result.DatabaseHealth.Any(db => !db.IsConnected);
                if (hasUnhealthyDb)
                {
                    result.Status = "Degraded";
                }

                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur lors du health check");
                return StatusCode(500, new HealthCheckResult
                {
                    Status = "Unhealthy",
                    CheckTime = DateTime.Now,
                    ErrorMessage = ex.Message
                });
            }
        }

        /// <summary>
        /// Vérifier toutes les bases de données
        /// </summary>
        [HttpGet("database/health")]
        public async Task<ActionResult<List<DatabaseHealth>>> GetDatabaseHealth()
        {
            try
            {
                var health = await _databaseHealth.CheckAllDatabasesAsync();
                return Ok(health);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur lors de la vérification des bases de données");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Vérifier une base de données spécifique
        /// </summary>
        [HttpGet("database/health/{connectionName}")]
        public async Task<ActionResult<DatabaseHealth>> GetDatabaseHealthByName(string connectionName)
        {
            try
            {
                var health = await _databaseHealth.CheckDatabaseHealthAsync(connectionName);
                return Ok(health);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur lors de la vérification de {ConnectionName}", connectionName);
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Obtenir les statistiques d'une base de données
        /// </summary>
        [HttpGet("database/stats/{connectionName}")]
        public async Task<ActionResult<DatabaseStatistics>> GetDatabaseStatistics(string connectionName)
        {
            try
            {
                var stats = await _databaseHealth.GetDatabaseStatisticsAsync(connectionName);
                return Ok(stats);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur lors de la récupération des statistiques pour {ConnectionName}", connectionName);
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Obtenir toutes les connexions PLC
        /// </summary>
        [HttpGet("plc/connections")]
        public async Task<ActionResult<List<PlcConnectionStatus>>> GetPlcConnections([FromServices] IPlcConnectionService plcService)
        {
            try
            {
                var connections = await plcService.GetAllConnectionsAsync();
                var status = new List<PlcConnectionStatus>();
                
                foreach (var connection in connections)
                {
                    var isOnline = await plcService.TestConnectionAsync(connection.Id.ToString());
                    status.Add(new PlcConnectionStatus
                    {
                        Id = connection.Id,
                        Name = connection.Name,
                        IpAddress = connection.IpAddress,
                        Rack = connection.Rack,
                        Slot = connection.Slot,
                        Port = connection.Port,
                        CpuType = connection.CpuType,
                        Status = isOnline ? "Connecté" : "Déconnecté",
                        CreatedAt = connection.CreatedAt
                    });
                }

                return Ok(status);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur lors de la récupération des connexions PLC");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Ajouter une nouvelle connexion PLC
        /// </summary>
        [HttpPost("plc/connections")]
        public async Task<ActionResult<PlcConnection>> AddPlcConnection(
            [FromBody] PlcConnectionCreateDto dto,
            [FromServices] IPlcConnectionService plcService)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(dto.Name))
                {
                    return BadRequest(new { error = "Le nom est requis" });
                }

                if (string.IsNullOrWhiteSpace(dto.IpAddress))
                {
                    return BadRequest(new { error = "L'adresse IP est requise" });
                }

                var connection = await plcService.AddConnectionAsync(dto);
                return Ok(connection);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur lors de l'ajout de la connexion PLC");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Supprimer une connexion PLC
        /// </summary>
        [HttpDelete("plc/connections/{id}")]
        public async Task<ActionResult> DeletePlcConnection(
            string id,
            [FromServices] IPlcConnectionService plcService)
        {
            try
            {
                var success = await plcService.DeleteConnectionAsync(id);
                
                if (!success)
                {
                    return NotFound(new { error = "Connexion introuvable" });
                }

                return Ok(new { success = true, message = "Connexion supprimée" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur lors de la suppression de la connexion PLC");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Mettre à jour une connexion PLC
        /// </summary>
        [HttpPut("plc/connections/{id}")]
        public async Task<ActionResult<PlcConnection>> UpdatePlcConnection(
            string id,
            [FromBody] PlcConnectionCreateDto dto,
            [FromServices] IPlcConnectionService plcService)
        {
            try
            {
                var connection = await plcService.UpdateConnectionAsync(id, dto);
                
                if (connection == null)
                {
                    return NotFound(new { error = "Connexion introuvable" });
                }

                return Ok(connection);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur lors de la mise à jour de la connexion PLC");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Tester une connexion PLC spécifique
        /// </summary>
        [HttpGet("plc/connections/{id}/test")]
        public async Task<ActionResult<object>> TestPlcConnection(
            string id,
            [FromServices] IPlcConnectionService plcService)
        {
            try
            {
                var connection = await plcService.GetConnectionByIdAsync(id);
                if (connection == null)
                {
                    return NotFound(new { error = "Connexion PLC non trouvée" });
                }

                var isOnline = await plcService.TestConnectionAsync(id);
                var responseTime = await plcService.GetConnectionResponseTimeAsync(id);

                return Ok(new
                {
                    id = id,
                    name = connection.Name,
                    ipAddress = connection.IpAddress,
                    status = isOnline ? "Connecté" : "Déconnecté",
                    isOnline = isOnline,
                    responseTime = responseTime,
                    lastChecked = DateTime.Now
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur lors du test de connexion PLC {Id}", id);
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Obtenir les logs récents
        /// </summary>
        [HttpGet("logs")]
        public async Task<ActionResult<List<LogEntry>>> GetLogs(
            [FromQuery] int count = 100,
            [FromQuery] string? level = null)
        {
            try
            {
                var logs = await _logReader.GetRecentLogsAsync(count, level);
                return Ok(logs);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur lors de la récupération des logs");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Rechercher dans les logs
        /// </summary>
        [HttpGet("logs/search")]
        public async Task<ActionResult<List<LogEntry>>> SearchLogs(
            [FromQuery] string searchTerm,
            [FromQuery] int maxResults = 100)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(searchTerm))
                {
                    return BadRequest(new { error = "Le terme de recherche est requis" });
                }

                var logs = await _logReader.SearchLogsAsync(searchTerm, maxResults);
                return Ok(logs);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur lors de la recherche dans les logs");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Obtenir les statistiques des logs
        /// </summary>
        [HttpGet("logs/stats")]
        public async Task<ActionResult<LogStatistics>> GetLogStatistics()
        {
            try
            {
                var stats = await _logReader.GetLogStatisticsAsync();
                return Ok(stats);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur lors de la récupération des statistiques de logs");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Obtenir la configuration actuelle (sans mots de passe)
        /// </summary>
        [HttpGet("config")]
        public ActionResult<ConfigurationInfo> GetConfiguration()
        {
            try
            {
                var config = new ConfigurationInfo
                {
                    Environment = _configuration["ASPNETCORE_ENVIRONMENT"] ?? "Production",
                    Urls = _configuration["ASPNETCORE_URLS"] ?? "http://0.0.0.0:8088",
                    ConnectionStrings = _configuration.GetSection("ConnectionStrings")
                        .GetChildren()
                        .Select(c => new ConnectionStringInfo
                        {
                            Name = c.Key,
                            Value = MaskPassword(c.Value ?? "")
                        })
                        .ToList(),
                    LogLevel = _configuration["Logging:LogLevel:Default"] ?? "Information",
                    AllowedHosts = _configuration["AllowedHosts"] ?? "*"
                };

                return Ok(config);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur lors de la récupération de la configuration");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Obtenir les informations sur tous les contrôleurs
        /// </summary>
        [HttpGet("controllers")]
        public ActionResult<List<ControllerInfo>> GetControllers()
        {
            try
            {
                var assembly = typeof(ServerAdminController).Assembly;
                var controllers = assembly.GetTypes()
                    .Where(t => typeof(ControllerBase).IsAssignableFrom(t) && !t.IsAbstract)
                    .Select(t => new ControllerInfo
                    {
                        Name = t.Name.Replace("Controller", ""),
                        FullName = t.FullName ?? t.Name,
                        Routes = GetControllerRoutes(t)
                    })
                    .OrderBy(c => c.Name)
                    .ToList();

                return Ok(controllers);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur lors de la récupération des contrôleurs");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Obtenir un tableau de bord complet
        /// </summary>
        [HttpGet("dashboard")]
        public async Task<ActionResult<DashboardData>> GetDashboard()
        {
            try
            {
                var dashboard = new DashboardData
                {
                    ServerStatus = _serverMonitor.GetServerStatus(),
                    ServerMetrics = _serverMonitor.GetServerMetrics(),
                    DatabaseHealth = await _databaseHealth.CheckAllDatabasesAsync(),
                    S7Status = await _s7Monitor.GetConnectionStatusAsync(),
                    LogStats = await _logReader.GetLogStatisticsAsync(),
                    Timestamp = DateTime.Now
                };

                return Ok(dashboard);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur lors de la récupération du dashboard");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        // Méthodes utilitaires privées
        private string MaskPassword(string connectionString)
        {
            return System.Text.RegularExpressions.Regex.Replace(
                connectionString,
                @"Password=([^;]*)",
                "Password=****",
                System.Text.RegularExpressions.RegexOptions.IgnoreCase
            );
        }

        private List<string> GetControllerRoutes(Type controllerType)
        {
            var routes = new List<string>();
            
            var routeAttribute = controllerType.GetCustomAttributes(typeof(RouteAttribute), false)
                .FirstOrDefault() as RouteAttribute;
            
            var baseRoute = routeAttribute?.Template ?? "";

            var methods = controllerType.GetMethods()
                .Where(m => m.GetCustomAttributes(true).Any(a => 
                    a is HttpGetAttribute || a is HttpPostAttribute || 
                    a is HttpPutAttribute || a is HttpDeleteAttribute));

            foreach (var method in methods)
            {
                var httpMethod = method.GetCustomAttributes(true)
                    .FirstOrDefault(a => 
                        a is HttpGetAttribute || a is HttpPostAttribute || 
                        a is HttpPutAttribute || a is HttpDeleteAttribute);
                
                if (httpMethod is HttpGetAttribute httpGet)
                {
                    var route = string.IsNullOrEmpty(httpGet.Template) 
                        ? baseRoute 
                        : $"{baseRoute}/{httpGet.Template}";
                    routes.Add($"GET {route}");
                }
                else if (httpMethod is HttpPostAttribute httpPost)
                {
                    var route = string.IsNullOrEmpty(httpPost.Template) 
                        ? baseRoute 
                        : $"{baseRoute}/{httpPost.Template}";
                    routes.Add($"POST {route}");
                }
                else if (httpMethod is HttpPutAttribute httpPut)
                {
                    var route = string.IsNullOrEmpty(httpPut.Template) 
                        ? baseRoute 
                        : $"{baseRoute}/{httpPut.Template}";
                    routes.Add($"PUT {route}");
                }
                else if (httpMethod is HttpDeleteAttribute httpDelete)
                {
                    var route = string.IsNullOrEmpty(httpDelete.Template) 
                        ? baseRoute 
                        : $"{baseRoute}/{httpDelete.Template}";
                    routes.Add($"DELETE {route}");
                }
            }

            return routes;
        }
    }

    // DTOs pour les requêtes/réponses
    public class S7ReadRequest
    {
        public string Address { get; set; } = string.Empty;
    }

    public class S7TestResult
    {
        public bool Success { get; set; }
        public long ResponseTimeMs { get; set; }
        public DateTime TestTime { get; set; }
        public string Message { get; set; } = string.Empty;
    }

    public class HealthCheckResult
    {
        public string Status { get; set; } = string.Empty;
        public DateTime CheckTime { get; set; }
        public string? ErrorMessage { get; set; }
        public ServerStatus? ServerStatus { get; set; }
        public List<DatabaseHealth>? DatabaseHealth { get; set; }
        public S7ConnectionStatus? S7Status { get; set; }
    }

    public class ConfigurationInfo
    {
        public string Environment { get; set; } = string.Empty;
        public string Urls { get; set; } = string.Empty;
        public List<ConnectionStringInfo> ConnectionStrings { get; set; } = new();
        public string LogLevel { get; set; } = string.Empty;
        public string AllowedHosts { get; set; } = string.Empty;
    }

    public class ConnectionStringInfo
    {
        public string Name { get; set; } = string.Empty;
        public string Value { get; set; } = string.Empty;
    }

    public class ControllerInfo
    {
        public string Name { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public List<string> Routes { get; set; } = new();
    }

    public class DashboardData
    {
        public ServerStatus ServerStatus { get; set; } = new();
        public ServerMetrics ServerMetrics { get; set; } = new();
        public List<DatabaseHealth> DatabaseHealth { get; set; } = new();
        public S7ConnectionStatus S7Status { get; set; } = new();
        public LogStatistics LogStats { get; set; } = new();
        public DateTime Timestamp { get; set; }
    }
}

