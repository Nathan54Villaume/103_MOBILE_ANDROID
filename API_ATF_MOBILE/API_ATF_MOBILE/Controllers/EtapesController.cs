// file: API_ATF_MOBILE/Controllers/EtapesController.cs
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Dapper;
using System;
using System.Threading.Tasks;
using System.Linq;
using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions; // <-- ajout
using API_ATF_MOBILE.Models;

namespace API_ATF_MOBILE.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class EtapesController : ControllerBase
    {
        private readonly IConfiguration _config;
        public EtapesController(IConfiguration config) => _config = config;

        // ---------------------------- GET all ----------------------------
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

                var etapes = (await conn.QueryAsync<DbEtape>(sqlEtapes)).ToList();
                var states = await conn.QueryAsync<DbEtapeRoleState>(sqlStates);

                var statesByEtape = states
                    .GroupBy(s => s.EtapeId)
                    .ToDictionary(g => g.Key, g => g.ToList());

                var dtos = etapes.Select(e =>
                {
                    statesByEtape.TryGetValue(e.Id_Etape, out var lst);
                    var roleStates = lst ?? new List<DbEtapeRoleState>();

                    var tempDict = roleStates
                        .GroupBy(s => s.Operateur)
                        .ToDictionary(g => g.Key, g => g.Last().Etat);

                    var operators = (e.Affectation_Etape ?? "")
                        .Split(';', StringSplitOptions.RemoveEmptyEntries)
                        .Select(s => s.Trim());

                    var fullDict = operators.ToDictionary(
                        op => op,
                        op => tempDict.TryGetValue(op, out var s) ? s : "EN_ATTENTE"
                    );

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
                        Predecesseurs = ParseLiensFlexible(e.Affectation_Etape, e.Predecesseur_Etape),
                        Successeurs = ParseLiensFlexible(e.Affectation_Etape, e.Successeur_Etape),
                        Conditions_A_Valider = e.Conditions_A_Valider
                    };
                }).ToList();

                return Ok(dtos);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Erreur GET all : {ex.Message}");
            }
        }

        // ---------------------------- GET by id ----------------------------
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

                var e = await conn.QuerySingleOrDefaultAsync<DbEtape>(sqlEtape, new { Id = id });
                if (e == null) return NotFound();

                var states = (await conn.QueryAsync<DbEtapeRoleState>(sqlStates, new { Id = id })).ToList();

                var tempDict = states
                    .GroupBy(s => s.Operateur)
                    .ToDictionary(g => g.Key, g => g.Last().Etat);

                var operators = (e.Affectation_Etape ?? "")
                    .Split(';', StringSplitOptions.RemoveEmptyEntries)
                    .Select(s => s.Trim());

                var fullDict = operators.ToDictionary(
                    op => op,
                    op => tempDict.TryGetValue(op, out var s) ? s : "EN_ATTENTE"
                );

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
                    Predecesseurs = ParseLiensFlexible(e.Affectation_Etape, e.Predecesseur_Etape),
                    Successeurs = ParseLiensFlexible(e.Affectation_Etape, e.Successeur_Etape),
                    Conditions_A_Valider = e.Conditions_A_Valider
                };

                return Ok(dto);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Erreur GET by id : {ex.Message}");
            }
        }

        // ---------------------------- CREATE ----------------------------
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] EtapeCreateDto dto)
        {
            const string sqlInsert = @"
                INSERT INTO [AI_ATS].[dbo].[ETAPES_CHANG_GAMMES]
                (libelle_etape, affectation_etape, predecesseur_etape, successeur_etape,
                 conditions_a_valider, role_log, phase_etape, duree_etape, description_etape,
                 temps_reel_etape, commentaire_etape_1)
                VALUES (@Libelle, @Affect, @Pred, @Succ, @Cond, @RoleLog, @Phase, @Duree, @Desc, @TempsReel, @Comment);
                SELECT CAST(SCOPE_IDENTITY() as int);";

            const string sqlDeleteStates = @"DELETE FROM [AI_ATS].[dbo].[EtapeRoleState] WHERE id_etape = @Id;";
            const string sqlInsertState = @"INSERT INTO [AI_ATS].[dbo].[EtapeRoleState] (id_etape, operateur, etat) VALUES (@Id, @Operateur, @Etat);";

            try
            {
                using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
                await conn.OpenAsync();
                using var tx = conn.BeginTransaction();

                var newId = await conn.ExecuteScalarAsync<int>(sqlInsert, new
                {
                    Libelle = dto.Libelle_Etape,
                    Affect = dto.Affectation_Etape,
                    Pred = ToSingleIdString(dto.Predecesseur_Etape), // "" ou "12"
                    Succ = ToSingleIdString(dto.Successeur_Etape),   // "" ou "12"
                    Cond = dto.Conditions_A_Valider,
                    RoleLog = dto.Role_Log,
                    Phase = dto.Phase_Etape,
                    Duree = dto.Duree_Etape,
                    Desc = dto.Description_Etape,
                    TempsReel = dto.Temps_Reel_Etape,
                    Comment = dto.Commentaire_Etape_1
                }, transaction: tx);

                await conn.ExecuteAsync(sqlDeleteStates, new { Id = newId }, transaction: tx);
                if (dto.EtatParRole != null)
                {
                    foreach (var kv in dto.EtatParRole)
                    {
                        await conn.ExecuteAsync(sqlInsertState, new { Id = newId, Operateur = kv.Key, Etat = kv.Value }, transaction: tx);
                    }
                }

                await tx.CommitAsync();
                return await GetEtape(newId);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Erreur CREATE : {ex.Message}");
            }
        }

        // ---------------------------- UPDATE ----------------------------
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] EtapeUpdateDto dto)
        {
            const string sqlUpdate = @"
                UPDATE [AI_ATS].[dbo].[ETAPES_CHANG_GAMMES] SET
                  libelle_etape       = @Libelle,
                  affectation_etape   = @Affect,
                  predecesseur_etape  = @Pred,
                  successeur_etape    = @Succ,
                  conditions_a_valider= @Cond,
                  role_log            = @RoleLog,
                  phase_etape         = @Phase,
                  duree_etape         = @Duree,
                  description_etape   = @Desc,
                  temps_reel_etape    = @TempsReel,
                  commentaire_etape_1 = @Comment
                WHERE id_etape = @Id;";

            const string sqlDeleteStates = @"DELETE FROM [AI_ATS].[dbo].[EtapeRoleState] WHERE id_etape = @Id;";
            const string sqlInsertState = @"INSERT INTO [AI_ATS].[dbo].[EtapeRoleState] (id_etape, operateur, etat) VALUES (@Id, @Operateur, @Etat);";

            try
            {
                using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
                await conn.OpenAsync();
                using var tx = conn.BeginTransaction();

                var rows = await conn.ExecuteAsync(sqlUpdate, new
                {
                    Id = id,
                    Libelle = dto.Libelle_Etape,
                    Affect = dto.Affectation_Etape,
                    Pred = ToSingleIdString(dto.Predecesseur_Etape), // "" ou "12"
                    Succ = ToSingleIdString(dto.Successeur_Etape),   // "" ou "12"
                    Cond = dto.Conditions_A_Valider,
                    RoleLog = dto.Role_Log,
                    Phase = dto.Phase_Etape,
                    Duree = dto.Duree_Etape,
                    Desc = dto.Description_Etape,
                    TempsReel = dto.Temps_Reel_Etape,
                    Comment = dto.Commentaire_Etape_1
                }, transaction: tx);

                if (rows == 0)
                {
                    await tx.RollbackAsync();
                    return NotFound();
                }

                await conn.ExecuteAsync(sqlDeleteStates, new { Id = id }, transaction: tx);
                if (dto.EtatParRole != null)
                {
                    foreach (var kv in dto.EtatParRole)
                    {
                        await conn.ExecuteAsync(sqlInsertState, new { Id = id, Operateur = kv.Key, Etat = kv.Value }, transaction: tx);
                    }
                }

                await tx.CommitAsync();
                return await GetEtape(id);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Erreur UPDATE : {ex.Message}");
            }
        }

        // ---------------------------- RESET SESSION ----------------------------
        [HttpPost("reset-session")]
        public async Task<IActionResult> ResetSession()
        {
            const string sqlDeleteStates = @"DELETE FROM [AI_ATS].[dbo].[EtapeRoleState];";
            const string sqlResetEtapes = @"
                UPDATE [AI_ATS].[dbo].[ETAPES_CHANG_GAMMES]
                SET commentaire_etape_1 = '',
                    description_etape   = '',
                    temps_reel_etape    = 0;";

            try
            {
                using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
                await conn.OpenAsync();
                using var tx = conn.BeginTransaction();

                var deleted = await conn.ExecuteAsync(sqlDeleteStates, transaction: tx);
                var updated = await conn.ExecuteAsync(sqlResetEtapes, transaction: tx);

                await tx.CommitAsync();

                return Ok(new { success = true, states_deleted = deleted, etapes_reset = updated });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = $"Erreur RESET-SESSION : {ex.Message}" });
            }
        }

        // ---------------------------- VALIDATION ----------------------------
        [HttpPost("valider")]
        public Task<IActionResult> ValiderEtape([FromBody] EtapeValidationDto dto)
            => ChangeEtapeState(dto);

        [HttpPost("devalider")]
        public Task<IActionResult> DevaliderEtape([FromBody] EtapeValidationDto dto)
            => ChangeEtapeState(dto);

        private async Task<IActionResult> ChangeEtapeState(EtapeValidationDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Role_Log) || dto.EtatParRole == null || !dto.EtatParRole.ContainsKey(dto.Role_Log))
                return BadRequest("Le rôle (role_log) et l'état (EtatParRole[role]) sont requis.");

            var nouvelEtat = dto.EtatParRole[dto.Role_Log];

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

                await conn.ExecuteAsync(sqlUpdateEtape, new { Id = dto.Id_Etape, Comment = dto.Commentaire, Desc = dto.Description, TempsReel = dto.TempsReel }, transaction: tx);
                await conn.ExecuteAsync(sqlDeleteOldState, new { Id = dto.Id_Etape, RoleLog = dto.Role_Log }, transaction: tx);
                await conn.ExecuteAsync(sqlInsertNewState, new { Id = dto.Id_Etape, RoleLog = dto.Role_Log, Etat = nouvelEtat }, transaction: tx);

                await tx.CommitAsync();
                return await GetEtape(dto.Id_Etape);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        // ---------------------------- Helpers ----------------------------

        // Transforme JSON moderne OU texte libre en **UN SEUL entier > 1** (string) ; sinon "".
        private string ToSingleIdString(string? jsonOrLegacy)
        {
            if (string.IsNullOrWhiteSpace(jsonOrLegacy))
                return "";

            var s = jsonOrLegacy.Trim();
            var ids = new List<int>();

            if (s.StartsWith("["))
            {
                try
                {
                    var list = JsonSerializer.Deserialize<List<EtapeRelationJson>>(s) ?? new();
                    foreach (var rel in list)
                        if (rel.ids != null)
                            ids.AddRange(rel.ids);
                }
                catch
                {
                    // JSON invalide -> on tombera sur l'extraction regex ci-dessous
                }
            }

            if (ids.Count == 0)
            {
                foreach (Match m in Regex.Matches(s, "\\d+"))
                {
                    if (int.TryParse(m.Value, out var v)) ids.Add(v);
                }
            }

            var firstValid = ids.FirstOrDefault(v => v > 1);
            return firstValid > 1 ? firstValid.ToString() : "";
        }

        // Parsing pour le retour GET (compat JSON/legacy/simple entier). Filtre <=1 et retire relations vides.
        private List<EtapeLienDto> ParseLiensFlexible(string? affectation, string? liens)
        {
            var ops = (affectation ?? "")
                .Split(';', StringSplitOptions.RemoveEmptyEntries)
                .Select(o => o.Trim())
                .ToArray();

            if (string.IsNullOrWhiteSpace(liens))
                return new();

            var s = liens!.Trim();

            // JSON moderne ?
            if (s.StartsWith("["))
            {
                try
                {
                    var list = JsonSerializer.Deserialize<List<EtapeRelationJson>>(s) ?? new();
                    return list.Select(x => new EtapeLienDto
                    {
                        Operateur = x.operateur ?? (ops.FirstOrDefault() ?? ""),
                        Ids = (x.ids ?? new()).Where(i => i > 1).Distinct().ToList()
                    })
                    .Where(r => r.Ids.Count > 0)
                    .ToList();
                }
                catch
                {
                    // fallback legacy
                }
            }

            // Simple entier / texte libre : extraire nombres > 1
            var allNums = Regex.Matches(s, "\\d+")
                               .Cast<Match>()
                               .Select(m => int.Parse(m.Value))
                               .Where(v => v > 1)
                               .Distinct()
                               .ToList();

            if (allNums.Count == 0) return new();

            // On ne conserve qu'un unique entier (premier >1), associé au 1er opérateur si connu
            var op = ops.FirstOrDefault() ?? "";
            return new List<EtapeLienDto> {
                new EtapeLienDto { Operateur = op, Ids = new List<int> { allNums.First() } }
            };
        }

        // ======== Types internes pour Dapper / JSON ========
        private class DbEtape
        {
            public int Id_Etape { get; set; }
            public string? Libelle_Etape { get; set; }
            public string? Affectation_Etape { get; set; }
            public string? Predecesseur_Etape { get; set; }
            public string? Successeur_Etape { get; set; }
            public string? Conditions_A_Valider { get; set; }
            public string? Role_Log { get; set; }
            public string? Phase_Etape { get; set; }
            public int? Duree_Etape { get; set; }
            public string? Description_Etape { get; set; }
            public int? Temps_Reel_Etape { get; set; }
            public string? Commentaire_Etape_1 { get; set; }
        }

        private class DbEtapeRoleState
        {
            public int EtapeId { get; set; }
            public string Operateur { get; set; } = "";
            public string Etat { get; set; } = "EN_ATTENTE";
        }

        private class EtapeRelationJson
        {
            [JsonPropertyName("operateur")]
            public string operateur { get; set; } = "";

            [JsonPropertyName("ids")]
            public List<int>? ids { get; set; }
        }

        public class EtapeLienDto
        {
            [JsonPropertyName("operateur")]
            public string Operateur { get; set; } = "";

            [JsonPropertyName("ids")]
            public List<int> Ids { get; set; } = new();
        }

        public class EtapeDto
        {
            [JsonPropertyName("id_etape")] public int Id_Etape { get; set; }
            [JsonPropertyName("libelle_etape")] public string? Libelle_Etape { get; set; }
            [JsonPropertyName("affectation_etape")] public string? Affectation_Etape { get; set; }
            [JsonPropertyName("role_log")] public string? Role_Log { get; set; }
            [JsonPropertyName("phase_etape")] public string? Phase_Etape { get; set; }
            [JsonPropertyName("duree_etape")] public int? Duree_Etape { get; set; }
            [JsonPropertyName("description_etape")] public string? Description_Etape { get; set; }
            [JsonPropertyName("etat_par_role")] public Dictionary<string, string>? EtatParRole { get; set; }
            [JsonPropertyName("temps_reel_etape")] public int? Temps_Reel_Etape { get; set; }
            [JsonPropertyName("commentaire_etape_1")] public string? Commentaire_Etape_1 { get; set; }
            [JsonPropertyName("predecesseurs")] public List<EtapeLienDto> Predecesseurs { get; set; } = new();
            [JsonPropertyName("successeurs")] public List<EtapeLienDto> Successeurs { get; set; } = new();
            [JsonPropertyName("conditions_a_valider")] public string? Conditions_A_Valider { get; set; }
        }
    }
}
