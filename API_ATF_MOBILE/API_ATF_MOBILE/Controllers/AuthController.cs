using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using API_ATF_MOBILE.Models;
using API_ATF_MOBILE.Services;

namespace API_ATF_MOBILE.Controllers
{
    [ApiController]
    [Route("api/auth")]
    public class AuthController : ControllerBase
    {
        private readonly IAuthenticationService _authService;
        private readonly ILogger<AuthController> _logger;

        public AuthController(IAuthenticationService authService, ILogger<AuthController> logger)
        {
            _authService = authService;
            _logger = logger;
        }

        /// <summary>
        /// Authentification admin - Obtenir un token JWT
        /// </summary>
        [HttpPost("login")]
        [AllowAnonymous]
        public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
                {
                    return BadRequest(new LoginResponse
                    {
                        Success = false,
                        Message = "Le nom d'utilisateur et le mot de passe sont requis"
                    });
                }

                var response = await _authService.AuthenticateAsync(request.Username, request.Password);

                if (!response.Success)
                {
                    return Unauthorized(response);
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur lors de la tentative de connexion");
                return StatusCode(500, new LoginResponse
                {
                    Success = false,
                    Message = "Erreur interne du serveur"
                });
            }
        }

        /// <summary>
        /// Vérifier si le token est valide
        /// </summary>
        [HttpGet("validate")]
        [Authorize]
        public ActionResult<object> ValidateToken()
        {
            var username = User.Identity?.Name;
            var role = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;

            return Ok(new
            {
                valid = true,
                username = username,
                role = role,
                timestamp = DateTime.Now
            });
        }

        /// <summary>
        /// Déconnexion (côté client supprimera le token)
        /// </summary>
        [HttpPost("logout")]
        [Authorize]
        public ActionResult Logout()
        {
            var username = User.Identity?.Name;
            _logger.LogInformation("Déconnexion de {Username}", username);

            return Ok(new
            {
                success = true,
                message = "Déconnexion réussie"
            });
        }

        /// <summary>
        /// Obtenir les informations de l'utilisateur connecté
        /// </summary>
        [HttpGet("me")]
        [Authorize]
        public ActionResult<AdminUserInfo> GetCurrentUser()
        {
            var username = User.Identity?.Name ?? "Unknown";
            var role = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value ?? "Unknown";

            return Ok(new AdminUserInfo
            {
                Username = username,
                Role = role,
                LastLogin = DateTime.Now
            });
        }

        /// <summary>
        /// TEST - Vérifier si l'utilisateur existe dans EQUIPE_RFID
        /// </summary>
        [HttpGet("test/check-user/{matricule}")]
        [AllowAnonymous]
        public async Task<ActionResult> TestCheckUser(string matricule, [FromServices] Data.ApplicationDbContext dbContext)
        {
            try
            {
                _logger.LogInformation("TEST: Recherche du matricule {Matricule}", matricule);
                
                var user = await dbContext.EquipeRfid
                    .FirstOrDefaultAsync(u => u.Matricule.Trim().ToLower() == matricule.Trim().ToLower());
                
                if (user == null)
                {
                    _logger.LogWarning("TEST: Utilisateur {Matricule} NON TROUVÉ", matricule);
                    return Ok(new
                    {
                        found = false,
                        message = $"Utilisateur {matricule} non trouvé dans EQUIPE_RFID"
                    });
                }
                
                _logger.LogInformation("TEST: Utilisateur {Matricule} TROUVÉ", matricule);
                return Ok(new
                {
                    found = true,
                    matricule = user.Matricule,
                    nom = user.Nom,
                    role = user.Role,
                    hasPassword = !string.IsNullOrEmpty(user.MotDePasse),
                    passwordLength = user.MotDePasse?.Length ?? 0,
                    affectation = user.Affectation
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "TEST: Erreur lors de la recherche de {Matricule}", matricule);
                return StatusCode(500, new
                {
                    error = ex.Message,
                    innerError = ex.InnerException?.Message,
                    stackTrace = ex.StackTrace
                });
            }
        }
    }
}
