// file: API_ATF_MOBILE/Data/ApplicationDbContext.cs
using Microsoft.EntityFrameworkCore;
using API_ATF_MOBILE.Models;


namespace API_ATF_MOBILE.Data
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        { }

        public DbSet<Etape> Etapes { get; set; }
        public DbSet<EtapeRoleState> EtapeRoleStates { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Définition de la clé composite pour EtapeRoleState
            modelBuilder.Entity<EtapeRoleState>()
                .HasKey(rs => new { rs.EtapeId, rs.Operateur });

            // Relation 1-N entre Etape et EtapeRoleState
            modelBuilder.Entity<Etape>()
                .HasMany(e => e.RoleStates)
                .WithOne(rs => rs.Etape)
                .HasForeignKey(rs => rs.EtapeId);
        }
    }
}
