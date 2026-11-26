using RecordCabinet.Server.DTOs;

namespace RecordCabinet.Server.Services;

public interface IFriendService
{
    Task<FriendsOverviewDto> GetOverviewAsync(string currentUserId);
    Task<List<UserSearchResultDto>> SearchUsersAsync(string currentUserId, string query);
    Task SendRequestAsync(string currentUserId, string targetUserName);
    Task AcceptRequestAsync(string currentUserId, string requesterId);
    Task RemoveFriendshipAsync(string currentUserId, string otherUserId);
    Task<FriendShelfDto> GetFriendShelfAsync(string currentUserId, string targetUserName);
}