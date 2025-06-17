using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using System.Data;

namespace API_ATF_MOBILE.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class HistoriqueController : ControllerBase
    {
        private readonly IConfiguration _config;

        public HistoriqueController(IConfiguration config)
        {
            _config = config;
        }

        [HttpGet("{matricule}/{annee}/{mois}")]
        public IActionResult GetHistorique(string matricule, int annee, int mois)
        {
            var result = new List<object>();

            using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
            using var cmd = new SqlCommand("dbo.pr_lect_HistoriqueOperateur", conn);
            cmd.CommandType = CommandType.StoredProcedure;

            cmd.Parameters.AddWithValue("@Matricule", matricule);
            cmd.Parameters.AddWithValue("@Annee", annee);
            cmd.Parameters.AddWithValue("@Mois", mois);

            conn.Open();
            using var reader = cmd.ExecuteReader();

            while (reader.Read())
            {
                result.Add(new
                {
                    DATE = reader["DATE"]?.ToString(),
                    JOUR = reader["JOUR"]?.ToString(),
                    POSTE = reader["POSTE"]?.ToString(),
                    AFFECTATION = reader["AFFECTATION"]?.ToString(),
                    LIGNE_1 = reader["LIGNE_1"]?.ToString(),
                    PROD_1 = reader["PROD_1"]?.ToString(),
                    DIAM_1 = reader["DIAM_1"]?.ToString(),
                    LIGNE_2 = reader["LIGNE_2"]?.ToString(),
                    PROD_2 = reader["PROD_2"]?.ToString(),
                    DIAM_2 = reader["DIAM_2"]?.ToString(),
                    LIGNE_3 = reader["LIGNE_3"]?.ToString(),
                    PROD_3 = reader["PROD_3"]?.ToString(),
                    DIAM_3 = reader["DIAM_3"]?.ToString(),
                    DateExecution = reader["DateExecution"]?.ToString()
                });
            }

            return Ok(result);
        }
    }
}
