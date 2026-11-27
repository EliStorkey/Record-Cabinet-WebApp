using RecordCabinet.Server.DTOs;

namespace RecordCabinet.Server.Services;

public interface IDiscogsOAuthService
{
    Task<DiscogsConnectionStatusDto> GetStatusAsync(string userId);
    Task<string> StartAuthorizationAsync(string userId, string callbackUrl);
    Task<string> CompleteAuthorizationAsync(string oauthToken, string oauthVerifier);
    Task<DiscogsImportResultDto> ImportLibraryAsync(string userId, DiscogsImportRequestDto options);
    Task DisconnectAsync(string userId);
}