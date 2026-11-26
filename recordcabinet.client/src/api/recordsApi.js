const BASE_URL = '/api/records';

async function handleResponse(response) {
    if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const message =
            errorData?.title ||
            `Request failed with status ${response.status}`;
        throw new Error(message);
    }
    if (response.status === 204) return null;
    return response.json();
}

export async function fetchRecords({ status, search, format } = {}) {
    const params = new URLSearchParams();
    if (status && status !== 'All') params.append('status', status);
    if (search?.trim()) params.append('search', search.trim());
    if (format && format !== 'All') params.append('format', format);

    const query = params.toString();
    const url = query ? `${BASE_URL}?${query}` : BASE_URL;
    const response = await fetch(url);
    return handleResponse(response);
}

export async function fetchStats() {
    const response = await fetch(`${BASE_URL}/stats`);
    return handleResponse(response);
}

export async function createRecord(record) {
    const response = await fetch(BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
    });
    return handleResponse(response);
}

export async function updateRecord(id, record) {
    const response = await fetch(`${BASE_URL}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
    });
    return handleResponse(response);
}

export async function acquireRecord(id, payload) {
    const response = await fetch(`${BASE_URL}/${id}/acquire`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    return handleResponse(response);
}

export async function deleteRecord(id) {
    const response = await fetch(`${BASE_URL}/${id}`, {
        method: 'DELETE'
    });
    return handleResponse(response);
}

export async function searchCatalog(query, includeExternal = false) {
    if (!query?.trim()) return [];
    const params = new URLSearchParams({
        q: query.trim(),
        external: String(includeExternal)
    });
    const response = await fetch(`/api/catalog/search?${params.toString()}`);
    return handleResponse(response);
}