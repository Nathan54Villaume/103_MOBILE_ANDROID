using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace API_ATF_MOBILE.Models
{
    /// <summary>
    /// Modèle de commentaire individuel (format JSONL)
    /// Stocké dans ApplicationData/API_ATF_MOBILE/comments-*.jsonl
    /// </summary>
    public class Comment
    {
        /// <summary>
        /// Identifiant unique du commentaire (UUID v4)
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; } = Guid.NewGuid().ToString();

        /// <summary>
        /// ID de l'entité parente (ex: "suivi-produit-ats")
        /// </summary>
        [Required]
        [JsonPropertyName("entityId")]
        public string EntityId { get; set; } = string.Empty;

        /// <summary>
        /// Nom de l'auteur (2-80 caractères, accents autorisés)
        /// </summary>
        [Required]
        [StringLength(80, MinimumLength = 2)]
        [JsonPropertyName("authorName")]
        public string AuthorName { get; set; } = string.Empty;

        /// <summary>
        /// ID de l'auteur (optionnel, pour les utilisateurs authentifiés)
        /// </summary>
        [JsonPropertyName("authorId")]
        public string? AuthorId { get; set; }

        /// <summary>
        /// Message du commentaire (1-2000 caractères, HTML stripped)
        /// </summary>
        [Required]
        [StringLength(2000, MinimumLength = 1)]
        [JsonPropertyName("message")]
        public string Message { get; set; } = string.Empty;

        /// <summary>
        /// Date de création (UTC, format ISO-8601)
        /// </summary>
        [JsonPropertyName("createdAt")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    /// <summary>
    /// DTO pour créer un nouveau commentaire
    /// </summary>
    public class CommentCreateDto
    {
        [Required]
        [StringLength(100, MinimumLength = 1)]
        public string EntityId { get; set; } = string.Empty;

        [Required]
        [StringLength(80, MinimumLength = 2)]
        public string AuthorName { get; set; } = string.Empty;

        [Required]
        [StringLength(2000, MinimumLength = 1)]
        public string Message { get; set; } = string.Empty;
    }

    /// <summary>
    /// Réponse paginée pour les commentaires
    /// </summary>
    public class CommentsPaginatedResponse
    {
        /// <summary>
        /// Liste des commentaires (triés du plus récent au plus ancien)
        /// </summary>
        [JsonPropertyName("items")]
        public List<Comment> Items { get; set; } = new();

        /// <summary>
        /// Curseur pour la page suivante (ISO-8601 date)
        /// </summary>
        [JsonPropertyName("nextCursor")]
        public string? NextCursor { get; set; }

        /// <summary>
        /// Nombre total de commentaires pour cette entité
        /// </summary>
        [JsonPropertyName("total")]
        public int Total { get; set; }
    }
}

