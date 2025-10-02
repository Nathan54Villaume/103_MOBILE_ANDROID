using API_ATF_MOBILE.Services;
using System.Diagnostics;

namespace API_ATF_MOBILE.Middleware
{
    public class RequestLoggingMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<RequestLoggingMiddleware> _logger;

        public RequestLoggingMiddleware(RequestDelegate next, ILogger<RequestLoggingMiddleware> logger)
        {
            _next = next;
            _logger = logger;
        }

        public async Task InvokeAsync(HttpContext context, ILogReaderService logService)
        {
            var requestPath = context.Request.Path.Value ?? "";
            
            // OPTIMISATION : Ignorer les fichiers statiques (CSS, JS, images, etc.)
            if (IsStaticFile(requestPath))
            {
                await _next(context);
                return;
            }

            var stopwatch = Stopwatch.StartNew();
            var requestMethod = context.Request.Method;

            try
            {
                await _next(context);
                stopwatch.Stop();

                // Logger uniquement les requêtes API importantes
                if (requestPath.StartsWith("/api/"))
                {
                    var statusCode = context.Response.StatusCode;
                    var level = statusCode >= 400 ? "Warning" : "Information";
                    var message = $"{requestMethod} {requestPath} → {statusCode} ({stopwatch.ElapsedMilliseconds}ms)";

                    // Logger seulement si > 100ms ou erreur (pour réduire le bruit)
                    if (stopwatch.ElapsedMilliseconds > 100 || statusCode >= 400)
                    {
                        _logger.Log(statusCode >= 400 ? LogLevel.Warning : LogLevel.Information, message);
                        logService.AddLog(level, message);
                    }
                }
            }
            catch (Exception ex)
            {
                stopwatch.Stop();
                var message = $"{requestMethod} {requestPath} → ERREUR ({stopwatch.ElapsedMilliseconds}ms)";
                
                _logger.LogError(ex, message);
                logService.AddLog("Error", message, ex.Message);
                
                throw;
            }
        }

        private bool IsStaticFile(string path)
        {
            var staticExtensions = new[] { ".css", ".js", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".woff", ".woff2", ".ttf", ".eot", ".map" };
            return staticExtensions.Any(ext => path.EndsWith(ext, StringComparison.OrdinalIgnoreCase));
        }
    }
}

