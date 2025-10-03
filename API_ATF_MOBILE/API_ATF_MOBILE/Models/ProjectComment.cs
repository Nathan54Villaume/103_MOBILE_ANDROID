using System.ComponentModel.DataAnnotations;

namespace API_ATF_MOBILE.Models
{
    /// <summary>
    /// Modèle pour les commentaires de projets
    /// </summary>
    public class ProjectComment
    {
        public int Id { get; set; }
        
        [Required]
        public string ProjectId { get; set; } = string.Empty;
        
        [Required]
        public string Comment { get; set; } = string.Empty;
        
        [Required]
        public string Author { get; set; } = string.Empty;
        
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        
        public DateTime? UpdatedAt { get; set; }
    }

    /// <summary>
    /// DTO pour créer/modifier un commentaire
    /// </summary>
    public class CommentRequest
    {
        [Required]
        public string ProjectId { get; set; } = string.Empty;
        
        [Required]
        public string Comment { get; set; } = string.Empty;
        
        [Required]
        public string Author { get; set; } = string.Empty;
    }

    /// <summary>
    /// DTO pour la réponse des commentaires
    /// </summary>
    public class CommentResponse
    {
        public string ProjectId { get; set; } = string.Empty;
        public string Comment { get; set; } = string.Empty;
        public string Author { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }
}
