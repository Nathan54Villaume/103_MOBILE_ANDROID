using Microsoft.IdentityModel.Tokens;
using Microsoft.EntityFrameworkCore;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using API_ATF_MOBILE.Models;
using API_ATF_MOBILE.Data;

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
        private readonly ApplicationDbContext _dbContext;
        
        // Utilisateurs locaux en fallback si la base de données n'est pas accessible
        private readonly List<AdminUser> _fallbackUsers;

        public AuthenticationService(
            IConfiguration configuration, 
            ILogger<AuthenticationService> logger,
            ApplicationDbContext dbContext)
        {
            _configuration = configuration;
            _logger = logger;
            _dbContext = dbContext;

            // Utilisateurs de fallback (utilisés si la BD n'est pas accessible)
            _fallbackUsers = new List<AdminUser>
            {
                new AdminUser
                {
                    Id = 1,
                    Username = "admin",
                    // Mot de passe: "aiadmin" - Hashé avec SHA256
                    PasswordHash = HashPassword("aiadmin"),
                    Role = "Admin",
                    CreatedAt = DateTime.Now
                }
            };
        }

        public async Task<LoginResponse> AuthenticateAsync(string username, string password)
        {
            try
            {
                EquipeRfid? equipeUser = null;
                AdminUser? adminUser = null;

                // 1. Essayer de trouver l'utilisateur dans la table EQUIPE_RFID
                try
                {
                    _logger.LogInformation("Recherche de l'utilisateur {Username} dans EQUIPE_RFID", username);
                    
                    // Nettoyer le matricule des espaces
                    var cleanUsername = username?.Trim() ?? string.Empty;
                    
                    equipeUser = await _dbContext.EquipeRfid
                        .FirstOrDefaultAsync(u => u.Matricule.Trim().ToLower() == cleanUsername.ToLower());
                    
                    if (equipeUser != null)
                    {
                        _logger.LogInformation("Utilisateur {Matricule} trouvé dans EQUIPE_RFID (Nom: {Nom}, Role: {Role})", 
                            equipeUser.Matricule, equipeUser.Nom, equipeUser.Role);
                        
                        // Nettoyer le mot de passe des espaces
                        var cleanPassword = password?.Trim() ?? string.Empty;
                        var dbPassword = equipeUser.MotDePasse?.Trim() ?? string.Empty;
                        
                        _logger.LogInformation("Comparaison des mots de passe - Longueur reçue: {ReceivedLength}, Longueur BD: {DbLength}", 
                            cleanPassword.Length, dbPassword.Length);
                        
                        // Vérifier le mot de passe (comparaison directe, pas de hash)
                        if (dbPassword != cleanPassword)
                        {
                            _logger.LogWarning("Mot de passe incorrect pour {Matricule} - Les mots de passe ne correspondent pas", equipeUser.Matricule);
                            return new LoginResponse
                            {
                                Success = false,
                                Message = "Nom d'utilisateur ou mot de passe incorrect"
                            };
                        }

                        // Générer le token JWT pour l'utilisateur EQUIPE_RFID
                        adminUser = new AdminUser
                        {
                            Username = equipeUser.Matricule,
                            PasswordHash = string.Empty, // Non utilisé pour EQUIPE_RFID
                            Role = equipeUser.Role ?? "Operateur",
                            CreatedAt = DateTime.Now,
                            LastLogin = DateTime.Now
                        };
                        
                        _logger.LogInformation("AdminUser créé pour {Username} avec le rôle {Role}", adminUser.Username, adminUser.Role);
                    }
                    else
                    {
                        _logger.LogInformation("Aucun utilisateur trouvé dans EQUIPE_RFID pour le matricule {Username}", cleanUsername);
                    }
                }
                catch (Exception dbEx)
                {
                    _logger.LogError(dbEx, "Erreur lors de la recherche dans EQUIPE_RFID pour {Username}", username);
                }

                // 2. Si pas trouvé en BD, chercher dans les utilisateurs de fallback
                if (adminUser == null)
                {
                    adminUser = _fallbackUsers.FirstOrDefault(u => 
                        u.Username.Equals(username, StringComparison.OrdinalIgnoreCase));
                    
                    if (adminUser != null)
                    {
                        _logger.LogInformation("Utilisateur {Username} trouvé dans les utilisateurs de fallback", username);
                        
                        // Vérifier le mot de passe hashé pour les utilisateurs de fallback
                        var passwordHash = HashPassword(password);
                        if (adminUser.PasswordHash != passwordHash)
                        {
                            _logger.LogWarning("Mot de passe incorrect pour {Username}", username);
                            return new LoginResponse
                            {
                                Success = false,
                                Message = "Nom d'utilisateur ou mot de passe incorrect"
                            };
                        }
                    }
                }

                // 3. Si toujours pas trouvé, échec d'authentification
                if (adminUser == null)
                {
                    _logger.LogWarning("Tentative de connexion échouée pour {Username} - utilisateur non trouvé", username);
                    return new LoginResponse
                    {
                        Success = false,
                        Message = "Nom d'utilisateur ou mot de passe incorrect"
                    };
                }

                // 4. Générer le token JWT
                var token = GenerateJwtToken(adminUser);
                var expiresAt = DateTime.Now.AddHours(8);

                _logger.LogInformation("Connexion réussie pour {Username}", username);

                return new LoginResponse
                {
                    Success = true,
                    Token = token,
                    ExpiresAt = expiresAt,
                    Message = "Connexion réussie",
                    User = new AdminUserInfo
                    {
                        Username = adminUser.Username,
                        Role = adminUser.Role,
                        LastLogin = adminUser.LastLogin
                    }
                };
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

