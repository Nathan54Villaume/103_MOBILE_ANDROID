// file: API_ATF_MOBILE/Models/EtapeValidationDto.cs
using System.Text.Json.Serialization;

namespace API_ATF_MOBILE.Models
{
    public class EtapeValidationDto
    {
        [JsonPropertyName("id_etape")]
        public int Id_Etape { get; set; }

        [JsonPropertyName("commentaire")]
        public string? Commentaire { get; set; }

        [JsonPropertyName("description")]
        public string? Description { get; set; }

        [JsonPropertyName("tempsReel")]
        public int? TempsReel { get; set; }
    }
}
