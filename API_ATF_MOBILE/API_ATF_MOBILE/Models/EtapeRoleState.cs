// file: Models/EtapeRoleState.cs
using System.ComponentModel.DataAnnotations.Schema;

namespace API_ATF_MOBILE.Models
{
    public class EtapeRoleState
    {
        // Foreign key to Etape
        public int EtapeId { get; set; }

        // Who is the operator
        public string Operateur { get; set; } = null!;

        // State for that operator on this step
        public string Etat { get; set; } = null!;

        // Navigation property
        [ForeignKey(nameof(EtapeId))]
        public Etape Etape { get; set; } = null!;
    }
}
