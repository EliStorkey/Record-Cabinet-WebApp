using Microsoft.EntityFrameworkCore;
using RecordCabinet.Server.Data;
using RecordCabinet.Server.DTOs;
using RecordCabinet.Server.Models;

namespace RecordCabinet.Server.Services;

public class RecordService(AppDbContext db) : IRecordService
{
    public async Task<List<RecordResponseDto>> GetAllAsync(
        string userId,
        RecordStatus? status = null,
        string? search = null,
        string? format = null)
    {
        var query = db.UserRecords
            .AsNoTracking()
            .Include(r => r.CatalogAlbum)
                .ThenInclude(a => a.Artist)
            .Where(r => r.UserId == userId);

        if (status.HasValue)
            query = query.Where(r => r.Status == status.Value);

        if (!string.IsNullOrWhiteSpace(format))
            query = query.Where(r => r.Format == format);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(r =>
                r.CatalogAlbum.Title.Contains(term) ||
                r.CatalogAlbum.Artist.Name.Contains(term) ||
                (r.Pressing != null && r.Pressing.Contains(term)));
        }

        var items = await query
            .OrderByDescending(r => r.DateAdded)
            .ToListAsync();

        return items.Select(ToDto).ToList();
    }

    public async Task<RecordResponseDto?> GetByIdAsync(string userId, int id)
    {
        var item = await db.UserRecords
            .AsNoTracking()
            .Include(r => r.CatalogAlbum)
                .ThenInclude(a => a.Artist)
            .FirstOrDefaultAsync(r => r.UserId == userId && r.Id == id);

        return item is null ? null : ToDto(item);
    }

    public async Task<RecordResponseDto> CreateAsync(string userId, CreateRecordDto dto)
    {
        var normalizedCover = ValidateHttpsUrl(dto.CoverImageUrl);
        var album = await ResolveOrCreateCatalogAlbumAsync(
            dto.CatalogAlbumId,
            dto.DiscogsMasterId,
            dto.ArtistName,
            dto.Title,
            dto.ReleaseYear,
            normalizedCover);

        // Store CustomCoverUrl only when it differs from the shared album default
        var customCover = !string.Equals(normalizedCover, album.DefaultCoverUrl, StringComparison.OrdinalIgnoreCase)
            ? normalizedCover
            : null;

        var userRecord = new UserRecord
        {
            UserId = userId,
            CatalogAlbumId = album.Id,
            CatalogAlbum = album,
            Format = dto.Format.Trim(),
            Pressing = string.IsNullOrWhiteSpace(dto.Pressing) ? null : dto.Pressing.Trim(),
            Status = dto.Status,
            CustomCoverUrl = customCover,
            Notes = string.IsNullOrWhiteSpace(dto.Notes) ? null : dto.Notes.Trim(),
            DateAdded = DateTime.UtcNow
        };

        db.UserRecords.Add(userRecord);
        await db.SaveChangesAsync();

        return ToDto(userRecord);
    }

    public async Task<RecordResponseDto?> UpdateAsync(string userId, int id, UpdateRecordDto dto)
    {
        var userRecord = await db.UserRecords
            .Include(r => r.CatalogAlbum)
                .ThenInclude(a => a.Artist)
            .FirstOrDefaultAsync(r => r.UserId == userId && r.Id == id);

        if (userRecord is null)
            return null;

        var targetAlbum = await ResolveOrCreateCatalogAlbumAsync(
            catalogAlbumId: null,
            discogsMasterId: null,
            dto.ArtistName,
            dto.Title,
            dto.ReleaseYear,
            userRecord.CatalogAlbum.DefaultCoverUrl);

        userRecord.CatalogAlbumId = targetAlbum.Id;
        userRecord.CatalogAlbum = targetAlbum;
        userRecord.Format = dto.Format.Trim();
        userRecord.Pressing = string.IsNullOrWhiteSpace(dto.Pressing) ? null : dto.Pressing.Trim();
        userRecord.Status = dto.Status;
        userRecord.Notes = string.IsNullOrWhiteSpace(dto.Notes) ? null : dto.Notes.Trim();

        var normalizedCover = ValidateHttpsUrl(dto.CoverImageUrl);
        userRecord.CustomCoverUrl =
            !string.Equals(normalizedCover, targetAlbum.DefaultCoverUrl, StringComparison.OrdinalIgnoreCase)
                ? normalizedCover
                : null;

        await db.SaveChangesAsync();
        return ToDto(userRecord);
    }

    public async Task<RecordResponseDto?> MarkAsOwnedAsync(string userId, int id, AcquireRecordDto dto)
    {
        var userRecord = await db.UserRecords
            .Include(r => r.CatalogAlbum)
                .ThenInclude(a => a.Artist)
            .FirstOrDefaultAsync(r => r.UserId == userId && r.Id == id);

        if (userRecord is null)
            return null;

        userRecord.Status = RecordStatus.Owned;
        if (!string.IsNullOrWhiteSpace(dto.Pressing))
            userRecord.Pressing = dto.Pressing.Trim();
        if (!string.IsNullOrWhiteSpace(dto.Notes))
            userRecord.Notes = dto.Notes.Trim();

        await db.SaveChangesAsync();
        return ToDto(userRecord);
    }

    public async Task<bool> DeleteAsync(string userId, int id)
    {
        var userRecord = await db.UserRecords
            .FirstOrDefaultAsync(r => r.UserId == userId && r.Id == id);

        if (userRecord is null)
            return false;

        db.UserRecords.Remove(userRecord);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<CollectionStatsDto> GetStatsAsync(string userId)
    {
        var userRecords = await db.UserRecords
            .AsNoTracking()
            .Include(r => r.CatalogAlbum)
            .Where(r => r.UserId == userId)
            .ToListAsync();

        var owned = userRecords.Where(r => r.Status == RecordStatus.Owned).ToList();
        var wantlistCount = userRecords.Count(r => r.Status == RecordStatus.Wantlist);
        var distinctArtists = owned.Select(r => r.CatalogAlbum.ArtistId).Distinct().Count();
        var byFormat = owned
            .GroupBy(r => r.Format)
            .ToDictionary(g => g.Key, g => g.Count());

        return new CollectionStatsDto(
            owned.Count,
            wantlistCount,
            distinctArtists,
            byFormat);
    }
    private static string? ValidateHttpsUrl(string? url)
    {
        if (string.IsNullOrWhiteSpace(url)) return null;

        var trimmed = url.Trim();
        if (!Uri.TryCreate(trimmed, UriKind.Absolute, out var uri) ||
            uri.Scheme != Uri.UriSchemeHttps)
        {
            throw new ArgumentException("Cover image URL must be a valid HTTPS link.");
        }

        return trimmed;
    }


    private async Task<CatalogAlbum> ResolveOrCreateCatalogAlbumAsync(
        int? catalogAlbumId,
        int? discogsMasterId,
        string artistName,
        string title,
        int? releaseYear,
        string? defaultCoverUrl)
    {
        if (catalogAlbumId.HasValue)
        {
            var byId = await db.CatalogAlbums
                .Include(a => a.Artist)
                .FirstOrDefaultAsync(a => a.Id == catalogAlbumId.Value);

            if (byId is not null)
                return byId;
        }

        if (discogsMasterId.HasValue)
        {
            var byMaster = await db.CatalogAlbums
                .Include(a => a.Artist)
                .FirstOrDefaultAsync(a => a.DiscogsMasterId == discogsMasterId.Value);

            if (byMaster is not null)
                return byMaster;
        }

        var artist = await FindOrCreateArtistAsync(artistName);
        var cleanTitle = title.Trim();

        var existingAlbum = await db.CatalogAlbums
            .Include(a => a.Artist)
            .FirstOrDefaultAsync(a =>
                a.ArtistId == artist.Id &&
                a.Title.ToLower() == cleanTitle.ToLower());

        if (existingAlbum is not null)
        {
            if (existingAlbum.DefaultCoverUrl is null && defaultCoverUrl is not null)
                existingAlbum.DefaultCoverUrl = defaultCoverUrl;

            return existingAlbum;
        }

        var newAlbum = new CatalogAlbum
        {
            DiscogsMasterId = discogsMasterId,
            ArtistId = artist.Id,
            Artist = artist,
            Title = cleanTitle,
            ReleaseYear = releaseYear,
            DefaultCoverUrl = defaultCoverUrl
        };

        db.CatalogAlbums.Add(newAlbum);
        return newAlbum;
    }

    private async Task<Artist> FindOrCreateArtistAsync(string rawName)
    {
        var cleanName = rawName.Trim();
        var existing = await db.Artists
            .FirstOrDefaultAsync(a => a.Name.ToLower() == cleanName.ToLower());

        if (existing is not null)
            return existing;

        var artist = new Artist { Name = cleanName };
        db.Artists.Add(artist);
        await db.SaveChangesAsync();
        return artist;
    }


    private static RecordResponseDto ToDto(UserRecord r) => new(
        r.Id,
        r.CatalogAlbumId,
        r.CatalogAlbum.ArtistId,
        r.CatalogAlbum.Artist.Name,
        r.CatalogAlbum.Title,
        r.CatalogAlbum.ReleaseYear,
        r.Format,
        r.Pressing,
        r.Status,
        r.CustomCoverUrl ?? r.CatalogAlbum.DefaultCoverUrl,
        r.CatalogAlbum.DefaultCoverUrl,
        r.Notes,
        r.DateAdded
    );
}