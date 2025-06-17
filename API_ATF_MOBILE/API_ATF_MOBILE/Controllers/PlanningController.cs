using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using System.Data;

namespace API_ATF_MOBILE.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PlanningController : ControllerBase
    {
        private readonly IConfiguration _config;

        public PlanningController(IConfiguration config)
        {
            _config = config;
        }

        [HttpGet("{matricule}")]
        public IActionResult GetPlanning(string matricule)
        {
            var result = new List<object>();

            using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
            using var cmd = new SqlCommand("dbo.GetPlanningOperateur_New", conn);
            cmd.CommandType = CommandType.StoredProcedure;

            cmd.Parameters.AddWithValue("@Matricule", matricule);
            cmd.Parameters.AddWithValue("@Annee", DateTime.Now.Year);
            cmd.Parameters.AddWithValue("@Mois", DateTime.Now.Month);
            cmd.Parameters.AddWithValue("@DateExecution", DateTime.Now);
            cmd.Parameters.AddWithValue("@ModeCalcul", "Actuel");

            conn.Open();
            using var reader = cmd.ExecuteReader();

            while (reader.Read())
            {
                result.Add(new
                {
                    Date = reader["Date"].ToString(),
                    Etat = reader["Etat"].ToString(),
                    Prod1 = reader["Prod_1"].ToString()
                });
            }

            return Ok(result);
        }
    }
}
