using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using RecordCabinet.Server.DTOs;
using RecordCabinet.Server.Models;
using RecordCabinet.Server.Services;
using Microsoft.AspNetCore.Authorization;

namespace RecordCabinet.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class RecordsController(IRecordService recordService) : ControllerBase
{
    private string GetCurrentUserId() =>
    User.FindFirstValue(ClaimTypes.NameIdentifier)
    ?? throw new UnauthorizedAccessException("User is not authenticated.");

    [HttpGet]
    public async Task<ActionResult<List<RecordResponseDto>>> GetAll(
        [FromQuery] RecordStatus? status,
        [FromQuery] string? search,
        [FromQuery] string? format)
    {
        var records = await recordService.GetAllAsync(GetCurrentUserId(), status, search, format);
        return Ok(records);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<RecordResponseDto>> GetById(int id)
    {
        var record = await recordService.GetByIdAsync(GetCurrentUserId(), id);
        return record is null ? NotFound() : Ok(record);
    }

    [HttpGet("stats")]
    public async Task<ActionResult<CollectionStatsDto>> GetStats()
    {
        var stats = await recordService.GetStatsAsync(GetCurrentUserId());
        return Ok(stats);
    }

    [HttpPost]
    public async Task<ActionResult<RecordResponseDto>> Create([FromBody] CreateRecordDto dto)
    {
        try
        {
            var created = await recordService.CreateAsync(GetCurrentUserId(), dto);
            return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { title = ex.Message });
        }
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<RecordResponseDto>> Update(int id, [FromBody] UpdateRecordDto dto)
    {
        try
        {
            var updated = await recordService.UpdateAsync(GetCurrentUserId(), id, dto);
            return updated is null ? NotFound() : Ok(updated);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { title = ex.Message });
        }
    }

    [HttpPatch("{id:int}/acquire")]
    public async Task<ActionResult<RecordResponseDto>> Acquire(int id, [FromBody] AcquireRecordDto dto)
    {
        var updated = await recordService.MarkAsOwnedAsync(GetCurrentUserId(), id, dto);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var deleted = await recordService.DeleteAsync(GetCurrentUserId(), id);
        return deleted ? NoContent() : NotFound();
    }
}