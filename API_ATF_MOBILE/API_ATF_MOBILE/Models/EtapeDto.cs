// file: API_ATF_MOBILE/Models/EtapeDto.cs
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace API_ATF_MOBILE.Models
{
    public class EtapeDto
    {
        [JsonPropertyName("id_etape")]
        public int Id_Etape { get; set; }

        [JsonPropertyName("libelle_etape")]
        public string? Libelle_Etape { get; set; }

        [JsonPropertyName("affectation_etape")]
        public string? Affectation_Etape { get; set; }

        [JsonPropertyName("role_log")]
        public string? Role_Log { get; set; }

        [JsonPropertyName("phase_etape")]
        public string? Phase_Etape { get; set; }

        [JsonPropertyName("duree_etape")]
        public int? Duree_Etape { get; set; }

        [JsonPropertyName("description_etape")]
        public string? Description_Etape { get; set; }

        [JsonPropertyName("etat_etape")]
        public string? Etat_Etape { get; set; }

        [JsonPropertyName("temps_reel_etape")]
        public int? Temps_Reel_Etape { get; set; }

        [JsonPropertyName("commentaire_etape_1")]
        public string? Commentaire_Etape_1 { get; set; }

        [JsonPropertyName("predecesseurs")]
        public List<EtapeLienDto> Predecesseurs { get; set; } = new List<EtapeLienDto>();

        [JsonPropertyName("successeurs")]
        public List<EtapeLienDto> Successeurs { get; set; } = new List<EtapeLienDto>();
    }
}
