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
            
            // EXTENSION: Capturer la taille de la requête
            long? requestSize = context.Request.ContentLength;

            try
            {
                // EXTENSION: Capturer le corps de la réponse si nécessaire (pour logging détaillé)
                var originalBodyStream = context.Response.Body;
                using var responseBody = new MemoryStream();
                context.Response.Body = responseBody;
                
                await _next(context);
                stopwatch.Stop();

                // EXTENSION: Calculer la taille de la réponse
                long? responseSize = responseBody.Length;
                
                // Copier le corps de la réponse vers le stream original
                responseBody.Seek(0, SeekOrigin.Begin);
                await responseBody.CopyToAsync(originalBodyStream);

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
                        
                        // EXTENSION: Ajouter les détails HTTP enrichis
                        var httpDetails = new HttpLogDetails
                        {
                            Method = requestMethod,
                            Url = requestPath,
                            StatusCode = statusCode,
                            DurationMs = stopwatch.ElapsedMilliseconds,
                            RequestSize = requestSize,
                            ResponseSize = responseSize,
                            Endpoint = requestPath
                        };
                        
                        logService.AddLog(level, message, null, httpDetails, "API");
                    }
                }
            }
            catch (Exception ex)
            {
                stopwatch.Stop();
                var message = $"{requestMethod} {requestPath} → ERREUR ({stopwatch.ElapsedMilliseconds}ms)";
                
                _logger.LogError(ex, message);
                
                // EXTENSION: Ajouter les détails HTTP même en cas d'erreur
                var httpDetails = new HttpLogDetails
                {
                    Method = requestMethod,
                    Url = requestPath,
                    StatusCode = context.Response.StatusCode,
                    DurationMs = stopwatch.ElapsedMilliseconds,
                    RequestSize = requestSize,
                    Endpoint = requestPath
                };
                
                logService.AddLog("Error", message, ex.Message, httpDetails, "API");
                
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

