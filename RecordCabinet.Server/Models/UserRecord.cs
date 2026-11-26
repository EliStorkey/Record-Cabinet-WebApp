using System.ComponentModel.DataAnnotations;

namespace RecordCabinet.Server.Models;

public enum RecordStatus
{
    Owned = 0,
    Wantlist = 1
}

public class UserRecord
{
    public int Id { get; set; }

    [Required, MaxLength(450)]
    public string UserId { get; set; } = string.Empty;
    public ApplicationUser User { get; set; } = null!;

    public int CatalogAlbumId { get; set; }
    public CatalogAlbum CatalogAlbum { get; set; } = null!;

    [Required, MaxLength(50)]
    public string Format { get; set; } = "LP";

    [MaxLength(150)]
    public string? Pressing { get; set; }

    public RecordStatus Status { get; set; } = RecordStatus.Owned;

    [MaxLength(500)]
    public string? CustomCoverUrl { get; set; }

    [MaxLength(1000)]
    public string? Notes { get; set; }

    public DateTime DateAdded { get; set; } = DateTime.UtcNow;


}