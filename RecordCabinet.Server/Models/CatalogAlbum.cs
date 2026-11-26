using System.ComponentModel.DataAnnotations;

namespace RecordCabinet.Server.Models;

public class CatalogAlbum
{
    public int Id { get; set; }

    public int? DiscogsMasterId { get; set; }

    public int ArtistId { get; set; }
    public Artist Artist { get; set; } = null!;

    [Required, MaxLength(250)]
    public string Title { get; set; } = string.Empty;

    public int? ReleaseYear { get; set; }

    [MaxLength(500)]
    public string? DefaultCoverUrl { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<UserRecord> UserRecords { get; set; } = new List<UserRecord>();
}