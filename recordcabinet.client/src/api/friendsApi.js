async function handleFriendResponse(response) {
    if (response.status === 204) return null;

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    if (!response.ok) {
        throw new Error(data?.title || 'Request failed.');
    }
    return data;
}

export async function getFriendsOverview() {
    const response = await fetch('/api/friends', { credentials: 'include' });
    return handleFriendResponse(response);
}

export async function searchUsers(query) {
    if (!query?.trim()) return [];
    const params = new URLSearchParams({ q: query.trim() });
    const response = await fetch(`/api/friends/search?${params.toString()}`, {
        credentials: 'include'
    });
    return handleFriendResponse(response);
}

export async function sendFriendRequest(userName) {
    const response = await fetch(`/api/friends/request/${encodeURIComponent(userName)}`, {
        method: 'POST',
        credentials: 'include'
    });
    return handleFriendResponse(response);
}

export async function acceptFriendRequest(requesterId) {
    const response = await fetch(`/api/friends/accept/${encodeURIComponent(requesterId)}`, {
        method: 'POST',
        credentials: 'include'
    });
    return handleFriendResponse(response);
}

export async function removeFriendship(otherUserId) {
    const response = await fetch(`/api/friends/${encodeURIComponent(otherUserId)}`, {
        method: 'DELETE',
        credentials: 'include'
    });
    return handleFriendResponse(response);
}

export async function getFriendShelf(userName) {
    const response = await fetch(`/api/friends/${encodeURIComponent(userName)}/shelf`, {
        credentials: 'include'
    });
    return handleFriendResponse(response);
}

export async function updateShelfPrivacy(shelfPrivacy) {
    const response = await fetch('/api/auth/privacy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ shelfPrivacy })
    });
    return handleFriendResponse(response);
}