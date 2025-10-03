// file: API_ATF_MOBILE/Models/Etape.cs
using API_ATF_MOBILE.Models;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace API_ATF_MOBILE.Models
{
    public class Etape
    {
        [Key]
        public int Id_Etape { get; set; }
        public string? Libelle_Etape { get; set; }
        public string? Affectation_Etape { get; set; }
        public string? Role_Log { get; set; }
        public string? Phase_Etape { get; set; }
        public int? Duree_Etape { get; set; }
        public string? Description_Etape { get; set; }

        // On retire l'ancien champ Etat_Etape :
        // public string? Etat_Etape { get; set; }

        // On ajoute � la place la navigation vers les �tats par r�le
        public ICollection<EtapeRoleState> RoleStates { get; set; } = new List<EtapeRoleState>();

        public int? Temps_Reel_Etape { get; set; }
        public string? Commentaire_Etape_1 { get; set; }
        public string? Predecesseur_Etape { get; set; }
        public string? Successeur_Etape { get; set; }
        public string? Conditions_A_Valider { get; set; }
    }
}
