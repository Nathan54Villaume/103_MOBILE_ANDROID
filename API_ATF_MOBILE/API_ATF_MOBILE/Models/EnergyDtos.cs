namespace API_ATF_MOBILE.Models
{
    // Représente un snapshot (photo instantanée)
    public class EnergySnapshotDto
    {
        public DateTime Ts { get; set; }
        public decimal? P_Kw { get; set; }
        public decimal? Q_Kvar { get; set; }
        public decimal? Pf { get; set; }
        public decimal? U12_V { get; set; }
        public decimal? U23_V { get; set; }
        public decimal? U31_V { get; set; }
        public decimal? I1_A { get; set; }
        public decimal? I2_A { get; set; }
        public decimal? I3_A { get; set; }
        public decimal? E_Kwh { get; set; }
    }

    // Représente un point temporel (courbe)
    public class EnergyPointDto
    {
        public DateTime X { get; set; }   // Timestamp
        public decimal Y { get; set; }    // Valeur
    }

    // Représente une série temporelle complète
    public class EnergySeriesDto
    {
        public List<EnergyPointDto> P_Kw { get; set; } = new();
        public List<EnergyPointDto> Q_Kvar { get; set; } = new();
        public List<EnergyPointDto> Pf { get; set; } = new();
        public List<EnergyPointDto> U12_V { get; set; } = new();
        public List<EnergyPointDto> U23_V { get; set; } = new();
        public List<EnergyPointDto> U31_V { get; set; } = new();
        public List<EnergyPointDto> I1_A { get; set; } = new();
        public List<EnergyPointDto> I2_A { get; set; } = new();
        public List<EnergyPointDto> I3_A { get; set; } = new();
        public List<EnergyPointDto> E_Kwh { get; set; } = new();
    }
}
