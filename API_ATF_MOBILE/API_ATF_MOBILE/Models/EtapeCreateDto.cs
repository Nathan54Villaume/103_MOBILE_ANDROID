// file: API_ATF_MOBILE/Models/EtapeCreateDto.cs
namespace API_ATF_MOBILE.Models
{
    public class EtapeCreateDto
    {
        public string? Libelle_Etape { get; set; }
        public string? Affectation_Etape { get; set; }
        public string? Role_Log { get; set; }
        public string? Phase_Etape { get; set; }
        public int? Duree_Etape { get; set; }
        public string? Description_Etape { get; set; }
        public string? Etat_Etape { get; set; }
        public int? Temps_Reel_Etape { get; set; }
        public string? Commentaire_Etape_1 { get; set; }
        // Passage en string pour stocker "9!7!11", "71!71 ou 72", etc.
        public string? Predecesseur_Etape { get; set; }
        public string? Successeur_Etape { get; set; }
    }
}
