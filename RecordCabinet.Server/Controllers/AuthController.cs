using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using RecordCabinet.Server.DTOs;
using RecordCabinet.Server.Models;

namespace RecordCabinet.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController(
    UserManager<ApplicationUser> userManager,
    SignInManager<ApplicationUser> signInManager) : ControllerBase
{
    [HttpPost("register")]
    public async Task<ActionResult<UserProfileDto>> Register([FromBody] RegisterDto dto)
    {
        var cleanUserName = dto.UserName.Trim();
        var cleanEmail = dto.Email.Trim();

        if (await userManager.FindByNameAsync(cleanUserName) is not null)
            return BadRequest(new { title = "That username is already taken." });

        if (await userManager.FindByEmailAsync(cleanEmail) is not null)
            return BadRequest(new { title = "An account with that email already exists." });

        var user = new ApplicationUser
        {
            UserName = cleanUserName,
            Email = cleanEmail,
            DisplayName = string.IsNullOrWhiteSpace(dto.DisplayName)
                ? cleanUserName
                : dto.DisplayName.Trim()
        };

        var result = await userManager.CreateAsync(user, dto.Password);
        if (!result.Succeeded)
        {
            var message = string.Join(" ", result.Errors.Select(e => e.Description));
            return BadRequest(new { title = message });
        }

        await signInManager.SignInAsync(user, isPersistent: true);
        return Ok(ToProfileDto(user));
    }

    [HttpPost("login")]
    public async Task<ActionResult<UserProfileDto>> Login([FromBody] LoginDto dto)
    {
        var identifier = dto.UserNameOrEmail.Trim();
        var user = identifier.Contains('@')
            ? await userManager.FindByEmailAsync(identifier)
            : await userManager.FindByNameAsync(identifier);

        if (user is null)
            return Unauthorized(new { title = "Invalid username/email or password." });

        var result = await signInManager.PasswordSignInAsync(
            user,
            dto.Password,
            isPersistent: true,
            lockoutOnFailure: true);

        if (result.IsLockedOut)
            return Unauthorized(new { title = "Account temporarily locked due to failed login attempts." });

        if (!result.Succeeded)
            return Unauthorized(new { title = "Invalid username/email or password." });

        return Ok(ToProfileDto(user));
    }

    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await signInManager.SignOutAsync();
        return NoContent();
    }

    [HttpGet("me")]
    public async Task<ActionResult<UserProfileDto>> GetCurrentUser()
    {
        if (User.Identity?.IsAuthenticated != true)
            return Unauthorized();

        var user = await userManager.GetUserAsync(User);
        if (user is null)
            return Unauthorized();

        return Ok(ToProfileDto(user));
    }

    private static UserProfileDto ToProfileDto(ApplicationUser user) => new(
        user.Id,
        user.UserName ?? string.Empty,
        user.Email ?? string.Empty,
        user.DisplayName ?? user.UserName ?? string.Empty,
        user.ShelfPrivacy
    );
}