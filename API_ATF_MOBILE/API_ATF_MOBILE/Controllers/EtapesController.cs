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
            const string sqlEtapes = @"
                SELECT
                  id_etape, libelle_etape, affectation_etape, predecesseur_etape,
                  successeur_etape, conditions_a_valider, role_log, phase_etape,
                  duree_etape, description_etape, temps_reel_etape, commentaire_etape_1
                FROM [AI_ATS].[dbo].[ETAPES_CHANG_GAMMES]
                ORDER BY id_etape;";

            const string sqlStates = @"
                SELECT id_etape AS EtapeId, operateur, etat
                FROM [AI_ATS].[dbo].[EtapeRoleState];";

            try
            {
                using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
                await conn.OpenAsync();

                var etapes = (await conn.QueryAsync<Etape>(sqlEtapes)).ToList();
                var states = await conn.QueryAsync<EtapeRoleState>(sqlStates);

                var statesByEtape = states
                    .GroupBy(s => s.EtapeId)
                    .ToDictionary(g => g.Key, g => g.ToList());

                var dtos = etapes.Select(e =>
                {
                    statesByEtape.TryGetValue(e.Id_Etape, out var lst);
                    var roleStates = lst ?? new List<EtapeRoleState>();

                    var tempDict = roleStates
                        .GroupBy(s => s.Operateur)
                        .ToDictionary(g => g.Key, g => g.Last().Etat);

                    var operators = (e.Affectation_Etape ?? "")
                        .Split(';', StringSplitOptions.RemoveEmptyEntries)
                        .Select(s => s.Trim());

                    var fullDict = operators
                        .ToDictionary(op => op,
                                      op => tempDict.TryGetValue(op, out var s) ? s : "EN_ATTENTE");

                    return new EtapeDto
                    {
                        Id_Etape = e.Id_Etape,
                        Libelle_Etape = e.Libelle_Etape,
                        Affectation_Etape = e.Affectation_Etape,
                        Role_Log = e.Role_Log,
                        Phase_Etape = e.Phase_Etape,
                        Duree_Etape = e.Duree_Etape,
                        Description_Etape = e.Description_Etape,
                        EtatParRole = fullDict,
                        Temps_Reel_Etape = e.Temps_Reel_Etape,
                        Commentaire_Etape_1 = e.Commentaire_Etape_1,
                        Predecesseurs = ParseLiens(e.Affectation_Etape, e.Predecesseur_Etape),
                        Successeurs = ParseLiens(e.Affectation_Etape, e.Successeur_Etape),
                        Conditions_A_Valider = e.Conditions_A_Valider
                    };
                }).ToList();

                foreach (var dto in dtos)
                {
                    var predIds = dto.Predecesseurs
                        .SelectMany(l => l.Ids)
                        .Where(id => id != 0)
                        .Distinct();

                    dto.PredecesseursValides = predIds.All(predId =>
                    {
                        var predDto = dtos.FirstOrDefault(d => d.Id_Etape == predId);
                        return predDto == null || predDto.EstEntierementValide;
                    });
                }

                return Ok(dtos);
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
            const string sqlEtape = @"
                SELECT
                  id_etape, libelle_etape, affectation_etape, predecesseur_etape,
                  successeur_etape, conditions_a_valider, role_log, phase_etape,
                  duree_etape, description_etape, temps_reel_etape, commentaire_etape_1
                FROM [AI_ATS].[dbo].[ETAPES_CHANG_GAMMES]
                WHERE id_etape = @Id;";

            const string sqlStates = @"
                SELECT id_etape AS EtapeId, operateur, etat
                FROM [AI_ATS].[dbo].[EtapeRoleState]
                WHERE id_etape = @Id;";

            try
            {
                using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
                await conn.OpenAsync();

                var e = await conn.QuerySingleOrDefaultAsync<Etape>(sqlEtape, new { Id = id });
                if (e == null) return NotFound();

                var states = (await conn.QueryAsync<EtapeRoleState>(sqlStates, new { Id = id })).ToList();

                var tempDict = states
                    .GroupBy(s => s.Operateur)
                    .ToDictionary(g => g.Key, g => g.Last().Etat);

                var operators = (e.Affectation_Etape ?? "")
                    .Split(';', StringSplitOptions.RemoveEmptyEntries)
                    .Select(s => s.Trim());

                var fullDict = operators
                    .ToDictionary(op => op,
                                  op => tempDict.TryGetValue(op, out var s) ? s : "EN_ATTENTE");

                var dto = new EtapeDto
                {
                    Id_Etape = e.Id_Etape,
                    Libelle_Etape = e.Libelle_Etape,
                    Affectation_Etape = e.Affectation_Etape,
                    Role_Log = e.Role_Log,
                    Phase_Etape = e.Phase_Etape,
                    Duree_Etape = e.Duree_Etape,
                    Description_Etape = e.Description_Etape,
                    EtatParRole = fullDict,
                    Temps_Reel_Etape = e.Temps_Reel_Etape,
                    Commentaire_Etape_1 = e.Commentaire_Etape_1,
                    Predecesseurs = ParseLiens(e.Affectation_Etape, e.Predecesseur_Etape),
                    Successeurs = ParseLiens(e.Affectation_Etape, e.Successeur_Etape),
                    Conditions_A_Valider = e.Conditions_A_Valider
                };

                return Ok(dto);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Erreur GET by id : {ex.Message}");
            }
        }

        // ▼▼▼ MÉTHODES DE VALIDATION CORRIGÉES ▼▼▼

        // POST /api/Etapes/valider
        [HttpPost("valider")]
        public Task<IActionResult> ValiderEtape([FromBody] EtapeValidationDto dto)
        {
            // Fait appel à la méthode centrale de mise à jour d'état
            return ChangeEtapeState(dto);
        }

        // POST /api/Etapes/devalider
        [HttpPost("devalider")]
        public Task<IActionResult> DevaliderEtape([FromBody] EtapeValidationDto dto)
        {
            // Fait appel à la même méthode, car le client envoie l'état désiré ('EN ATTENTE')
            return ChangeEtapeState(dto);
        }

        /// <summary>
        /// Méthode centrale et robuste pour changer l'état d'une étape pour un opérateur.
        /// Met à jour l'étape et l'état, puis retourne l'objet étape complet.
        /// </summary>
        private async Task<IActionResult> ChangeEtapeState(EtapeValidationDto dto)
        {
            // Validation de la requête
            if (string.IsNullOrWhiteSpace(dto.Role_Log) || dto.EtatParRole == null || !dto.EtatParRole.ContainsKey(dto.Role_Log))
            {
                return BadRequest("Le rôle de l'opérateur (role_log) et l'état (EtatParRole) sont requis.");
            }

            var nouvelEtat = dto.EtatParRole[dto.Role_Log];

            // Requêtes SQL
            const string sqlUpdateEtape = @"
                UPDATE [AI_ATS].[dbo].[ETAPES_CHANG_GAMMES] SET
                    commentaire_etape_1 = @Comment,
                    description_etape   = @Desc,
                    temps_reel_etape    = ISNULL(@TempsReel, temps_reel_etape)
                WHERE id_etape = @Id;";

            const string sqlDeleteOldState = @"
                DELETE FROM [AI_ATS].[dbo].[EtapeRoleState]
                WHERE id_etape = @Id AND operateur = @RoleLog;";

            const string sqlInsertNewState = @"
                INSERT INTO [AI_ATS].[dbo].[EtapeRoleState] (id_etape, operateur, etat)
                VALUES (@Id, @RoleLog, @Etat);";

            try
            {
                using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
                await conn.OpenAsync();
                using var tx = conn.BeginTransaction();

                // 1. Mettre à jour les champs de l'étape
                await conn.ExecuteAsync(sqlUpdateEtape, new
                {
                    Id = dto.Id_Etape,
                    Comment = dto.Commentaire,
                    Desc = dto.Description,
                    TempsReel = dto.TempsReel
                }, transaction: tx);

                // 2. Supprimer l'ancien état pour éviter les doublons
                await conn.ExecuteAsync(sqlDeleteOldState, new { Id = dto.Id_Etape, RoleLog = dto.Role_Log }, transaction: tx);

                // 3. Insérer le nouvel état
                await conn.ExecuteAsync(sqlInsertNewState, new { Id = dto.Id_Etape, RoleLog = dto.Role_Log, Etat = nouvelEtat }, transaction: tx);

                await tx.CommitAsync();

                // 4. Retourner l'objet étape complet et mis à jour pour le client
                return await GetEtape(dto.Id_Etape);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }


        // POST /api/Etapes/reset-session
        [HttpPost("reset-session")]
        public async Task<IActionResult> ResetSession()
        {
            try
            {
                using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
                await conn.OpenAsync();
                using var tx = conn.BeginTransaction();

                const string sqlEtapes = @"
                    UPDATE [AI_ATS].[dbo].[ETAPES_CHANG_GAMMES]
                    SET temps_reel_etape = 0, commentaire_etape_1 = '', description_etape = '';";
                var rowsEtapes = await conn.ExecuteAsync(sqlEtapes, transaction: tx);

                const string sqlStates = @"DELETE FROM [AI_ATS].[dbo].[EtapeRoleState];";
                var rowsStates = await conn.ExecuteAsync(sqlStates, transaction: tx);

                await tx.CommitAsync();
                return Ok(new
                {
                    success = true,
                    message = $"Session réinitialisée. Étapes mises à jour : {rowsEtapes}, états supprimés : {rowsStates}"
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        // Helpers (inchangés)
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
                if (operateurs.Any())
                {
                    result.Add(new EtapeLienDto { Operateur = operateurs.First(), Ids = allIds });
                }
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