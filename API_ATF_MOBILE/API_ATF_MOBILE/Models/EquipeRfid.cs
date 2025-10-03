using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace API_ATF_MOBILE.Models
{
    [Table("EQUIPE_RFID")]
    public class EquipeRfid
    {
        [Key]
        [Column("MATRICULE")]
        [MaxLength(50)]
        public string Matricule { get; set; } = string.Empty;

        [Column("NOM")]
        [MaxLength(100)]
        public string? Nom { get; set; }

        [Column("UID_1")]
        [MaxLength(50)]
        public string? Uid1 { get; set; }

        [Column("UID_2")]
        [MaxLength(50)]
        public string? Uid2 { get; set; }

        [Column("ROLE")]
        [MaxLength(50)]
        public string? Role { get; set; }

        [Column("AFFECTATION")]
        [MaxLength(100)]
        public string? Affectation { get; set; }

        [Column("AFFECTATION_OK")]
        public string? AffectationOk { get; set; }

        [Column("MOTDEPASSE")]
        [MaxLength(100)]
        public string? MotDePasse { get; set; }

        [Column("Priorite")]
        public int? Priorite { get; set; }
    }
}

