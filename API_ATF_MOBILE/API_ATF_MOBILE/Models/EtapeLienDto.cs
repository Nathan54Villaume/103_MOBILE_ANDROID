// file: API_ATF_MOBILE/Models/EtapeLienDto.cs
namespace API_ATF_MOBILE.Models
{
    public class EtapeLienDto
    {
        public string Operateur { get; set; } = string.Empty;
        public List<int> Ids { get; set; } = new List<int>();
    }
}
