using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RecordCabinet.Server.DTOs;
using RecordCabinet.Server.Services;

namespace RecordCabinet.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DiscogsController(IDiscogsOAuthService discogsOAuth) : ControllerBase
{
    private string GetCurrentUserId() =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new UnauthorizedAccessException("User is not authenticated.");

    [Authorize]
    [HttpGet("status")]
    public async Task<ActionResult<DiscogsConnectionStatusDto>> GetStatus()
    {
        return Ok(await discogsOAuth.GetStatusAsync(GetCurrentUserId()));
    }

    [Authorize]
    [HttpGet("connect")]
    public async Task<IActionResult> Connect()
    {
        var callbackUrl = $"{Request.Scheme}://{Request.Host}/api/discogs/callback";
        var authorizeUrl = await discogsOAuth.StartAuthorizationAsync(GetCurrentUserId(), callbackUrl);
        return Redirect(authorizeUrl);
    }

    [HttpGet("callback")]
    public async Task<IActionResult> Callback(
        [FromQuery(Name = "oauth_token")] string? oauthToken,
        [FromQuery(Name = "oauth_verifier")] string? oauthVerifier,
        [FromQuery] string? denied)
    {
        if (!string.IsNullOrEmpty(denied) ||
            string.IsNullOrWhiteSpace(oauthToken) ||
            string.IsNullOrWhiteSpace(oauthVerifier))
        {
            return Content(BuildPopupCloseHtml(false, "Discogs authorization was cancelled."), "text/html");
        }

        try
        {
            var discogsUserName = await discogsOAuth.CompleteAuthorizationAsync(oauthToken, oauthVerifier);
            return Content(BuildPopupCloseHtml(true, discogsUserName), "text/html");
        }
        catch (Exception ex)
        {
            return Content(BuildPopupCloseHtml(false, ex.Message), "text/html");
        }
    }

    [Authorize]
    [HttpPost("import")]
    public async Task<ActionResult<DiscogsImportResultDto>> Import([FromBody] DiscogsImportRequestDto dto)
    {
        try
        {
            var result = await discogsOAuth.ImportLibraryAsync(GetCurrentUserId(), dto);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { title = ex.Message });
        }
    }

    [Authorize]
    [HttpDelete("disconnect")]
    public async Task<IActionResult> Disconnect()
    {
        await discogsOAuth.DisconnectAsync(GetCurrentUserId());
        return NoContent();
    }

    private static string BuildPopupCloseHtml(bool success, string payload)
    {
        var encodedPayload = JavaScriptEncoder.Default.Encode(payload);
        var statusType = success ? "DISCOGS_CONNECTED" : "DISCOGS_ERROR";

        return $$"""
        <!DOCTYPE html>
        <html>
        <head><title>Connecting Discogs...</title></head>
        <body style="background:#0b0c0e;color:#f2efe9;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
          <p>Finishing Discogs connection... You can close this window.</p>
          <script>
            if (window.opener) {
              window.opener.postMessage(
                { type: "{{statusType}}", payload: "{{encodedPayload}}" },
                window.location.origin
              );
            }
            window.close();
          </script>
        </body>
        </html>
        """;
    }
}