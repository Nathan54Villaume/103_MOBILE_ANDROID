using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Cors;
using API_ATF_MOBILE.Models;
using API_ATF_MOBILE.Services;
using System.Security.Claims;

namespace API_ATF_MOBILE.Controllers
{
    /// <summary>
    /// Contrôleur pour la gestion des commentaires V2 (multi-commentaires, JSONL)
    /// </summary>
    [ApiController]
    [Route("api/commentsv2")]
    [EnableCors("AllowAll")]
    public class CommentsV2Controller : ControllerBase
    {
        private readonly ICommentsServiceV2 _commentsService;
        private readonly ILogger<CommentsV2Controller> _logger;

        public CommentsV2Controller(ICommentsServiceV2 commentsService, ILogger<CommentsV2Controller> logger)
        {
            _commentsService = commentsService;
            _logger = logger;
        }

        /// <summary>
        /// GET /api/comments/test
        /// Endpoint de test pour vérifier que le contrôleur fonctionne
        /// </summary>
        [HttpGet("test")]
        public ActionResult<object> Test()
        {
            return Ok(new { message = "CommentsV2Controller fonctionne!", timestamp = DateTime.UtcNow });
        }

        /// <summary>
        /// GET /api/comments?entityId=xxx&limit=50&cursor=xxx
        /// Récupérer les commentaires paginés pour une entité
        /// </summary>
        [HttpGet]
        public async Task<ActionResult<CommentsPaginatedResponse>> GetComments(
            [FromQuery] string entityId,
            [FromQuery] int limit = 50,
            [FromQuery] string? cursor = null)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(entityId))
                {
                    return BadRequest(new { error = "Le paramètre 'entityId' est requis." });
                }

                if (limit < 1 || limit > 100)
                {
                    return BadRequest(new { error = "Le paramètre 'limit' doit être entre 1 et 100." });
                }

                _logger.LogInformation("📥 Récupération des commentaires pour entityId={EntityId}, limit={Limit}", entityId, limit);
                var result = await _commentsService.GetCommentsAsync(entityId, limit, cursor);
                _logger.LogInformation("✅ {Count} commentaires récupérés", result.Items.Count);
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Erreur lors de la récupération des commentaires pour {EntityId}", entityId);
                return StatusCode(500, new { error = "Erreur interne du serveur.", details = ex.Message, stackTrace = ex.StackTrace });
            }
        }

        /// <summary>
        /// POST /api/comments
        /// Ajouter un nouveau commentaire
        /// Body: { "entityId": "xxx", "authorName": "xxx", "message": "xxx" }
        /// </summary>
        [HttpPost]
        public async Task<ActionResult<Comment>> CreateComment([FromBody] CommentCreateDto dto)
        {
            try
            {
                // Validation du modèle
                if (!ModelState.IsValid)
                {
                    return BadRequest(new { 
                        error = "Données invalides.", 
                        details = ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage) 
                    });
                }

                // Rate limiting basé sur l'IP
                var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
                var serviceWithRateLimit = _commentsService as CommentsServiceV2;
                
                if (serviceWithRateLimit != null && !serviceWithRateLimit.CheckRateLimit(ipAddress))
                {
                    return StatusCode(429, new { 
                        error = "Trop de requêtes. Veuillez réessayer dans quelques minutes.",
                        retryAfter = 300 // 5 minutes en secondes
                    });
                }

                // Récupérer l'ID utilisateur depuis le token JWT (si authentifié)
                var userId = User?.FindFirst(ClaimTypes.NameIdentifier)?.Value 
                          ?? User?.FindFirst("UserId")?.Value;

                var comment = await _commentsService.AddCommentAsync(dto, userId);
                
                return CreatedAtAction(
                    nameof(GetComments), 
                    new { entityId = comment.EntityId }, 
                    comment
                );
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Erreur lors de la création du commentaire");
                return StatusCode(500, new { error = "Erreur interne du serveur." });
            }
        }

        /// <summary>
        /// GET /api/comments/count?entityId=xxx
        /// Obtenir le nombre de commentaires pour une entité
        /// </summary>
        [HttpGet("count")]
        public async Task<ActionResult<object>> GetCommentCount([FromQuery] string entityId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(entityId))
                {
                    return BadRequest(new { error = "Le paramètre 'entityId' est requis." });
                }

                var count = await _commentsService.GetCommentCountAsync(entityId);
                return Ok(new { entityId, count });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Erreur lors du comptage des commentaires pour {EntityId}", entityId);
                return StatusCode(500, new { error = "Erreur interne du serveur." });
            }
        }

        /// <summary>
        /// POST /api/comments/archive
        /// Déclencher l'archivage manuel des anciens commentaires (admin only)
        /// </summary>
        [HttpPost("archive")]
        public async Task<ActionResult> ArchiveOldComments()
        {
            try
            {
                // TODO: Ajouter une vérification d'authentification admin ici
                await _commentsService.ArchiveOldCommentsAsync();
                return Ok(new { success = true, message = "Archivage terminé." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Erreur lors de l'archivage des commentaires");
                return StatusCode(500, new { error = "Erreur interne du serveur." });
            }
        }
    }
}

