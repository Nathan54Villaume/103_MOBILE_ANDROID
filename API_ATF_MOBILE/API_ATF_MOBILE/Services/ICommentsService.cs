using API_ATF_MOBILE.Models;

namespace API_ATF_MOBILE.Services
{
    /// <summary>
    /// Service pour la gestion des commentaires de projets
    /// </summary>
    public interface ICommentsService
    {
        /// <summary>
        /// Obtenir tous les commentaires
        /// </summary>
        Task<Dictionary<string, CommentResponse>> GetAllCommentsAsync();
        
        /// <summary>
        /// Obtenir un commentaire par ID de projet
        /// </summary>
        Task<CommentResponse?> GetCommentByProjectIdAsync(string projectId);
        
        /// <summary>
        /// Créer ou mettre à jour un commentaire
        /// </summary>
        Task<CommentResponse> SaveCommentAsync(CommentRequest request);
        
        /// <summary>
        /// Supprimer un commentaire
        /// </summary>
        Task<bool> DeleteCommentAsync(string projectId);
        
        /// <summary>
        /// Obtenir le nombre total de commentaires
        /// </summary>
        Task<int> GetCommentsCountAsync();
    }
}
