using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Identity;

namespace RecordCabinet.Server.Models;

public enum ShelfPrivacy
{
    Public = 0,
    FriendsOnly = 1,
    Private = 2
}

public class ApplicationUser : IdentityUser
{
    [MaxLength(100)]
    public string? DisplayName { get; set; }

    public ShelfPrivacy ShelfPrivacy { get; set; } = ShelfPrivacy.FriendsOnly;

    public ICollection<UserRecord> UserRecords { get; set; } = new List<UserRecord>();
}