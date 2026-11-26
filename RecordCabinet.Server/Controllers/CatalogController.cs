using Microsoft.AspNetCore.Mvc;
using RecordCabinet.Server.DTOs;
using Microsoft.AspNetCore.Authorization;
using RecordCabinet.Server.Services;

namespace RecordCabinet.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class CatalogController(ICatalogService catalogService) : ControllerBase
{
    [HttpGet("search")]
    public async Task<ActionResult<List<CatalogSearchResultDto>>> Search(
        [FromQuery] string q,
        [FromQuery] bool external = false,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(q))
            return Ok(new List<CatalogSearchResultDto>());

        var results = await catalogService.SearchAsync(q, external, ct);
        return Ok(results);
    }
}