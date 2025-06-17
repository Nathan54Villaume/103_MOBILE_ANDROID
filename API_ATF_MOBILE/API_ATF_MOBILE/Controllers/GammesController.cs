using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Dapper;
using System.Data;
using System.Threading.Tasks;

namespace API_ATF_MOBILE.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class GammesController : ControllerBase
    {
        private readonly IConfiguration _config;

        public GammesController(IConfiguration config)
        {
            _config = config;
        }

        [HttpGet]
        public async Task<IActionResult> GetGammes([FromQuery] decimal minDiam = 0, [FromQuery] decimal maxDiam = 100)
        {
            const string sql = @"
WITH CTE_Uniques AS (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY [Designation] ORDER BY [Horo_maj] DESC) AS rn
    FROM [SQLACOR\SQL_ACOR].[ACOR].[dbo].[P_TS_Treillis]
    WHERE [DIAM_Chaine] BETWEEN @minDiam AND @maxDiam
)
SELECT
    [Designation], [Code_Treillis], [Code_Produit], [CP_Elingues], [Nuance],
    [DIAM_Chaine], [diam_Trame], [About_AV_AR], [About_ad_ag], [Diam_Chaine_Trame],
    [Dimension], [EspFil_Chaine_Trame], [Norme], [Colissage], [Masse_panneau],
    [Masse_paquet], [Horo_maj], [Valid]
FROM CTE_Uniques
WHERE rn = 1;";

            try
            {
                using var connection = new SqlConnection(_config.GetConnectionString("SqlAiAtr"));
                var result = await connection.QueryAsync(sql, new { minDiam, maxDiam });
                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Erreur lors de la récupération des gammes : {ex.Message}");
            }
        }
    }
}
