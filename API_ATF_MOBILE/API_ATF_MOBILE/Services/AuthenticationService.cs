using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using API_ATF_MOBILE.Models;

namespace API_ATF_MOBILE.Services
{
    public interface IAuthenticationService
    {
        Task<LoginResponse> AuthenticateAsync(string username, string password);
        bool ValidateToken(string token);
        ClaimsPrincipal? GetPrincipalFromToken(string token);
    }

    public class AuthenticationService : IAuthenticationService
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<AuthenticationService> _logger;
        
        // Pour une vraie application, ces utilisateurs devraient être en base de données
        private readonly List<AdminUser> _users;

        public AuthenticationService(IConfiguration configuration, ILogger<AuthenticationService> logger)
        {
            _configuration = configuration;
            _logger = logger;

            // Utilisateurs par défaut (dans une vraie app, ceci serait en base de données)
            _users = new List<AdminUser>
            {
                new AdminUser
                {
                    Username = "admin",
                    // Mot de passe: "admin123" - Hashé avec SHA256 (à remplacer par bcrypt en production)
                    PasswordHash = HashPassword("admin123"),
                    Role = "Admin",
                    CreatedAt = DateTime.Now
                },
                new AdminUser
                {
                    Username = "operateur",
                    // Mot de passe: "oper123"
                    PasswordHash = HashPassword("oper123"),
                    Role = "Operator",
                    CreatedAt = DateTime.Now
                }
            };
        }

        public async Task<LoginResponse> AuthenticateAsync(string username, string password)
        {
            try
            {
                // Vérifier les identifiants
                var user = _users.FirstOrDefault(u => 
                    u.Username.Equals(username, StringComparison.OrdinalIgnoreCase));

                if (user == null)
                {
                    _logger.LogWarning("Tentative de connexion échouée pour {Username}", username);
                    return new LoginResponse
                    {
                        Success = false,
                        Message = "Nom d'utilisateur ou mot de passe incorrect"
                    };
                }

                var passwordHash = HashPassword(password);
                if (user.PasswordHash != passwordHash)
                {
                    _logger.LogWarning("Mot de passe incorrect pour {Username}", username);
                    return new LoginResponse
                    {
                        Success = false,
                        Message = "Nom d'utilisateur ou mot de passe incorrect"
                    };
                }

                // Générer le token JWT
                var token = GenerateJwtToken(user);
                var expiresAt = DateTime.Now.AddHours(8);

                // Mettre à jour la dernière connexion
                user.LastLogin = DateTime.Now;

                _logger.LogInformation("Connexion réussie pour {Username}", username);

                return await Task.FromResult(new LoginResponse
                {
                    Success = true,
                    Token = token,
                    ExpiresAt = expiresAt,
                    Message = "Connexion réussie",
                    User = new AdminUserInfo
                    {
                        Username = user.Username,
                        Role = user.Role,
                        LastLogin = user.LastLogin
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur lors de l'authentification");
                return new LoginResponse
                {
                    Success = false,
                    Message = "Erreur lors de l'authentification"
                };
            }
        }

        public bool ValidateToken(string token)
        {
            try
            {
                var principal = GetPrincipalFromToken(token);
                return principal != null;
            }
            catch
            {
                return false;
            }
        }

        public ClaimsPrincipal? GetPrincipalFromToken(string token)
        {
            try
            {
                var tokenHandler = new JwtSecurityTokenHandler();
                var key = Encoding.UTF8.GetBytes(GetJwtSecret());

                var validationParameters = new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(key),
                    ValidateIssuer = true,
                    ValidIssuer = GetJwtIssuer(),
                    ValidateAudience = true,
                    ValidAudience = GetJwtAudience(),
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.Zero
                };

                var principal = tokenHandler.ValidateToken(token, validationParameters, out var validatedToken);
                return principal;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Échec de validation du token");
                return null;
            }
        }

        private string GenerateJwtToken(AdminUser user)
        {
            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.UTF8.GetBytes(GetJwtSecret());

            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.Name, user.Username),
                new Claim(ClaimTypes.Role, user.Role),
                new Claim("UserId", user.Username),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
            };

            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(claims),
                Expires = DateTime.UtcNow.AddHours(8),
                Issuer = GetJwtIssuer(),
                Audience = GetJwtAudience(),
                SigningCredentials = new SigningCredentials(
                    new SymmetricSecurityKey(key),
                    SecurityAlgorithms.HmacSha256Signature)
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);
            return tokenHandler.WriteToken(token);
        }

        private string HashPassword(string password)
        {
            using var sha256 = SHA256.Create();
            var bytes = Encoding.UTF8.GetBytes(password);
            var hash = sha256.ComputeHash(bytes);
            return Convert.ToBase64String(hash);
        }

        private string GetJwtSecret()
        {
            // En production, cette clé doit être dans les secrets / variables d'environnement
            return _configuration["Jwt:Secret"] ?? "VotreCleSecreteTresTresLongueEtComplexePourAPI_ATF_MOBILE_2024!";
        }

        private string GetJwtIssuer()
        {
            return _configuration["Jwt:Issuer"] ?? "API_ATF_MOBILE";
        }

        private string GetJwtAudience()
        {
            return _configuration["Jwt:Audience"] ?? "API_ATF_MOBILE_Admin";
        }
    }
}

