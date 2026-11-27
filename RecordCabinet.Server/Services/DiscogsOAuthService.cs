using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Web;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using RecordCabinet.Server.Data;
using RecordCabinet.Server.DTOs;
using RecordCabinet.Server.Models;

namespace RecordCabinet.Server.Services;

public partial class DiscogsOAuthService(
    HttpClient httpClient,
    AppDbContext db,
    IMemoryCache cache,
    IConfiguration config) : IDiscogsOAuthService
{
    private const string UserAgent = "RecordCabinet/1.0";

    private string ConsumerKey => config["Discogs:ConsumerKey"]
        ?? throw new InvalidOperationException("Discogs:ConsumerKey is not configured.");

    private string ConsumerSecret => config["Discogs:ConsumerSecret"]
        ?? throw new InvalidOperationException("Discogs:ConsumerSecret is not configured.");

    public async Task<DiscogsConnectionStatusDto> GetStatusAsync(string userId)
    {
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
        if (user is null || string.IsNullOrEmpty(user.DiscogsAccessToken))
            return new DiscogsConnectionStatusDto(false, null);

        return new DiscogsConnectionStatusDto(true, user.DiscogsUserName);
    }

    public async Task<string> StartAuthorizationAsync(string userId, string callbackUrl)
    {
        var authHeader = BuildOAuthHeader(
            token: null,
            tokenSecret: null,
            callbackUrl: callbackUrl,
            verifier: null);

        using var request = new HttpRequestMessage(HttpMethod.Get, "https://api.discogs.com/oauth/request_token");
        request.Headers.UserAgent.ParseAdd(UserAgent);
        request.Headers.Authorization = new AuthenticationHeaderValue("OAuth", authHeader);

        using var response = await httpClient.SendAsync(request);
        var body = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException($"Discogs request_token failed ({(int)response.StatusCode}): {body}");

        var parsed = HttpUtility.ParseQueryString(body);
        var requestToken = parsed["oauth_token"]
            ?? throw new InvalidOperationException("Discogs did not return an oauth_token.");
        var requestTokenSecret = parsed["oauth_token_secret"]
            ?? throw new InvalidOperationException("Discogs did not return an oauth_token_secret.");

        cache.Set(
            $"discogs_oauth:{requestToken}",
            new PendingOAuthSession(userId, requestTokenSecret),
            TimeSpan.FromMinutes(10));

        return $"https://www.discogs.com/oauth/authorize?oauth_token={Uri.EscapeDataString(requestToken)}";
    }

    public async Task<string> CompleteAuthorizationAsync(string oauthToken, string oauthVerifier)
    {
        if (!cache.TryGetValue($"discogs_oauth:{oauthToken}", out PendingOAuthSession? pending) || pending is null)
            throw new InvalidOperationException("OAuth session expired. Please close this window and try again.");

        cache.Remove($"discogs_oauth:{oauthToken}");

        var authHeader = BuildOAuthHeader(
            token: oauthToken,
            tokenSecret: pending.RequestTokenSecret,
            callbackUrl: null,
            verifier: oauthVerifier);

        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.discogs.com/oauth/access_token");
        request.Headers.UserAgent.ParseAdd(UserAgent);
        request.Headers.Authorization = new AuthenticationHeaderValue("OAuth", authHeader);

        using var response = await httpClient.SendAsync(request);
        var body = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException($"Discogs access_token failed ({(int)response.StatusCode}): {body}");

        var parsed = HttpUtility.ParseQueryString(body);
        var accessToken = parsed["oauth_token"]
            ?? throw new InvalidOperationException("Missing access oauth_token.");
        var accessTokenSecret = parsed["oauth_token_secret"]
            ?? throw new InvalidOperationException("Missing access oauth_token_secret.");

        // Resolve the Discogs username via /oauth/identity
        using var idDoc = await SendSignedGetAsync(
            "https://api.discogs.com/oauth/identity",
            accessToken,
            accessTokenSecret);

        var discogsUserName = idDoc.RootElement.GetProperty("username").GetString()
            ?? throw new InvalidOperationException("Could not determine Discogs username.");

        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == pending.UserId)
            ?? throw new KeyNotFoundException("User account not found.");

        user.DiscogsUserName = discogsUserName;
        user.DiscogsAccessToken = accessToken;
        user.DiscogsAccessTokenSecret = accessTokenSecret;
        await db.SaveChangesAsync();

        return discogsUserName;
    }

    public async Task<DiscogsImportResultDto> ImportLibraryAsync(string userId, DiscogsImportRequestDto options)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId)
            ?? throw new KeyNotFoundException("User not found.");

        if (string.IsNullOrEmpty(user.DiscogsAccessToken) ||
            string.IsNullOrEmpty(user.DiscogsAccessTokenSecret) ||
            string.IsNullOrEmpty(user.DiscogsUserName))
        {
            throw new InvalidOperationException("Connect your Discogs account first.");
        }

        // Load existing user shelf keys so re-imports skip duplicates cleanly
        var existingKeys = await db.UserRecords
            .AsNoTracking()
            .Include(r => r.CatalogAlbum)
                .ThenInclude(a => a.Artist)
            .Where(r => r.UserId == userId)
            .Select(r => new
            {
                r.Status,
                Artist = r.CatalogAlbum.Artist.Name.ToLower(),
                Title = r.CatalogAlbum.Title.ToLower(),
                Pressing = (r.Pressing ?? "").ToLower()
            })
            .ToListAsync();

        var seenShelfKeys = existingKeys
            .Select(k => $"{k.Status}|{k.Artist}|{k.Title}|{k.Pressing}")
            .ToHashSet();

        int importedOwned = 0;
        int importedWantlist = 0;
        int skipped = 0;
        int newCatalogAlbums = 0;

        if (options.ImportCollection)
        {
            var items = await FetchAllPagesAsync(
                $"https://api.discogs.com/users/{Uri.EscapeDataString(user.DiscogsUserName)}/collection/folders/0/releases",
                "releases",
                user.DiscogsAccessToken,
                user.DiscogsAccessTokenSecret);

            foreach (var item in items)
            {
                var outcome = await UpsertImportedItemAsync(
                    userId, item, RecordStatus.Owned, seenShelfKeys);
                if (outcome.AddedRecord) importedOwned++;
                else skipped++;
                if (outcome.CreatedCatalogAlbum) newCatalogAlbums++;
            }
        }

        if (options.ImportWantlist)
        {
            var items = await FetchAllPagesAsync(
                $"https://api.discogs.com/users/{Uri.EscapeDataString(user.DiscogsUserName)}/wants",
                "wants",
                user.DiscogsAccessToken,
                user.DiscogsAccessTokenSecret);

            foreach (var item in items)
            {
                var outcome = await UpsertImportedItemAsync(
                    userId, item, RecordStatus.Wantlist, seenShelfKeys);
                if (outcome.AddedRecord) importedWantlist++;
                else skipped++;
                if (outcome.CreatedCatalogAlbum) newCatalogAlbums++;
            }
        }

        await db.SaveChangesAsync();

        return new DiscogsImportResultDto(
            importedOwned,
            importedWantlist,
            skipped,
            newCatalogAlbums);
    }

    public async Task DisconnectAsync(string userId)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user is null) return;

        user.DiscogsUserName = null;
        user.DiscogsAccessToken = null;
        user.DiscogsAccessTokenSecret = null;
        await db.SaveChangesAsync();
    }

    private async Task<List<JsonElement>> FetchAllPagesAsync(
        string baseUrl,
        string arrayProperty,
        string accessToken,
        string accessTokenSecret)
    {
        var results = new List<JsonElement>();
        int page = 1;
        int totalPages = 1;

        // Cap at 10 pages (1,000 releases) per sync to stay comfortably within Discogs' 60 req/min limit
        while (page <= totalPages && page <= 10)
        {
            if (page > 1)
                await Task.Delay(1100);

            var url = $"{baseUrl}?page={page}&per_page=100";
            using var doc = await SendSignedGetAsync(url, accessToken, accessTokenSecret);

            if (doc.RootElement.TryGetProperty("pagination", out var pagination) &&
                pagination.TryGetProperty("pages", out var pagesProp))
            {
                totalPages = pagesProp.GetInt32();
            }

            if (doc.RootElement.TryGetProperty(arrayProperty, out var items) &&
                items.ValueKind == JsonValueKind.Array)
            {
                foreach (var entry in items.EnumerateArray())
                    results.Add(entry.Clone());
            }

            page++;
        }

        return results;
    }

    private async Task<(bool AddedRecord, bool CreatedCatalogAlbum)> UpsertImportedItemAsync(
        string userId,
        JsonElement entry,
        RecordStatus status,
        HashSet<string> seenShelfKeys)
    {
        if (!entry.TryGetProperty("basic_information", out var info))
            return (false, false);

        var rawTitle = info.TryGetProperty("title", out var tProp) ? tProp.GetString() : null;
        if (string.IsNullOrWhiteSpace(rawTitle))
            return (false, false);

        var title = rawTitle.Trim();
        var artistName = ExtractArtistName(info);
        var year = info.TryGetProperty("year", out var yProp) && yProp.ValueKind == JsonValueKind.Number
            ? yProp.GetInt32()
            : 0;
        int? releaseYear = year > 0 ? year : null;

        var rawMasterId = info.TryGetProperty("master_id", out var mProp) && mProp.ValueKind == JsonValueKind.Number
            ? mProp.GetInt32()
            : 0;
        int? masterId = rawMasterId > 0 ? rawMasterId : null;

        var coverUrl = ExtractCoverUrl(info);
        var format = ExtractFormat(info);
        var pressing = ExtractPressing(info);

        var dedupeKey = $"{status}|{artistName.ToLower()}|{title.ToLower()}|{(pressing ?? "").ToLower()}";
        if (!seenShelfKeys.Add(dedupeKey))
            return (false, false);

        // 1. Find or create Artist (check Local tracker first to prevent duplicate inserts in one batch)
        var artist = db.Artists.Local.FirstOrDefault(a =>
                         a.Name.Equals(artistName, StringComparison.OrdinalIgnoreCase))
                     ?? await db.Artists.FirstOrDefaultAsync(a =>
                         a.Name.ToLower() == artistName.ToLower());

        if (artist is null)
        {
            artist = new Artist { Name = artistName };
            db.Artists.Add(artist);
        }

        // 2. Find or create shared CatalogAlbum
        CatalogAlbum? album = null;
        if (masterId.HasValue)
        {
            album = db.CatalogAlbums.Local.FirstOrDefault(a => a.DiscogsMasterId == masterId)
                    ?? await db.CatalogAlbums.FirstOrDefaultAsync(a => a.DiscogsMasterId == masterId);
        }

        album ??= db.CatalogAlbums.Local.FirstOrDefault(a =>
                      a.Artist == artist && a.Title.Equals(title, StringComparison.OrdinalIgnoreCase))
                  ?? await db.CatalogAlbums.FirstOrDefaultAsync(a =>
                      a.ArtistId == artist.Id && a.Title.ToLower() == title.ToLower());

        bool createdCatalog = false;
        if (album is null)
        {
            album = new CatalogAlbum
            {
                Artist = artist,
                Title = title,
                ReleaseYear = releaseYear,
                DiscogsMasterId = masterId,
                DefaultCoverUrl = coverUrl
            };
            db.CatalogAlbums.Add(album);
            createdCatalog = true;
        }
        else if (string.IsNullOrEmpty(album.DefaultCoverUrl) && !string.IsNullOrEmpty(coverUrl))
        {
            album.DefaultCoverUrl = coverUrl;
        }

        // 3. Add personal UserRecord
        db.UserRecords.Add(new UserRecord
        {
            UserId = userId,
            CatalogAlbum = album,
            Format = format,
            Pressing = pressing,
            Status = status,
            DateAdded = DateTime.UtcNow
        });

        return (true, createdCatalog);
    }

    private async Task<JsonDocument> SendSignedGetAsync(
        string url,
        string accessToken,
        string accessTokenSecret)
    {
        var authHeader = BuildOAuthHeader(
            token: accessToken,
            tokenSecret: accessTokenSecret,
            callbackUrl: null,
            verifier: null);

        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.UserAgent.ParseAdd(UserAgent);
        request.Headers.Authorization = new AuthenticationHeaderValue("OAuth", authHeader);

        using var response = await httpClient.SendAsync(request);
        var json = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException($"Discogs API error ({(int)response.StatusCode}): {json}");

        return JsonDocument.Parse(json);
    }

    private string BuildOAuthHeader(
        string? token,
        string? tokenSecret,
        string? callbackUrl,
        string? verifier)
    {
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString();
        var nonce = Guid.NewGuid().ToString("N");
        var signature = $"{Uri.EscapeDataString(ConsumerSecret)}&{Uri.EscapeDataString(tokenSecret ?? string.Empty)}";

        var parts = new List<string>
        {
            $"oauth_consumer_key=\"{Uri.EscapeDataString(ConsumerKey)}\"",
            $"oauth_nonce=\"{nonce}\"",
            $"oauth_signature=\"{signature}\"",
            "oauth_signature_method=\"PLAINTEXT\"",
            $"oauth_timestamp=\"{timestamp}\"",
            "oauth_version=\"1.0\""
        };

        if (!string.IsNullOrEmpty(callbackUrl))
            parts.Add($"oauth_callback=\"{Uri.EscapeDataString(callbackUrl)}\"");

        if (!string.IsNullOrEmpty(token))
            parts.Add($"oauth_token=\"{Uri.EscapeDataString(token)}\"");

        if (!string.IsNullOrEmpty(verifier))
            parts.Add($"oauth_verifier=\"{Uri.EscapeDataString(verifier)}\"");

        return string.Join(", ", parts);
    }

    private static string ExtractArtistName(JsonElement info)
    {
        if (info.TryGetProperty("artists", out var artists) &&
            artists.ValueKind == JsonValueKind.Array &&
            artists.GetArrayLength() > 0)
        {
            var raw = artists[0].TryGetProperty("name", out var nameProp)
                ? nameProp.GetString()
                : null;

            if (!string.IsNullOrWhiteSpace(raw))
                return DiscogsSuffixRegex().Replace(raw.Trim(), string.Empty);
        }

        return "Unknown Artist";
    }

    private static string? ExtractCoverUrl(JsonElement info)
    {
        if (info.TryGetProperty("cover_image", out var coverProp))
        {
            var url = coverProp.GetString();
            if (!string.IsNullOrWhiteSpace(url) &&
                url.StartsWith("https://", StringComparison.OrdinalIgnoreCase) &&
                !url.EndsWith("spacer.gif", StringComparison.OrdinalIgnoreCase))
            {
                return url;
            }
        }
        return null;
    }

    private static string ExtractFormat(JsonElement info)
    {
        if (!info.TryGetProperty("formats", out var formats) ||
            formats.ValueKind != JsonValueKind.Array ||
            formats.GetArrayLength() == 0)
        {
            return "LP";
        }

        var first = formats[0];
        if (first.TryGetProperty("descriptions", out var descs) &&
            descs.ValueKind == JsonValueKind.Array)
        {
            var list = descs.EnumerateArray()
                .Select(d => d.GetString() ?? string.Empty)
                .ToList();

            if (list.Any(d => d.Contains("Box Set", StringComparison.OrdinalIgnoreCase))) return "Box Set";
            if (list.Any(d => d.Contains("7\"", StringComparison.OrdinalIgnoreCase))) return "7\"";
            if (list.Any(d => d.Contains("12\"", StringComparison.OrdinalIgnoreCase))) return "12\"";
            if (list.Any(d => d.Equals("EP", StringComparison.OrdinalIgnoreCase))) return "EP";
        }

        return "LP";
    }

    private static string? ExtractPressing(JsonElement info)
    {
        var details = new List<string>();

        if (info.TryGetProperty("labels", out var labels) &&
            labels.ValueKind == JsonValueKind.Array &&
            labels.GetArrayLength() > 0)
        {
            var labelName = labels[0].TryGetProperty("name", out var lName) ? lName.GetString() : null;
            var catNo = labels[0].TryGetProperty("catno", out var cProp) ? cProp.GetString() : null;

            if (!string.IsNullOrWhiteSpace(labelName))
            {
                var cleanLabel = DiscogsSuffixRegex().Replace(labelName.Trim(), string.Empty);
                details.Add(!string.IsNullOrWhiteSpace(catNo) && catNo != "none"
                    ? $"{cleanLabel} ({catNo.Trim()})"
                    : cleanLabel);
            }
        }

        if (info.TryGetProperty("formats", out var formats) &&
            formats.ValueKind == JsonValueKind.Array &&
            formats.GetArrayLength() > 0 &&
            formats[0].TryGetProperty("text", out var textProp))
        {
            var editionText = textProp.GetString();
            if (!string.IsNullOrWhiteSpace(editionText))
                details.Add(editionText.Trim());
        }

        return details.Count > 0 ? string.Join(" · ", details) : null;
    }

    [GeneratedRegex(@"\s*\(\d+\)$")]
    private static partial Regex DiscogsSuffixRegex();

    private sealed record PendingOAuthSession(string UserId, string RequestTokenSecret);
}