using RecordCabinet.Server.DTOs;

namespace RecordCabinet.Server.Services;

public interface ICatalogService
{
    Task<List<CatalogSearchResultDto>> SearchAsync(
        string query,
        bool includeExternal = false,
        CancellationToken ct = default);
}