using System.ComponentModel.DataAnnotations;

namespace RecordCabinet.Server.Models;

public class Artist
{
    public int Id { get; set; }

    [Required, MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    public ICollection<CatalogAlbum> CatalogAlbums { get; set; } = new List<CatalogAlbum>();
}