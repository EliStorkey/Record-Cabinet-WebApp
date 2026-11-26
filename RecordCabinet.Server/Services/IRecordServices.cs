using RecordCabinet.Server.DTOs;
using RecordCabinet.Server.Models;

namespace RecordCabinet.Server.Services;

public interface IRecordService
{
    Task<List<RecordResponseDto>> GetAllAsync(
        string userId,
        RecordStatus? status = null,
        string? search = null,
        string? format = null);

    Task<RecordResponseDto?> GetByIdAsync(string userId, int id);
    Task<RecordResponseDto> CreateAsync(string userId, CreateRecordDto dto);
    Task<RecordResponseDto?> UpdateAsync(string userId, int id, UpdateRecordDto dto);
    Task<RecordResponseDto?> MarkAsOwnedAsync(string userId, int id, AcquireRecordDto dto);
    Task<bool> DeleteAsync(string userId, int id);
    Task<CollectionStatsDto> GetStatsAsync(string userId);
}