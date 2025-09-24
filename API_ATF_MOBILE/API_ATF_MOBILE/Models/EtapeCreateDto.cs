using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace API_ATF_MOBILE.Models
{
    public class EtapeCreateDto
    {
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

        // map des états par opérateur
        [JsonPropertyName("etat_par_role")]
        public Dictionary<string, string>? EtatParRole { get; set; }

        [JsonPropertyName("temps_reel_etape")]
        public int? Temps_Reel_Etape { get; set; }

        [JsonPropertyName("commentaire_etape_1")]
        public string? Commentaire_Etape_1 { get; set; }

        // JSON string: [{"operateur":"...","ids":[1,2]}]
        [JsonPropertyName("predecesseur_etape")]
        public string? Predecesseur_Etape { get; set; }

        // JSON string: idem
        [JsonPropertyName("successeur_etape")]
        public string? Successeur_Etape { get; set; }

        [JsonPropertyName("conditions_a_valider")]
        public string? Conditions_A_Valider { get; set; }
    }
}
