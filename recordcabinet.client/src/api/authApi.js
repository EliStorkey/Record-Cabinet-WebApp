async function parseAuthResponse(response) {
    if (response.status === 204) return null;

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    if (!response.ok) {
        throw new Error(data?.title || 'Authentication failed.');
    }
    return data;
}

export async function getCurrentUser() {
    const response = await fetch('/api/auth/me', { credentials: 'include' });
    if (response.status === 401) return null;
    return parseAuthResponse(response);
}

export async function registerUser(payload) {
    const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
    });
    return parseAuthResponse(response);
}

export async function loginUser(payload) {
    const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
    });
    return parseAuthResponse(response);
}

export async function logoutUser() {
    const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
    });
    return parseAuthResponse(response);
}