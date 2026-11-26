using Microsoft.EntityFrameworkCore;
using RecordCabinet.Server.Data;
using RecordCabinet.Server.DTOs;
using RecordCabinet.Server.Models;

namespace RecordCabinet.Server.Services;

public class FriendService(AppDbContext db) : IFriendService
{
    public async Task<FriendsOverviewDto> GetOverviewAsync(string currentUserId)
    {
        var relations = await db.Friendships
            .AsNoTracking()
            .Include(f => f.Requester)
            .Include(f => f.Addressee)
            .Where(f => f.RequesterId == currentUserId || f.AddresseeId == currentUserId)
            .OrderByDescending(f => f.CreatedAt)
            .ToListAsync();

        var friends = new List<FriendItemDto>();
        var incoming = new List<FriendItemDto>();
        var outgoing = new List<FriendItemDto>();

        foreach (var rel in relations)
        {
            var isRequester = rel.RequesterId == currentUserId;
            var other = isRequester ? rel.Addressee : rel.Requester;

            var item = new FriendItemDto(
                other.Id,
                other.UserName ?? string.Empty,
                other.DisplayName ?? other.UserName ?? string.Empty,
                rel.CreatedAt);

            if (rel.Status == FriendshipStatus.Accepted)
                friends.Add(item);
            else if (isRequester)
                outgoing.Add(item);
            else
                incoming.Add(item);
        }

        return new FriendsOverviewDto(friends, incoming, outgoing);
    }

    public async Task<List<UserSearchResultDto>> SearchUsersAsync(string currentUserId, string query)
    {
        var term = query.Trim().ToLower();
        if (string.IsNullOrWhiteSpace(term))
            return [];

        var matches = await db.Users
            .AsNoTracking()
            .Where(u => u.Id != currentUserId &&
                        ((u.UserName != null && u.UserName.ToLower().Contains(term)) ||
                         (u.DisplayName != null && u.DisplayName.ToLower().Contains(term))))
            .Take(10)
            .ToListAsync();

        var matchIds = matches.Select(m => m.Id).ToHashSet();

        var existingRelations = await db.Friendships
            .AsNoTracking()
            .Where(f => (f.RequesterId == currentUserId && matchIds.Contains(f.AddresseeId)) ||
                        (f.AddresseeId == currentUserId && matchIds.Contains(f.RequesterId)))
            .ToListAsync();

        return matches.Select(u =>
        {
            var rel = existingRelations.FirstOrDefault(f =>
                f.RequesterId == u.Id || f.AddresseeId == u.Id);

            var status = rel switch
            {
                null => "None",
                { Status: FriendshipStatus.Accepted } => "Friends",
                _ when rel.RequesterId == currentUserId => "PendingSent",
                _ => "PendingReceived"
            };

            return new UserSearchResultDto(
                u.Id,
                u.UserName ?? string.Empty,
                u.DisplayName ?? u.UserName ?? string.Empty,
                status);
        }).ToList();
    }

    public async Task SendRequestAsync(string currentUserId, string targetUserName)
    {
        var normalizedTarget = targetUserName.Trim().ToLower();
        var target = await db.Users
            .FirstOrDefaultAsync(u => u.UserName != null && u.UserName.ToLower() == normalizedTarget);

        if (target is null)
            throw new KeyNotFoundException("User not found.");

        if (target.Id == currentUserId)
            throw new ArgumentException("You cannot send a friend request to yourself.");

        var existing = await db.Friendships.FirstOrDefaultAsync(f =>
            (f.RequesterId == currentUserId && f.AddresseeId == target.Id) ||
            (f.RequesterId == target.Id && f.AddresseeId == currentUserId));

        if (existing is not null)
        {
            if (existing.Status == FriendshipStatus.Accepted)
                throw new ArgumentException("You are already friends with this user.");

            if (existing.RequesterId == currentUserId)
                throw new ArgumentException("Friend request already sent.");

            // If the other user already sent a request, accept it automatically
            existing.Status = FriendshipStatus.Accepted;
            existing.CreatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
            return;
        }

        db.Friendships.Add(new Friendship
        {
            RequesterId = currentUserId,
            AddresseeId = target.Id,
            Status = FriendshipStatus.Pending,
            CreatedAt = DateTime.UtcNow
        });

        await db.SaveChangesAsync();
    }

    public async Task AcceptRequestAsync(string currentUserId, string requesterId)
    {
        var request = await db.Friendships.FirstOrDefaultAsync(f =>
            f.RequesterId == requesterId &&
            f.AddresseeId == currentUserId &&
            f.Status == FriendshipStatus.Pending);

        if (request is null)
            throw new KeyNotFoundException("Pending friend request not found.");

        request.Status = FriendshipStatus.Accepted;
        request.CreatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
    }

    public async Task RemoveFriendshipAsync(string currentUserId, string otherUserId)
    {
        var relation = await db.Friendships.FirstOrDefaultAsync(f =>
            (f.RequesterId == currentUserId && f.AddresseeId == otherUserId) ||
            (f.RequesterId == otherUserId && f.AddresseeId == currentUserId));

        if (relation is null)
            throw new KeyNotFoundException("Friendship or request not found.");

        db.Friendships.Remove(relation);
        await db.SaveChangesAsync();
    }

    public async Task<FriendShelfDto> GetFriendShelfAsync(string currentUserId, string targetUserName)
    {
        var normalizedTarget = targetUserName.Trim().ToLower();
        var targetUser = await db.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.UserName != null && u.UserName.ToLower() == normalizedTarget);

        if (targetUser is null)
            throw new KeyNotFoundException("User not found.");

        if (targetUser.Id != currentUserId)
        {
            if (targetUser.ShelfPrivacy == ShelfPrivacy.Private)
                throw new UnauthorizedAccessException("This user's shelf is private.");

            if (targetUser.ShelfPrivacy == ShelfPrivacy.FriendsOnly)
            {
                var areFriends = await db.Friendships.AnyAsync(f =>
                    f.Status == FriendshipStatus.Accepted &&
                    ((f.RequesterId == currentUserId && f.AddresseeId == targetUser.Id) ||
                     (f.RequesterId == targetUser.Id && f.AddresseeId == currentUserId)));

                if (!areFriends)
                    throw new UnauthorizedAccessException("You must be friends to view this shelf.");
            }
        }

        var records = await db.UserRecords
            .AsNoTracking()
            .Include(r => r.CatalogAlbum)
                .ThenInclude(a => a.Artist)
            .Where(r => r.UserId == targetUser.Id)
            .OrderByDescending(r => r.DateAdded)
            .Select(r => new FriendRecordDto(
                r.Id,
                r.CatalogAlbum.Artist.Name,
                r.CatalogAlbum.Title,
                r.CatalogAlbum.ReleaseYear,
                r.Format,
                r.Pressing,
                r.Status,
                r.CustomCoverUrl ?? r.CatalogAlbum.DefaultCoverUrl,
                r.DateAdded))
            .ToListAsync();

        return new FriendShelfDto(
            targetUser.UserName ?? string.Empty,
            targetUser.DisplayName ?? targetUser.UserName ?? string.Empty,
            records.Count(r => r.Status == RecordStatus.Owned),
            records.Count(r => r.Status == RecordStatus.Wantlist),
            records
        );
    }
}