using System.ComponentModel.DataAnnotations;
using RecordCabinet.Server.Models;

namespace RecordCabinet.Server.DTOs;

public record RecordResponseDto(
    int Id,
    int CatalogAlbumId,
    int ArtistId,
    string ArtistName,
    string Title,
    int? ReleaseYear,
    string Format,
    string? Pressing,
    RecordStatus Status,
    string? CoverImageUrl,
    string? DefaultCoverUrl,
    string? Notes,
    DateTime DateAdded
);

public record CreateRecordDto(
    int? CatalogAlbumId,
    int? DiscogsMasterId,
    [Required, MaxLength(200)] string ArtistName,
    [Required, MaxLength(250)] string Title,
    [Range(1900, 2100)] int? ReleaseYear,
    [Required, MaxLength(50)] string Format,
    [MaxLength(150)] string? Pressing,
    RecordStatus Status,
    [MaxLength(500)] string? CoverImageUrl,
    [MaxLength(1000)] string? Notes
);

public record UpdateRecordDto(
    [Required, MaxLength(200)] string ArtistName,
    [Required, MaxLength(250)] string Title,
    [Range(1900, 2100)] int? ReleaseYear,
    [Required, MaxLength(50)] string Format,
    [MaxLength(150)] string? Pressing,
    RecordStatus Status,
    [MaxLength(500)] string? CoverImageUrl,
    [MaxLength(1000)] string? Notes
);

public record AcquireRecordDto(
    [MaxLength(150)] string? Pressing,
    [MaxLength(1000)] string? Notes
);

public record CollectionStatsDto(
    int TotalOwned,
    int TotalWantlist,
    int TotalArtists,
    Dictionary<string, int> ByFormat
);

public record CatalogSearchResultDto(
    int? CatalogAlbumId,
    int? DiscogsMasterId,
    string ArtistName,
    string Title,
    int? ReleaseYear,
    string? DefaultCoverUrl,
    string Source
);