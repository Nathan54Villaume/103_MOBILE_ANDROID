using System.Collections.Generic; // Ajouter ce using
using System.Text.Json.Serialization;

namespace API_ATF_MOBILE.Models
{
    public class EtapeValidationDto
    {
        [JsonPropertyName("id_etape")]
        public int Id_Etape { get; set; }

        [JsonPropertyName("role_log")]
        public string? Role_Log { get; set; }

        [JsonPropertyName("description")]
        public string? Description { get; set; }

        [JsonPropertyName("commentaire")]
        public string? Commentaire { get; set; }

        // Le nom de la propriété C# est "TempsReel", mais le JSON est "temps_reel"
        // La sérialisation est probablement gérée ailleurs (e.g. `tempsReel` en kotlin)
        // Pour être sûr, on garde le nom C# mais on peut forcer le nom JSON si besoin.
        [JsonPropertyName("tempsReel")] // Renommé de "temps_reel" pour correspondre au DTO Kotlin
        public int? TempsReel { get; set; }

        // ▼▼▼ AJOUTER CETTE PROPRIÉTÉ ▼▼▼
        [JsonPropertyName("EtatParRole")]
        public Dictionary<string, string>? EtatParRole { get; set; }
    }
}