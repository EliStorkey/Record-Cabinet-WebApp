using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using RecordCabinet.Server.Data;
using RecordCabinet.Server.DTOs;

namespace RecordCabinet.Server.Services;

public partial class CatalogService(
    AppDbContext db,
    IHttpClientFactory httpClientFactory,
    IMemoryCache cache,
    IConfiguration configuration) : ICatalogService
{
    [GeneratedRegex(@"\s+\(\d+\)$")]
    private static partial Regex DiscogsArtistSuffixRegex();

    public async Task<List<CatalogSearchResultDto>> SearchAsync(
        string query,
        bool includeExternal = false,
        CancellationToken ct = default)
    {
        var trimmed = query.Trim();
        if (string.IsNullOrWhiteSpace(trimmed))
            return [];

        // 1. Search local shared catalog first
        var localMatches = await db.CatalogAlbums
            .AsNoTracking()
            .Include(a => a.Artist)
            .Where(a => a.Title.Contains(trimmed) || a.Artist.Name.Contains(trimmed))
            .OrderBy(a => a.Artist.Name)
            .ThenBy(a => a.Title)
            .Take(15)
            .Select(a => new CatalogSearchResultDto(
                a.Id,
                a.DiscogsMasterId,
                a.Artist.Name,
                a.Title,
                a.ReleaseYear,
                a.DefaultCoverUrl,
                "Catalog"))
            .ToListAsync(ct);

        if (!includeExternal && localMatches.Count >= 5)
            return localMatches;

        // 2. Fallback to default Discogs search (all releases & masters)
        var externalMatches = await SearchDiscogsDefaultAsync(trimmed, ct);

        var existingMasterIds = localMatches
            .Where(m => m.DiscogsMasterId.HasValue)
            .Select(m => m.DiscogsMasterId!.Value)
            .ToHashSet();

        var merged = new List<CatalogSearchResultDto>(localMatches);
        foreach (var ext in externalMatches)
        {
            if (ext.DiscogsMasterId.HasValue && existingMasterIds.Contains(ext.DiscogsMasterId.Value))
                continue;

            merged.Add(ext);
        }

        return merged;
    }

    private async Task<List<CatalogSearchResultDto>> SearchDiscogsDefaultAsync(
        string query,
        CancellationToken ct)
    {
        var cacheKey = $"discogs:default:{query.ToLowerInvariant()}";
        if (cache.TryGetValue(cacheKey, out List<CatalogSearchResultDto>? cached) && cached is not null)
            return cached;

        var client = httpClientFactory.CreateClient("Discogs");
        var token = configuration["Discogs:Token"];
        if (!string.IsNullOrWhiteSpace(token))
        {
            client.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Discogs", $"token={token.Trim()}");
        }

        var url = $"database/search?q={Uri.EscapeDataString(query)}&per_page=12";
        using var response = await client.GetAsync(url, ct);

        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException(
                $"Discogs returned {(int)response.StatusCode} ({response.ReasonPhrase}). Check your Discogs:Token setting.");
        }

        await using var stream = await response.Content.ReadAsStreamAsync(ct);
        using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);

        if (!doc.RootElement.TryGetProperty("results", out var resultsElement) ||
            resultsElement.ValueKind != JsonValueKind.Array)
        {
            return [];
        }

        var results = new List<CatalogSearchResultDto>();
        foreach (var item in resultsElement.EnumerateArray())
        {
            var resultType = item.TryGetProperty("type", out var typeProp)
                ? typeProp.GetString()
                : null;

            // Only store DiscogsMasterId when the result is actually a master
            int? masterId = string.Equals(resultType, "master", StringComparison.OrdinalIgnoreCase) &&
                            item.TryGetProperty("id", out var idProp) &&
                            idProp.TryGetInt32(out var parsedId)
                ? parsedId
                : null;

            var rawTitle = item.TryGetProperty("title", out var titleProp)
                ? titleProp.GetString() ?? string.Empty
                : string.Empty;

            var (artistName, albumTitle) = ParseDiscogsTitle(rawTitle);
            if (string.IsNullOrWhiteSpace(albumTitle))
                continue;

            int? releaseYear = null;
            if (item.TryGetProperty("year", out var yearProp))
            {
                if (yearProp.ValueKind == JsonValueKind.Number && yearProp.TryGetInt32(out var yNum))
                    releaseYear = yNum;
                else if (yearProp.ValueKind == JsonValueKind.String &&
                         int.TryParse(yearProp.GetString(), out var yStr))
                    releaseYear = yStr;
            }

            var coverUrl = ExtractCoverUrl(item);

            results.Add(new CatalogSearchResultDto(
                null,
                masterId,
                artistName,
                albumTitle,
                releaseYear,
                coverUrl,
                "Discogs"));
        }

        if (results.Count > 0)
            cache.Set(cacheKey, results, TimeSpan.FromMinutes(30));

        return results;
    }

    private static string? ExtractCoverUrl(JsonElement item)
    {
        foreach (var field in new[] { "cover_image", "thumb" })
        {
            if (item.TryGetProperty(field, out var prop))
            {
                var url = prop.GetString();
                if (!string.IsNullOrWhiteSpace(url) &&
                    !url.EndsWith("spacer.gif", StringComparison.OrdinalIgnoreCase))
                {
                    return url;
                }
            }
        }

        return null;
    }

    private static (string ArtistName, string AlbumTitle) ParseDiscogsTitle(string rawTitle)
    {
        var separatorIndex = rawTitle.IndexOf(" - ", StringComparison.Ordinal);
        if (separatorIndex <= 0)
            return ("Unknown Artist", rawTitle.Trim());

        var rawArtist = rawTitle[..separatorIndex].Trim();
        var cleanArtist = DiscogsArtistSuffixRegex().Replace(rawArtist, string.Empty).Trim();
        var albumTitle = rawTitle[(separatorIndex + 3)..].Trim();

        return (cleanArtist, albumTitle);
    }
}