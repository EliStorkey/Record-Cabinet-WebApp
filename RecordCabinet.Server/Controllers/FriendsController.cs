using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RecordCabinet.Server.DTOs;
using RecordCabinet.Server.Services;

namespace RecordCabinet.Server.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class FriendsController(IFriendService friendService) : ControllerBase
{
    private string GetCurrentUserId() =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new UnauthorizedAccessException("User is not authenticated.");

    [HttpGet]
    public async Task<ActionResult<FriendsOverviewDto>> GetOverview()
    {
        return Ok(await friendService.GetOverviewAsync(GetCurrentUserId()));
    }

    [HttpGet("search")]
    public async Task<ActionResult<List<UserSearchResultDto>>> SearchUsers([FromQuery] string q)
    {
        if (string.IsNullOrWhiteSpace(q))
            return Ok(new List<UserSearchResultDto>());

        return Ok(await friendService.SearchUsersAsync(GetCurrentUserId(), q));
    }

    [HttpPost("request/{userName}")]
    public async Task<IActionResult> SendRequest(string userName)
    {
        try
        {
            await friendService.SendRequestAsync(GetCurrentUserId(), userName);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { title = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { title = ex.Message });
        }
    }

    [HttpPost("accept/{requesterId}")]
    public async Task<IActionResult> AcceptRequest(string requesterId)
    {
        try
        {
            await friendService.AcceptRequestAsync(GetCurrentUserId(), requesterId);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { title = ex.Message });
        }
    }

    [HttpDelete("{otherUserId}")]
    public async Task<IActionResult> RemoveFriendship(string otherUserId)
    {
        try
        {
            await friendService.RemoveFriendshipAsync(GetCurrentUserId(), otherUserId);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { title = ex.Message });
        }
    }

    [HttpGet("{userName}/shelf")]
    public async Task<ActionResult<FriendShelfDto>> GetFriendShelf(string userName)
    {
        try
        {
            var shelf = await friendService.GetFriendShelfAsync(GetCurrentUserId(), userName);
            return Ok(shelf);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { title = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { title = ex.Message });
        }
    }
}