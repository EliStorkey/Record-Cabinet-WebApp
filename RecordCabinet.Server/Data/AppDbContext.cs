using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using RecordCabinet.Server.Models;

namespace RecordCabinet.Server.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options)
    : IdentityDbContext<ApplicationUser>(options)
{
    public DbSet<Artist> Artists => Set<Artist>();
    public DbSet<CatalogAlbum> CatalogAlbums => Set<CatalogAlbum>();
    public DbSet<UserRecord> UserRecords => Set<UserRecord>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Artist>(entity =>
        {
            entity.HasIndex(a => a.Name).IsUnique();
        });

        modelBuilder.Entity<CatalogAlbum>(entity =>
        {
            entity.HasIndex(a => a.DiscogsMasterId)
                  .IsUnique()
                  .HasFilter("[DiscogsMasterId] IS NOT NULL");

            entity.HasIndex(a => new { a.ArtistId, a.Title });

            entity.HasOne(a => a.Artist)
                  .WithMany(ar => ar.CatalogAlbums)
                  .HasForeignKey(a => a.ArtistId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<UserRecord>(entity =>
        {
            entity.HasIndex(r => new { r.UserId, r.Status });

            entity.HasOne(r => r.User)
                  .WithMany(u => u.UserRecords)
                  .HasForeignKey(r => r.UserId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(r => r.CatalogAlbum)
                  .WithMany(a => a.UserRecords)
                  .HasForeignKey(r => r.CatalogAlbumId)
                  .OnDelete(DeleteBehavior.Cascade);
        });
    }
}