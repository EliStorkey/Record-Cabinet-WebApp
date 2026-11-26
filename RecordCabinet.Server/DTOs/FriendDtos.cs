using RecordCabinet.Server.Models;

namespace RecordCabinet.Server.DTOs;

public record UserSearchResultDto(
    string UserId,
    string UserName,
    string DisplayName,
    string RelationStatus // "None", "PendingSent", "PendingReceived", "Friends"
);

public record FriendItemDto(
    string UserId,
    string UserName,
    string DisplayName,
    DateTime Since
);

public record FriendsOverviewDto(
    List<FriendItemDto> Friends,
    List<FriendItemDto> IncomingRequests,
    List<FriendItemDto> OutgoingRequests
);

public record FriendRecordDto(
    int Id,
    string ArtistName,
    string Title,
    int? ReleaseYear,
    string Format,
    string? Pressing,
    RecordStatus Status,
    string? CoverImageUrl,
    DateTime DateAdded
);

public record FriendShelfDto(
    string UserName,
    string DisplayName,
    int TotalOwned,
    int TotalWantlist,
    List<FriendRecordDto> Records
);

public record UpdatePrivacyDto(ShelfPrivacy ShelfPrivacy);