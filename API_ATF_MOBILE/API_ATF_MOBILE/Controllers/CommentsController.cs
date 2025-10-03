using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Cors;
using API_ATF_MOBILE.Models;
using API_ATF_MOBILE.Services;

namespace API_ATF_MOBILE.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [EnableCors("AllowAll")]
    public class CommentsController : ControllerBase
    {
        private readonly ICommentsService _commentsService;
        private readonly ILogger<CommentsController> _logger;

        public CommentsController(ICommentsService commentsService, ILogger<CommentsController> logger)
        {
            _commentsService = commentsService;
            _logger = logger;
        }

        /// <summary>
        /// Obtenir tous les commentaires (compatible avec le dashboard existant)
        /// </summary>
        [HttpGet]
        public async Task<ActionResult<Dictionary<string, CommentResponse>>> GetAllComments()
        {
            try
            {
                var comments = await _commentsService.GetAllCommentsAsync();
                
                // Format compatible avec le dashboard existant
                var response = comments.ToDictionary(
                    kvp => kvp.Key,
                    kvp => new { Comment = kvp.Value.Comment, Author = kvp.Value.Author }
                );
                
                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur lors de la récupération des commentaires");
                return StatusCode(500, new { error = "Erreur interne du serveur" });
            }
        }

        /// <summary>
        /// Obtenir un commentaire par ID de projet
        /// </summary>
        [HttpGet("{projectId}")]
        public async Task<ActionResult<CommentResponse>> GetComment(string projectId)
        {
            try
            {
                var comment = await _commentsService.GetCommentByProjectIdAsync(projectId);
                
                if (comment == null)
                {
                    return NotFound(new { error = "Commentaire non trouvé" });
                }
                
                return Ok(comment);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur lors de la récupération du commentaire pour {ProjectId}", projectId);
                return StatusCode(500, new { error = "Erreur interne du serveur" });
            }
        }

        /// <summary>
        /// Créer ou mettre à jour un commentaire (compatible avec le dashboard existant)
        /// </summary>
        [HttpPost]
        public async Task<ActionResult<CommentResponse>> SaveComment([FromBody] CommentRequest request)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(request.ProjectId))
                {
                    return BadRequest(new { error = "L'ID du projet est requis" });
                }

                if (string.IsNullOrWhiteSpace(request.Comment))
                {
                    return BadRequest(new { error = "Le commentaire ne peut pas être vide" });
                }

                if (string.IsNullOrWhiteSpace(request.Author))
                {
                    return BadRequest(new { error = "L'auteur est requis" });
                }

                var comment = await _commentsService.SaveCommentAsync(request);
                
                return Ok(new { 
                    success = true, 
                    message = "Commentaire sauvegardé avec succès",
                    comment = comment
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur lors de la sauvegarde du commentaire");
                return StatusCode(500, new { error = "Erreur interne du serveur" });
            }
        }

        /// <summary>
        /// Supprimer un commentaire
        /// </summary>
        [HttpDelete("{projectId}")]
        public async Task<ActionResult> DeleteComment(string projectId)
        {
            try
            {
                var deleted = await _commentsService.DeleteCommentAsync(projectId);
                
                if (!deleted)
                {
                    return NotFound(new { error = "Commentaire non trouvé" });
                }
                
                return Ok(new { 
                    success = true, 
                    message = "Commentaire supprimé avec succès" 
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur lors de la suppression du commentaire pour {ProjectId}", projectId);
                return StatusCode(500, new { error = "Erreur interne du serveur" });
            }
        }

        /// <summary>
        /// Obtenir les statistiques des commentaires
        /// </summary>
        [HttpGet("stats")]
        public async Task<ActionResult<object>> GetCommentsStats()
        {
            try
            {
                var count = await _commentsService.GetCommentsCountAsync();
                var allComments = await _commentsService.GetAllCommentsAsync();
                
                var stats = new
                {
                    totalComments = count,
                    projectsWithComments = allComments.Count,
                    recentComments = allComments
                        .Where(c => c.Value.CreatedAt > DateTime.UtcNow.AddDays(-7))
                        .Count(),
                    authors = allComments
                        .Select(c => c.Value.Author)
                        .Distinct()
                        .Count()
                };
                
                return Ok(stats);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur lors de la récupération des statistiques");
                return StatusCode(500, new { error = "Erreur interne du serveur" });
            }
        }
    }
}
