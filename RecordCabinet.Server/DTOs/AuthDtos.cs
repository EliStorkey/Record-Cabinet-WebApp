using System.ComponentModel.DataAnnotations;
using RecordCabinet.Server.Models;

namespace RecordCabinet.Server.DTOs;

public record RegisterDto(
    [Required, MinLength(3), MaxLength(30), RegularExpression(@"^[a-zA-Z0-9_-]+$", ErrorMessage = "Username may only contain letters, numbers, underscores, and hyphens.")]
    string UserName,
    [Required, EmailAddress, MaxLength(256)]
    string Email,
    [Required, MinLength(8), MaxLength(100)]
    string Password,
    [MaxLength(100)]
    string? DisplayName
);

public record LoginDto(
    [Required] string UserNameOrEmail,
    [Required] string Password
);

public record UserProfileDto(
    string Id,
    string UserName,
    string Email,
    string DisplayName,
    ShelfPrivacy ShelfPrivacy
);