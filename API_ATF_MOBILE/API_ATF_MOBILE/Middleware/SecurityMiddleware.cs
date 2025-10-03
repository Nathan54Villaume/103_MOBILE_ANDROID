using System.Text;

namespace API_ATF_MOBILE.Middleware
{
    /// <summary>
    /// Middleware de sécurité pour empêcher l'exposition d'informations sensibles dans l'URL
    /// </summary>
    public class SecurityMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<SecurityMiddleware> _logger;

        public SecurityMiddleware(RequestDelegate next, ILogger<SecurityMiddleware> logger)
        {
            _next = next;
            _logger = logger;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            var requestPath = context.Request.Path.Value ?? "";
            
            // Vérifier si l'URL contient des paramètres d'authentification sensibles
            if (context.Request.Query.ContainsKey("username") || 
                context.Request.Query.ContainsKey("password") ||
                context.Request.Query.ContainsKey("token"))
            {
                _logger.LogWarning("🚨 SÉCURITÉ: Tentative d'accès avec paramètres sensibles dans l'URL - Path: {Path}", requestPath);
                
                // Rediriger vers la même page sans les paramètres sensibles
                var cleanUrl = $"{context.Request.Scheme}://{context.Request.Host}{requestPath}";
                context.Response.Redirect(cleanUrl, permanent: false);
                return;
            }

            // Vérifier les headers pour des informations sensibles
            if (context.Request.Headers.ContainsKey("X-Username") || 
                context.Request.Headers.ContainsKey("X-Password"))
            {
                _logger.LogWarning("🚨 SÉCURITÉ: Headers sensibles détectés - Path: {Path}", requestPath);
                
                // Supprimer les headers sensibles
                context.Request.Headers.Remove("X-Username");
                context.Request.Headers.Remove("X-Password");
            }

            await _next(context);
        }
    }
}
