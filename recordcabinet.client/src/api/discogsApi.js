async function parseDiscogsResponse(response) {
    if (response.status === 204) return null;

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    if (!response.ok) {
        throw new Error(data?.title || 'Discogs sync failed.');
    }
    return data;
}

export async function getDiscogsStatus() {
    const response = await fetch('/api/discogs/status', { credentials: 'include' });
    return parseDiscogsResponse(response);
}

export async function importDiscogsLibrary(options) {
    const response = await fetch('/api/discogs/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(options)
    });
    return parseDiscogsResponse(response);
}

export async function disconnectDiscogs() {
    const response = await fetch('/api/discogs/disconnect', {
        method: 'DELETE',
        credentials: 'include'
    });
    return parseDiscogsResponse(response);
}