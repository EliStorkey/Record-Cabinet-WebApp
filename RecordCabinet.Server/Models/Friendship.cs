using System.ComponentModel.DataAnnotations;

namespace RecordCabinet.Server.Models;

public enum FriendshipStatus
{
    Pending = 0,
    Accepted = 1
}

public class Friendship
{
    [Required, MaxLength(450)]
    public string RequesterId { get; set; } = string.Empty;
    public ApplicationUser Requester { get; set; } = null!;

    [Required, MaxLength(450)]
    public string AddresseeId { get; set; } = string.Empty;
    public ApplicationUser Addressee { get; set; } = null!;

    public FriendshipStatus Status { get; set; } = FriendshipStatus.Pending;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}