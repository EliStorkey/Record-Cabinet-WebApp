namespace RecordCabinet.Server.DTOs;

public record DiscogsConnectionStatusDto(
    bool Connected,
    string? DiscogsUserName
);

public record DiscogsImportRequestDto(
    bool ImportCollection = true,
    bool ImportWantlist = true
);

public record DiscogsImportResultDto(
    int ImportedOwned,
    int ImportedWantlist,
    int SkippedDuplicates,
    int NewCatalogAlbums
);