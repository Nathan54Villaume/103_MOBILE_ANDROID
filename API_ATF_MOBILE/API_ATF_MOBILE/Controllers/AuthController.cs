using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using System.Data;

namespace API_ATF_MOBILE.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly IConfiguration _config;

        public AuthController(IConfiguration config)
        {
            _config = config;
        }

        [HttpPost("login")]
        public IActionResult Login([FromBody] LoginRequest request)
        {
            using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
            using var cmd = new SqlCommand(@"
                SELECT NOM, ROLE, MOTDEPASSE, Source
                FROM [AI_ATS].[dbo].[vw_EquipeRFID_UniqueFiltre]
                WHERE MATRICULE = @Matricule
            ", conn);

            cmd.Parameters.AddWithValue("@Matricule", request.Matricule);

            conn.Open();
            using var reader = cmd.ExecuteReader();

            if (!reader.Read())
                return Unauthorized("Matricule inconnu.");

            var nom = reader["NOM"]?.ToString()?.Trim();
            var role = reader["ROLE"]?.ToString()?.Trim()?.ToUpperInvariant();
            var motDePasseEnBase = reader["MOTDEPASSE"]?.ToString()?.Trim();
            var source = reader["Source"]?.ToString()?.Trim()?.ToUpperInvariant();

            if (string.IsNullOrEmpty(role))
                return Unauthorized("Rôle manquant ou invalide.");

            if (string.IsNullOrEmpty(motDePasseEnBase) || motDePasseEnBase != request.MotDePasse)
                return Unauthorized("Mot de passe incorrect.");

            return Ok(new
            {
                Matricule = request.Matricule,
                Nom = nom,
                Role = role,
                Source = source
            });
        }

        [HttpPost("change-password")]
        public IActionResult ChangePassword([FromBody] ChangePasswordRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Matricule) ||
                string.IsNullOrWhiteSpace(request.AncienMotDePasse) ||
                string.IsNullOrWhiteSpace(request.NouveauMotDePasse))
            {
                return BadRequest("Tous les champs sont obligatoires.");
            }

            using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
            conn.Open();

            // Vérifie la source (ATS ou ATR)
            using var sourceCmd = new SqlCommand(@"
                SELECT Source
                FROM [AI_ATS].[dbo].[vw_EquipeRFID_UniqueFiltre]
                WHERE MATRICULE = @Matricule
            ", conn);
            sourceCmd.Parameters.AddWithValue("@Matricule", request.Matricule);
            var source = sourceCmd.ExecuteScalar()?.ToString()?.Trim()?.ToUpperInvariant();

            if (source == null)
                return NotFound("Matricule introuvable.");

            if (source != "ATS")
                return Unauthorized("⚠️ Mot de passe modifiable uniquement pour les comptes ATS.");

            // Vérifie le mot de passe actuel dans la table ATS (seule source modifiable)
            using var checkCmd = new SqlCommand(@"
                SELECT MOTDEPASSE 
                FROM [AI_ATS].[dbo].[EQUIPE_RFID]
                WHERE MATRICULE = @Matricule
            ", conn);
            checkCmd.Parameters.AddWithValue("@Matricule", request.Matricule);

            var motDePasseActuel = checkCmd.ExecuteScalar()?.ToString()?.Trim();

            if (motDePasseActuel == null)
                return NotFound("Matricule introuvable dans la table ATS.");

            if (motDePasseActuel != request.AncienMotDePasse)
                return Unauthorized("Ancien mot de passe incorrect.");

            using var updateCmd = new SqlCommand(@"
                UPDATE [AI_ATS].[dbo].[EQUIPE_RFID]
                SET MOTDEPASSE = @Nouveau
                WHERE MATRICULE = @Matricule
            ", conn);
            updateCmd.Parameters.AddWithValue("@Nouveau", request.NouveauMotDePasse);
            updateCmd.Parameters.AddWithValue("@Matricule", request.Matricule);

            int rows = updateCmd.ExecuteNonQuery();

            return Ok(new { Message = "✅ Mot de passe mis à jour avec succès." });
        }
    }

    public class LoginRequest
    {
        public string Matricule { get; set; } = "";
        public string MotDePasse { get; set; } = "";
    }

    public class ChangePasswordRequest
    {
        public string Matricule { get; set; } = "";
        public string AncienMotDePasse { get; set; } = "";
        public string NouveauMotDePasse { get; set; } = "";
    }
}
