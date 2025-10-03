using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace API_ATF_MOBILE.Models
{
    [Table("AdminUsers")]
    public class AdminUser
    {
        [Key]
        public int Id { get; set; }
        
        [Required]
        [MaxLength(100)]
        public string Username { get; set; } = string.Empty;
        
        [Required]
        [MaxLength(256)]
        public string PasswordHash { get; set; } = string.Empty;
        
        [MaxLength(50)]
        public string Role { get; set; } = "Admin";
        
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime? LastLogin { get; set; }
    }

    public class LoginRequest
    {
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }

    public class LoginResponse
    {
        public bool Success { get; set; }
        public string? Token { get; set; }
        public string? Message { get; set; }
        public DateTime? ExpiresAt { get; set; }
        public AdminUserInfo? User { get; set; }
    }

    public class AdminUserInfo
    {
        public string Username { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public DateTime? LastLogin { get; set; }
    }
}

