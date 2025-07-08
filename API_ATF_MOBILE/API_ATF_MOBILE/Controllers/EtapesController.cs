// file: API_ATF_MOBILE/Controllers/EtapesController.cs
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Dapper;
using System;
using System.Threading.Tasks;
using System.Linq;
using System.Collections.Generic;
using API_ATF_MOBILE.Models;

namespace API_ATF_MOBILE.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class EtapesController : ControllerBase
    {
        private readonly IConfiguration _config;
        public EtapesController(IConfiguration config) => _config = config;

        // GET /api/Etapes
        [HttpGet]
        public async Task<IActionResult> GetEtapes()
        {
            const string sql = @"
                SELECT
                  id_etape            AS Id_Etape,
                  libelle_etape       AS Libelle_Etape,
                  affectation_etape   AS Affectation_Etape,
                  role_log            AS Role_Log,
                  phase_etape         AS Phase_Etape,
                  duree_etape         AS Duree_Etape,
                  description_etape   AS Description_Etape,
                  etat_etape          AS Etat_Etape,
                  temps_reel_etape    AS Temps_Reel_Etape,
                  commentaire_etape_1 AS Commentaire_Etape_1,
                  predecesseur_etape  AS Predecesseur_Etape,
                  successeur_etape    AS Successeur_Etape
                FROM [AI_ATS].[dbo].[ETAPES_CHANG_GAMMES]
                ORDER BY id_etape;";

            try
            {
                using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
                var raw = await conn.QueryAsync<Etape>(sql);

                var list = raw
                    .Select(e => new EtapeDto
                    {
                        Id_Etape = e.Id_Etape,
                        Libelle_Etape = e.Libelle_Etape,
                        Affectation_Etape = e.Affectation_Etape,
                        Role_Log = e.Role_Log,
                        Phase_Etape = e.Phase_Etape,
                        Duree_Etape = e.Duree_Etape,
                        Description_Etape = e.Description_Etape,
                        Etat_Etape = e.Etat_Etape,
                        Temps_Reel_Etape = e.Temps_Reel_Etape,
                        Commentaire_Etape_1 = e.Commentaire_Etape_1,
                        Predecesseurs = ParseLiens(e.Affectation_Etape, e.Predecesseur_Etape),
                        Successeurs = ParseLiens(e.Affectation_Etape, e.Successeur_Etape)
                    })
                    .ToList();

                return Ok(list);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Erreur GET all : {ex.Message}");
            }
        }

        // GET /api/Etapes/{id}
        [HttpGet("{id}")]
        public async Task<IActionResult> GetEtape(int id)
        {
            const string sql = @"
                SELECT
                  id_etape            AS Id_Etape,
                  libelle_etape       AS Libelle_Etape,
                  affectation_etape   AS Affectation_Etape,
                  role_log            AS Role_Log,
                  phase_etape         AS Phase_Etape,
                  duree_etape         AS Duree_Etape,
                  description_etape   AS Description_Etape,
                  etat_etape          AS Etat_Etape,
                  temps_reel_etape    AS Temps_Reel_Etape,
                  commentaire_etape_1 AS Commentaire_Etape_1,
                  predecesseur_etape  AS Predecesseur_Etape,
                  successeur_etape    AS Successeur_Etape
                FROM [AI_ATS].[dbo].[ETAPES_CHANG_GAMMES]
                WHERE id_etape = @Id;";

            try
            {
                using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
                var e = await conn.QuerySingleOrDefaultAsync<Etape>(sql, new { Id = id });
                if (e == null)
                    return NotFound();

                var dto = new EtapeDto
                {
                    Id_Etape = e.Id_Etape,
                    Libelle_Etape = e.Libelle_Etape,
                    Affectation_Etape = e.Affectation_Etape,
                    Role_Log = e.Role_Log,
                    Phase_Etape = e.Phase_Etape,
                    Duree_Etape = e.Duree_Etape,
                    Description_Etape = e.Description_Etape,
                    Etat_Etape = e.Etat_Etape,
                    Temps_Reel_Etape = e.Temps_Reel_Etape,
                    Commentaire_Etape_1 = e.Commentaire_Etape_1,
                    Predecesseurs = ParseLiens(e.Affectation_Etape, e.Predecesseur_Etape),
                    Successeurs = ParseLiens(e.Affectation_Etape, e.Successeur_Etape)
                };

                return Ok(dto);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Erreur GET by id : {ex.Message}");
            }
        }

        // POST /api/Etapes
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] EtapeCreateDto dto)
        {
            const string getMaxId = @"SELECT ISNULL(MAX(id_etape),0) FROM [AI_ATS].[dbo].[ETAPES_CHANG_GAMMES];";
            const string insert = @"
                INSERT INTO [AI_ATS].[dbo].[ETAPES_CHANG_GAMMES]
                  (id_etape, libelle_etape, affectation_etape, role_log, phase_etape,
                   duree_etape, description_etape, etat_etape, temps_reel_etape,
                   commentaire_etape_1, predecesseur_etape, successeur_etape)
                VALUES
                  (@Id,      @Libelle,          @Affect,           @Role,    @Phase,
                   @Duree,   @Desc,             @Etat,             @TempsReel, @Comment,
                   @Pred,    @Succ);";

            try
            {
                using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
                var maxId = await conn.ExecuteScalarAsync<int>(getMaxId);
                var newId = maxId + 1;

                var p = new
                {
                    Id = newId,
                    Libelle = dto.Libelle_Etape,
                    Affect = dto.Affectation_Etape,
                    Role = dto.Role_Log,
                    Phase = dto.Phase_Etape,
                    Duree = dto.Duree_Etape,
                    Desc = dto.Description_Etape,
                    Etat = dto.Etat_Etape,
                    TempsReel = dto.Temps_Reel_Etape,
                    Comment = dto.Commentaire_Etape_1,
                    Pred = dto.Predecesseur_Etape,
                    Succ = dto.Successeur_Etape
                };

                await conn.ExecuteAsync(insert, p);
                return CreatedAtAction(nameof(GetEtape), new { id = newId }, null);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Erreur CREATE : {ex.Message}");
            }
        }

        // PUT /api/Etapes/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] EtapeUpdateDto dto)
        {
            const string sql = @"
                UPDATE [AI_ATS].[dbo].[ETAPES_CHANG_GAMMES]
                SET
                  libelle_etape       = @Libelle,
                  affectation_etape   = @Affect,
                  role_log            = @Role,
                  phase_etape         = @Phase,
                  duree_etape         = @Duree,
                  description_etape   = @Desc,
                  etat_etape          = @Etat,
                  temps_reel_etape    = @TempsReel,
                  commentaire_etape_1 = @Comment,
                  predecesseur_etape  = @Pred,
                  successeur_etape    = @Succ
                WHERE id_etape = @Id;";

            try
            {
                using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
                var rows = await conn.ExecuteAsync(sql, new
                {
                    Id = id,
                    Libelle = dto.Libelle_Etape,
                    Affect = dto.Affectation_Etape,
                    Role = dto.Role_Log,
                    Phase = dto.Phase_Etape,
                    Duree = dto.Duree_Etape,
                    Desc = dto.Description_Etape,
                    Etat = dto.Etat_Etape,
                    TempsReel = dto.Temps_Reel_Etape,
                    Comment = dto.Commentaire_Etape_1,
                    Pred = dto.Predecesseur_Etape,
                    Succ = dto.Successeur_Etape
                });
                return rows == 0 ? NotFound() : NoContent();
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Erreur UPDATE : {ex.Message}");
            }
        }

        // POST /api/Etapes/valider
        [HttpPost("valider")]
        public async Task<IActionResult> ValiderEtape([FromBody] EtapeValidationDto dto)
        {
            const string sql = @"
                UPDATE [AI_ATS].[dbo].[ETAPES_CHANG_GAMMES]
                SET
                  commentaire_etape_1 = @Comment,
                  description_etape   = @Desc,
                  etat_etape          = 'VALIDE',
                  temps_reel_etape    = ISNULL(@TempsReel, temps_reel_etape)
                WHERE id_etape = @Id;";

            try
            {
                using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
                var rows = await conn.ExecuteAsync(sql, new
                {
                    Id = dto.Id_Etape,
                    Comment = dto.Commentaire,
                    Desc = dto.Description,
                    TempsReel = dto.TempsReel
                });

                return rows == 0
                    ? NotFound(new { success = false, message = "Étape introuvable" })
                    : Ok(new { success = true, message = "Étape validée" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        // POST /api/Etapes/devalider
        [HttpPost("devalider")]
        public async Task<IActionResult> DevaliderEtape([FromBody] EtapeValidationDto dto)
        {
            const string sql = @"
                UPDATE [AI_ATS].[dbo].[ETAPES_CHANG_GAMMES]
                SET etat_etape = NULL
                WHERE id_etape = @Id;";

            try
            {
                using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
                var rows = await conn.ExecuteAsync(sql, new { Id = dto.Id_Etape });
                return rows == 0
                    ? NotFound(new { success = false, message = "Étape introuvable" })
                    : Ok(new { success = true, message = "Étape dévalidée" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        // Helpers to parse operator→IDs strings like "9!7!11" or "71!71 ou 72"
        private List<EtapeLienDto> ParseLiens(string? affectation, string? liens)
        {
            var operateurs = (affectation ?? "")
                .Split(';', StringSplitOptions.RemoveEmptyEntries)
                .Select(o => o.Trim())
                .ToArray();

            var segments = (liens ?? "")
                .Split('!', StringSplitOptions.RemoveEmptyEntries)
                .Select(s => s.Trim())
                .ToArray();

            var result = new List<EtapeLienDto>();

            if (operateurs.Length == segments.Length)
            {
                for (int i = 0; i < operateurs.Length; i++)
                {
                    result.Add(new EtapeLienDto
                    {
                        Operateur = operateurs[i],
                        Ids = ParseIds(segments[i])
                    });
                }
            }
            else
            {
                var allIds = segments.SelectMany(ParseIds).Distinct().ToList();
                result.Add(new EtapeLienDto { Operateur = operateurs.FirstOrDefault() ?? "", Ids = allIds });
            }

            return result;
        }

        private List<int> ParseIds(string segment)
            => segment
                .Split(new[] { " ou " }, StringSplitOptions.RemoveEmptyEntries)
                .Select(p => int.TryParse(p.Trim(), out var x) ? x : (int?)null)
                .Where(x => x.HasValue)
                .Select(x => x!.Value)
                .ToList();
    }
}
