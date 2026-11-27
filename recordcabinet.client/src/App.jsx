import { useEffect, useState } from 'react';
import {
    acquireRecord,
    createRecord,
    deleteRecord,
    fetchRecords,
    fetchStats,
    searchCatalog,
    updateRecord
} from './api/recordsApi';
import {
    getCurrentUser,
    loginUser,
    logoutUser,
    registerUser
} from './api/authApi';
import {
    disconnectDiscogs,
    getDiscogsStatus,
    importDiscogsLibrary
} from './api/discogsApi';
import {
    acceptFriendRequest,
    getFriendShelf,
    getFriendsOverview,
    removeFriendship,
    searchUsers,
    sendFriendRequest,
    updateShelfPrivacy
} from './api/friendsApi';
import './App.css';

const FORMAT_OPTIONS = ['LP', '12"', '7"', 'EP', 'Box Set'];

const EMPTY_FORM = {
    catalogAlbumId: null,
    discogsMasterId: null,
    artistName: '',
    title: '',
    releaseYear: '',
    format: 'LP',
    pressing: '',
    status: 'Owned',
    coverImageUrl: '',
    defaultCoverUrl: '',
    notes: ''
};

function AlbumCover({ src, alt, size = 76 }) {
    const [failedSrc, setFailedSrc] = useState(null);
    const showImage = Boolean(src) && failedSrc !== src;

    if (showImage) {
        return (
            <img
                className={size <= 44 ? 'catalog-result-thumb' : 'cover-thumb'}
                src={src}
                alt={alt}
                referrerPolicy="no-referrer"
                onError={() => setFailedSrc(src)}
            />
        );
    }

    return (
        <div
            className="cover-placeholder"
            style={size ? { width: size, height: size } : { width: '100%', height: '100%' }}
            aria-label="Default vinyl sleeve"
        >
            <svg
                width={(size || 76) * 0.45}
                height={(size || 76) * 0.45}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
            >
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="3" />
                <circle cx="12" cy="12" r="1" fill="currentColor" />
            </svg>
        </div>
    );
}

function AuthGate({ onAuthenticated }) {
    const [mode, setMode] = useState('login');
    const [userName, setUserName] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setSubmitting(true);

        try {
            const profile =
                mode === 'login'
                    ? await loginUser({ userNameOrEmail: userName, password })
                    : await registerUser({ userName, email, password, displayName });
            onAuthenticated(profile);
        } catch (err) {
            setError(err.message || 'Authentication failed.');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="auth-shell">
            <div className="auth-card">
                <h1 className="hero-title" style={{ fontSize: '2.1rem' }}>
                    RECORD <span className="accent">CABINET.</span>
                </h1>
                <p className="subtitle" style={{ marginTop: '0.5rem' }}>
                    {mode === 'login'
                        ? 'Sign in to open your pressing archive'
                        : 'Register an account to catalogue your collection'}
                </p>

                {error && (
                    <div className="error-banner" style={{ marginTop: '1rem' }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ marginTop: '1.5rem' }}>
                    <div className="pressing-field">
                        <label className="pressing-label">
                            <span className="idx">A1</span>
                            {mode === 'login' ? 'Username or Email' : 'Username *'}
                        </label>
                        <input
                            required
                            className="underline-input"
                            autoComplete="username"
                            placeholder={mode === 'login' ? 'eli or eli@example.com' : 'e.g. elistorkey'}
                            value={userName}
                            onChange={(e) => setUserName(e.target.value)}
                        />
                    </div>

                    {mode === 'register' && (
                        <>
                            <div className="pressing-field">
                                <label className="pressing-label">
                                    <span className="idx">A2</span>Display Name
                                </label>
                                <input
                                    className="underline-input"
                                    placeholder="e.g. Eli"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                />
                            </div>
                            <div className="pressing-field">
                                <label className="pressing-label">
                                    <span className="idx">A3</span>Email *
                                </label>
                                <input
                                    required
                                    type="email"
                                    className="underline-input"
                                    autoComplete="email"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                        </>
                    )}

                    <div className="pressing-field">
                        <label className="pressing-label">
                            <span className="idx">{mode === 'login' ? 'A2' : 'A4'}</span>Password *
                        </label>
                        <input
                            required
                            type="password"
                            minLength={8}
                            className="underline-input"
                            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                            placeholder="Minimum 8 characters with a number"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn-cream-pill"
                        style={{ width: '100%', marginTop: '0.5rem' }}
                        disabled={submitting}
                    >
                        {submitting
                            ? 'PLEASE WAIT...'
                            : mode === 'login'
                                ? 'ENTER CABINET ↗'
                                : 'CREATE ACCOUNT ↗'}
                    </button>
                </form>

                <p className="auth-switch">
                    {mode === 'login' ? (
                        <>
                            New collector?{' '}
                            <button
                                type="button"
                                className="link-btn"
                                onClick={() => {
                                    setMode('register');
                                    setError('');
                                }}
                            >
                                Create an account
                            </button>
                        </>
                    ) : (
                        <>
                            Already catalogued?{' '}
                            <button
                                type="button"
                                className="link-btn"
                                onClick={() => {
                                    setMode('login');
                                    setError('');
                                }}
                            >
                                Sign in
                            </button>
                        </>
                    )}
                </p>
            </div>
        </div>
    );
}

function FriendShelfView({ userName, onBack }) {
    const [shelfState, setShelfState] = useState({
        loadedFor: null,
        data: null,
        error: ''
    });
    const [tab, setTab] = useState('Owned');

    useEffect(() => {
        let ignore = false;
        getFriendShelf(userName)
            .then((data) => {
                if (!ignore) {
                    setShelfState({ loadedFor: userName, data, error: '' });
                }
            })
            .catch((err) => {
                if (!ignore) {
                    setShelfState({
                        loadedFor: userName,
                        data: null,
                        error: err.message || 'Could not load shelf.'
                    });
                }
            });
        return () => {
            ignore = true;
        };
    }, [userName]);

    const loading = shelfState.loadedFor !== userName;
    const shelf = shelfState.data;
    const error = shelfState.error;

    if (loading) return <p className="subtitle">Spinning up @{userName}'s shelf...</p>;

    if (error) {
        return (
            <div>
                <div className="error-banner">{error}</div>
                <button className="btn-secondary" onClick={onBack}>
                    ← Back to Friends
                </button>
            </div>
        );
    }

    const filtered = shelf.records.filter((r) => r.status === tab);

    return (
        <div>
            <div className="shelf-banner">
                <div>
                    <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', textTransform: 'uppercase' }}>
                        {shelf.displayName}'s <span style={{ color: 'var(--accent)' }}>Cabinet</span>
                    </h2>
                    <p className="subtitle" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                        @{shelf.userName} · {shelf.totalOwned} OWNED · {shelf.totalWantlist} WANT LIST
                    </p>
                </div>
                <button className="btn-secondary" onClick={onBack}>
                    ← Back to Friends
                </button>
            </div>

            <div className="controls-bar">
                <div className="tabs">
                    <button
                        className={`tab-btn ${tab === 'Owned' ? 'active' : ''}`}
                        onClick={() => setTab('Owned')}
                    >
                        Collection ({shelf.totalOwned})
                    </button>
                    <button
                        className={`tab-btn ${tab === 'Wantlist' ? 'active' : ''}`}
                        onClick={() => setTab('Wantlist')}
                    >
                        Want List ({shelf.totalWantlist})
                    </button>
                </div>
            </div>

            {filtered.length === 0 ? (
                <div className="empty-state">NO RECORDS IN THIS CRATE YET.</div>
            ) : (
                <div className="records-grid">
                    {filtered.map((record, idx) => (
                        <article key={record.id} className="grid-card" style={{ '--stagger': idx }}>
                            <div className="sleeve-stage">
                                <div className="vinyl-peek-disc" />
                                <div className="sleeve-artwork-wrap">
                                    <div className="sleeve-top-badges">
                                        <span className="badge badge-format">{record.format}</span>
                                    </div>
                                    <AlbumCover src={record.coverImageUrl} alt={`${record.title} cover`} size={0} />
                                </div>
                            </div>
                            <h3 className="grid-card-title">{record.title}</h3>
                            <p className="grid-card-artist">
                                {record.artistName}
                                {record.releaseYear ? ` · ${record.releaseYear}` : ''}
                            </p>
                            {record.pressing && <p className="record-meta">{record.pressing}</p>}
                        </article>
                    ))}
                </div>
            )}
        </div>
    );
}

function FriendsHub({ currentUser, onUserUpdated, overview, onRefreshOverview }) {
    const [query, setQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedFriend, setSelectedFriend] = useState(null);
    const [feedback, setFeedback] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        const trimmed = query.trim();
        if (!trimmed) return;

        let ignore = false;
        const timer = setTimeout(() => {
            searchUsers(trimmed)
                .then((res) => {
                    if (!ignore) setSearchResults(res);
                })
                .catch(() => {
                    if (!ignore) setSearchResults([]);
                });
        }, 300);

        return () => {
            ignore = true;
            clearTimeout(timer);
        };
    }, [query]);

    async function handleSendRequest(userName) {
        try {
            setError('');
            await sendFriendRequest(userName);
            setFeedback(`Friend request sent to @${userName}.`);
            setQuery('');
            setSearchResults([]);
            onRefreshOverview();
        } catch (err) {
            setError(err.message);
        }
    }

    async function handleAccept(requesterId) {
        try {
            setError('');
            await acceptFriendRequest(requesterId);
            onRefreshOverview();
        } catch (err) {
            setError(err.message);
        }
    }

    async function handleRemove(userId) {
        try {
            setError('');
            await removeFriendship(userId);
            onRefreshOverview();
        } catch (err) {
            setError(err.message);
        }
    }

    async function handlePrivacyChange(newPrivacy) {
        try {
            setError('');
            const updated = await updateShelfPrivacy(newPrivacy);
            onUserUpdated(updated);
            setFeedback('Shelf visibility updated.');
        } catch (err) {
            setError(err.message);
        }
    }

    if (selectedFriend) {
        return (
            <FriendShelfView
                userName={selectedFriend}
                onBack={() => setSelectedFriend(null)}
            />
        );
    }

    const visibleSearchResults = query.trim() ? searchResults : [];

    return (
        <div>
            {error && <div className="error-banner">{error}</div>}
            {feedback && (
                <div
                    className="privacy-bar"
                    style={{ borderColor: 'var(--accent-border)', color: 'var(--accent-bright)' }}
                >
                    <span>{feedback}</span>
                    <button className="mono-link-btn" onClick={() => setFeedback('')}>
                        Dismiss
                    </button>
                </div>
            )}

            <div className="privacy-bar">
                <div>
                    <strong>Shelf Visibility</strong>
                    <div className="subtitle">Control who can browse your collection and want list</div>
                </div>
                <select
                    value={currentUser.shelfPrivacy}
                    onChange={(e) => handlePrivacyChange(e.target.value)}
                >
                    <option value="FriendsOnly">Friends Only</option>
                    <option value="Public">Public (All Signed-In Users)</option>
                    <option value="Private">Private (Only Me)</option>
                </select>
            </div>

            <div className="friend-panel">
                <h3>Find Collectors</h3>
                <input
                    type="search"
                    className="underline-input"
                    placeholder="Search by username or display name..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
                {visibleSearchResults.length > 0 && (
                    <div style={{ marginTop: '0.75rem' }}>
                        {visibleSearchResults.map((u) => (
                            <div key={u.userId} className="friend-row">
                                <div>
                                    <strong>{u.displayName}</strong>{' '}
                                    <span className="subtitle">@{u.userName}</span>
                                </div>
                                <div className="friend-row-actions">
                                    {u.relationStatus === 'None' && (
                                        <button
                                            className="btn-primary"
                                            onClick={() => handleSendRequest(u.userName)}
                                        >
                                            + Add Friend
                                        </button>
                                    )}
                                    {u.relationStatus === 'PendingSent' && (
                                        <span className="source-pill">Request Sent</span>
                                    )}
                                    {u.relationStatus === 'PendingReceived' && (
                                        <button
                                            className="btn-acquire"
                                            onClick={() => handleAccept(u.userId)}
                                        >
                                            Accept
                                        </button>
                                    )}
                                    {u.relationStatus === 'Friends' && (
                                        <button
                                            className="btn-secondary"
                                            onClick={() => setSelectedFriend(u.userName)}
                                        >
                                            View Shelf
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="friends-grid">
                <div className="friend-panel">
                    <h3>Friends ({overview.friends.length})</h3>
                    {overview.friends.length === 0 ? (
                        <p className="subtitle">No friends added yet.</p>
                    ) : (
                        overview.friends.map((f) => (
                            <div key={f.userId} className="friend-row">
                                <div>
                                    <strong>{f.displayName}</strong>
                                    <div className="subtitle">@{f.userName}</div>
                                </div>
                                <div className="friend-row-actions">
                                    <button
                                        className="btn-primary"
                                        onClick={() => setSelectedFriend(f.userName)}
                                    >
                                        View Shelf
                                    </button>
                                    <button
                                        className="btn-danger"
                                        onClick={() => handleRemove(f.userId)}
                                    >
                                        Remove
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="friend-panel">
                    <h3>
                        Pending Requests ({overview.incomingRequests.length + overview.outgoingRequests.length})
                    </h3>
                    {overview.incomingRequests.length === 0 && overview.outgoingRequests.length === 0 ? (
                        <p className="subtitle">No pending requests.</p>
                    ) : (
                        <>
                            {overview.incomingRequests.map((req) => (
                                <div key={req.userId} className="friend-row">
                                    <div>
                                        <strong>{req.displayName}</strong>
                                        <div className="subtitle">@{req.userName} · Incoming</div>
                                    </div>
                                    <div className="friend-row-actions">
                                        <button
                                            className="btn-acquire"
                                            onClick={() => handleAccept(req.userId)}
                                        >
                                            Accept
                                        </button>
                                        <button
                                            className="btn-secondary"
                                            onClick={() => handleRemove(req.userId)}
                                        >
                                            Decline
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {overview.outgoingRequests.map((req) => (
                                <div key={req.userId} className="friend-row">
                                    <div>
                                        <strong>{req.displayName}</strong>
                                        <div className="subtitle">@{req.userName} · Sent</div>
                                    </div>
                                    <button
                                        className="btn-secondary"
                                        onClick={() => handleRemove(req.userId)}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function DiscogsImportDrawer({ onClose, onImported }) {
    const [status, setStatus] = useState({ connected: false, discogsUserName: null });
    const [importCollection, setImportCollection] = useState(true);
    const [importWantlist, setImportWantlist] = useState(true);
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        let ignore = false;
        getDiscogsStatus()
            .then((data) => {
                if (!ignore) setStatus(data);
            })
            .catch(() => { });
        return () => {
            ignore = true;
        };
    }, []);

    useEffect(() => {
        function handlePopupMessage(event) {
            if (event.origin !== window.location.origin) return;
            if (event.data?.type === 'DISCOGS_CONNECTED') {
                setError('');
                setStatus({ connected: true, discogsUserName: event.data.payload });
            } else if (event.data?.type === 'DISCOGS_ERROR') {
                setError(event.data.payload || 'Discogs authorization failed.');
            }
        }

        window.addEventListener('message', handlePopupMessage);
        return () => window.removeEventListener('message', handlePopupMessage);
    }, []);

    function openDiscogsPopup() {
        setError('');
        const width = 560;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        window.open(
            '/api/discogs/connect',
            'discogs_oauth',
            `width=${width},height=${height},left=${left},top=${top},popup=yes`
        );
    }

    async function handleImport() {
        if (!importCollection && !importWantlist) {
            setError('Select at least one list to import.');
            return;
        }
        try {
            setError('');
            setResult(null);
            setImporting(true);
            const summary = await importDiscogsLibrary({ importCollection, importWantlist });
            setResult(summary);
            onImported();
        } catch (err) {
            setError(err.message || 'Import failed.');
        } finally {
            setImporting(false);
        }
    }

    async function handleDisconnect() {
        await disconnectDiscogs();
        setStatus({ connected: false, discogsUserName: null });
        setResult(null);
    }

    return (
        <div
            className="drawer-backdrop"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <aside className="drawer-panel" aria-label="Discogs library import">
                <div className="drawer-header">
                    <span>DISCOGS SYNC // OAUTH</span>
                    <button type="button" className="mono-link-btn" onClick={onClose}>
                        [ESC]
                    </button>
                </div>

                <div className="drawer-body">
                    {error && <div className="error-banner">{error}</div>}

                    <div className="pressing-field">
                        <label className="pressing-label">
                            <span className="idx">01</span>Account Connection
                        </label>
                        {status.connected ? (
                            <div className="privacy-bar" style={{ marginBottom: 0 }}>
                                <div>
                                    <strong style={{ color: 'var(--sage)' }}>Connected</strong>
                                    <div className="subtitle">@{status.discogsUserName}</div>
                                </div>
                                <button type="button" className="btn-secondary" onClick={handleDisconnect}>
                                    Disconnect
                                </button>
                            </div>
                        ) : (
                            <div>
                                <p className="subtitle" style={{ marginBottom: '0.9rem' }}>
                                    Sign in via Discogs popup to import your collection and wantlist automatically.
                                </p>
                                <button type="button" className="btn-cream-pill" onClick={openDiscogsPopup}>
                                    Connect Discogs Account ↗
                                </button>
                            </div>
                        )}
                    </div>

                    {status.connected && (
                        <div className="pressing-field" style={{ marginTop: '1.5rem' }}>
                            <label className="pressing-label">
                                <span className="idx">02</span>Select Shelves to Sync
                            </label>
                            <div className="pill-selector-row">
                                <button
                                    type="button"
                                    className={`pill-choice ${importCollection ? 'selected' : ''}`}
                                    onClick={() => setImportCollection((v) => !v)}
                                >
                                    {importCollection ? '✓ ' : ''}Collection (Owned)
                                </button>
                                <button
                                    type="button"
                                    className={`pill-choice ${importWantlist ? 'selected' : ''}`}
                                    onClick={() => setImportWantlist((v) => !v)}
                                >
                                    {importWantlist ? '✓ ' : ''}Want List
                                </button>
                            </div>
                        </div>
                    )}

                    {result && (
                        <div
                            className="friend-panel"
                            style={{ marginTop: '1.25rem', borderColor: 'var(--accent-border)' }}
                        >
                            <h3 style={{ color: 'var(--accent-bright)' }}>Import Complete</h3>
                            <p className="subtitle">
                                <strong>{result.importedOwned}</strong> added to Collection ·{' '}
                                <strong>{result.importedWantlist}</strong> added to Want List ·{' '}
                                <strong>{result.skippedDuplicates}</strong> duplicates skipped
                            </p>
                        </div>
                    )}
                </div>

                <div className="drawer-footer">
                    <button type="button" className="btn-secondary" onClick={onClose}>
                        Close
                    </button>
                    {status.connected && (
                        <button
                            type="button"
                            className="btn-cream-pill"
                            disabled={importing}
                            onClick={handleImport}
                        >
                            {importing ? 'SYNCING CRATES...' : 'IMPORT NOW ↗'}
                        </button>
                    )}
                </div>
            </aside>
        </div>
    );
}

export default function App() {
    const [currentUser, setCurrentUser] = useState(null);
    const [authChecked, setAuthChecked] = useState(false);
    const [showDiscogsDrawer, setShowDiscogsDrawer] = useState(false);
    const [page, setPage] = useState('cabinet');
    const [viewMode, setViewMode] = useState('grid');

    const [friendsOverview, setFriendsOverview] = useState({
        friends: [],
        incomingRequests: [],
        outgoingRequests: []
    });
    const [friendsRefreshKey, setFriendsRefreshKey] = useState(0);

    const [records, setRecords] = useState([]);
    const [stats, setStats] = useState({
        totalOwned: 0,
        totalWantlist: 0,
        totalArtists: 0,
        byFormat: {}
    });

    const [activeTab, setActiveTab] = useState('Owned');
    const [search, setSearch] = useState('');
    const [formatFilter, setFormatFilter] = useState('All');

    const [showDrawer, setShowDrawer] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState(EMPTY_FORM);

    const [catalogQuery, setCatalogQuery] = useState('');
    const [catalogResults, setCatalogResults] = useState([]);
    const [searchingCatalog, setSearchingCatalog] = useState(false);

    const [acquiringId, setAcquiringId] = useState(null);
    const [acquireForm, setAcquireForm] = useState({ pressing: '', notes: '' });

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [refreshKey, setRefreshKey] = useState(0);

    // 1. Check active session cookie on startup
    useEffect(() => {
        getCurrentUser()
            .then((user) => setCurrentUser(user))
            .catch(() => setCurrentUser(null))
            .finally(() => setAuthChecked(true));
    }, []);

    // 2. Fetch friends overview
    useEffect(() => {
        if (!currentUser) return;
        getFriendsOverview()
            .then((data) => setFriendsOverview(data))
            .catch(() => { });
    }, [currentUser, friendsRefreshKey]);

    // 3. Fetch signed-in user's records and stats
    useEffect(() => {
        if (!currentUser) return;

        let ignore = false;

        Promise.all([
            fetchRecords({ status: activeTab, search, format: formatFilter }),
            fetchStats()
        ])
            .then(([recordsData, statsData]) => {
                if (ignore) return;
                setError('');
                setRecords(recordsData);
                setStats(statsData);
            })
            .catch((err) => {
                if (ignore) return;
                setError(err.message || 'Failed to load records.');
            })
            .finally(() => {
                if (!ignore) setLoading(false);
            });

        return () => {
            ignore = true;
        };
    }, [currentUser, activeTab, search, formatFilter, refreshKey]);

    // 4. Debounced local-first catalog search inside drawer
    useEffect(() => {
        if (!showDrawer || editingId) return;

        const trimmed = catalogQuery.trim();
        if (!trimmed) return;

        let ignore = false;
        const timer = setTimeout(() => {
            setSearchingCatalog(true);
            searchCatalog(trimmed, false)
                .then((items) => {
                    if (!ignore) setCatalogResults(items);
                })
                .catch(() => {
                    if (!ignore) setCatalogResults([]);
                })
                .finally(() => {
                    if (!ignore) setSearchingCatalog(false);
                });
        }, 350);

        return () => {
            ignore = true;
            clearTimeout(timer);
        };
    }, [catalogQuery, showDrawer, editingId]);

    async function handleLogout() {
        await logoutUser();
        setCurrentUser(null);
        setPage('cabinet');
        setRecords([]);
        setStats({ totalOwned: 0, totalWantlist: 0, totalArtists: 0, byFormat: {} });
        setShowDrawer(false);
        setShowDiscogsDrawer(false);
        setEditingId(null);
    }

    async function handleExternalDiscogsSearch() {
        if (!catalogQuery.trim()) return;
        try {
            setSearchingCatalog(true);
            setError('');
            const items = await searchCatalog(catalogQuery, true);
            setCatalogResults(items);
        } catch (err) {
            setError(err.message || 'Discogs search failed.');
        } finally {
            setSearchingCatalog(false);
        }
    }

    function applyCatalogMatch(item) {
        setFormData((prev) => ({
            ...prev,
            catalogAlbumId: item.catalogAlbumId ?? null,
            discogsMasterId: item.discogsMasterId ?? null,
            artistName: item.artistName,
            title: item.title,
            releaseYear: item.releaseYear ?? '',
            coverImageUrl: item.defaultCoverUrl ?? '',
            defaultCoverUrl: item.defaultCoverUrl ?? ''
        }));
        setCatalogResults([]);
    }

    function openAddDrawer() {
        setEditingId(null);
        setCatalogQuery('');
        setCatalogResults([]);
        setFormData({
            ...EMPTY_FORM,
            status: activeTab === 'Wantlist' ? 'Wantlist' : 'Owned'
        });
        setShowDrawer(true);
    }

    function openEditDrawer(record) {
        setEditingId(record.id);
        setCatalogQuery('');
        setCatalogResults([]);
        setFormData({
            catalogAlbumId: record.catalogAlbumId,
            discogsMasterId: null,
            artistName: record.artistName,
            title: record.title,
            releaseYear: record.releaseYear ?? '',
            format: record.format,
            pressing: record.pressing ?? '',
            status: record.status,
            coverImageUrl: record.coverImageUrl ?? '',
            defaultCoverUrl: record.defaultCoverUrl ?? '',
            notes: record.notes ?? ''
        });
        setShowDrawer(true);
    }

    async function handleFormSubmit(e) {
        e.preventDefault();
        try {
            setError('');
            if (editingId) {
                await updateRecord(editingId, {
                    artistName: formData.artistName,
                    title: formData.title,
                    releaseYear: formData.releaseYear ? Number(formData.releaseYear) : null,
                    format: formData.format,
                    pressing: formData.pressing || null,
                    status: formData.status,
                    coverImageUrl: formData.coverImageUrl || null,
                    notes: formData.notes || null
                });
            } else {
                await createRecord({
                    catalogAlbumId: formData.catalogAlbumId,
                    discogsMasterId: formData.discogsMasterId,
                    artistName: formData.artistName,
                    title: formData.title,
                    releaseYear: formData.releaseYear ? Number(formData.releaseYear) : null,
                    format: formData.format,
                    pressing: formData.pressing || null,
                    status: formData.status,
                    coverImageUrl: formData.coverImageUrl || null,
                    notes: formData.notes || null
                });
            }

            setShowDrawer(false);
            setEditingId(null);
            setFormData(EMPTY_FORM);
            setRefreshKey((k) => k + 1);
        } catch (err) {
            setError(err.message || 'Could not save record.');
        }
    }

    function startAcquire(record) {
        setAcquiringId(record.id);
        setAcquireForm({
            pressing: record.pressing ?? '',
            notes: record.notes ?? ''
        });
    }

    async function handleConfirmAcquire(id) {
        try {
            setError('');
            await acquireRecord(id, {
                pressing: acquireForm.pressing || null,
                notes: acquireForm.notes || null
            });
            setAcquiringId(null);
            setRefreshKey((k) => k + 1);
        } catch (err) {
            setError(err.message || 'Could not update record status.');
        }
    }

    async function handleDelete(id, title) {
        if (!window.confirm(`Remove "${title}" from your cabinet?`)) return;
        try {
            setError('');
            await deleteRecord(id);
            setShowDrawer(false);
            setEditingId(null);
            setRefreshKey((k) => k + 1);
        } catch (err) {
            setError(err.message || 'Could not delete record.');
        }
    }

    if (!authChecked) {
        return (
            <div className="auth-shell">
                <p className="subtitle" style={{ fontFamily: 'var(--font-mono)' }}>
                    CALIBRATING TURNTABLE...
                </p>
            </div>
        );
    }

    if (!currentUser) {
        return (
            <AuthGate
                onAuthenticated={(user) => {
                    setLoading(true);
                    setCurrentUser(user);
                }}
            />
        );
    }

    const visibleCatalogResults = catalogQuery.trim() ? catalogResults : [];
    const pressingNumber = String((editingId ?? stats.totalOwned + stats.totalWantlist + 1)).padStart(4, '0');

    return (
        <div className="app-container">
            <div className="telemetry-bar">
                <div className="telemetry-right">
                    <span className="user-chip">@{currentUser.userName}</span>
                    <button className="mono-link-btn" onClick={handleLogout}>
                        Sign Out
                    </button>
                </div>
            </div>

            {/* Editorial Hero Header */}
            <header className="hero-header">
                <div>
                    <h1 className="hero-title">
                        RECORD <span className="accent">CABINET.</span>
                    </h1>
                    <div className="hero-meta-strip">
                        <span>
                            <span className="hero-meta-index">01</span>
                            <strong>{stats.totalOwned}</strong> Owned
                        </span>
                        <span>
                            <span className="hero-meta-index">02</span>
                            <strong>{stats.totalWantlist}</strong> Wantlist
                        </span>
                        <span>
                            <span className="hero-meta-index">03</span>
                            <strong>{stats.totalArtists}</strong> Artists
                        </span>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
                    <button className="btn-secondary" onClick={() => setShowDiscogsDrawer(true)}>
                        Import Discogs
                    </button>
                    <button className="btn-cream-pill" onClick={openAddDrawer}>
                        + Add Pressing ↗
                    </button>
                </div>
            </header>

            {/* Primary Destination Switcher */}
            <nav className="nav-pill-group">
                <button
                    className={`nav-pill-btn ${page === 'cabinet' ? 'active' : ''}`}
                    onClick={() => setPage('cabinet')}
                >
                    My Cabinet
                </button>
                <button
                    className={`nav-pill-btn ${page === 'friends' ? 'active' : ''}`}
                    onClick={() => setPage('friends')}
                >
                    Friends
                    {friendsOverview.incomingRequests.length > 0
                        ? ` (${friendsOverview.incomingRequests.length})`
                        : ''}
                </button>
            </nav>

            {error && <div className="error-banner">{error}</div>}

            {page === 'friends' ? (
                <FriendsHub
                    currentUser={currentUser}
                    onUserUpdated={(updated) => setCurrentUser(updated)}
                    overview={friendsOverview}
                    onRefreshOverview={() => setFriendsRefreshKey((k) => k + 1)}
                />
            ) : (
                <>
                    {/* Sticky Crate Controls Bar */}
                    <div className="controls-bar">
                        <div className="tabs">
                            {[
                                { id: 'Owned', label: 'Collection' },
                                { id: 'Wantlist', label: 'Want List' },
                                { id: 'All', label: 'All' }
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                                    onClick={() => setActiveTab(tab.id)}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="filters">
                            <input
                                className="search-input"
                                type="search"
                                placeholder="Filter artist, title, pressing..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                            <select value={formatFilter} onChange={(e) => setFormatFilter(e.target.value)}>
                                <option value="All">All Formats</option>
                                {FORMAT_OPTIONS.map((fmt) => (
                                    <option key={fmt} value={fmt}>
                                        {fmt}
                                    </option>
                                ))}
                            </select>

                            <div className="view-toggle" role="group" aria-label="Shelf layout mode">
                                <button
                                    type="button"
                                    className={viewMode === 'grid' ? 'active' : ''}
                                    onClick={() => setViewMode('grid')}
                                >
                                    Grid
                                </button>
                                <button
                                    type="button"
                                    className={viewMode === 'list' ? 'active' : ''}
                                    onClick={() => setViewMode('list')}
                                >
                                    Crate
                                </button>
                            </div>
                        </div>
                    </div>

                    {loading ? (
                        <p className="subtitle" style={{ fontFamily: 'var(--font-mono)' }}>
                            LOADING PRESSINGS...
                        </p>
                    ) : records.length === 0 ? (
                        <div className="empty-state">
                            NO RECORDS MATCH THIS VIEW. CLICK "+ ADD PRESSING" TO CATALOGUE ONE.
                        </div>
                    ) : viewMode === 'grid' ? (
                        /* Tactile Cover Grid View */
                        <div className="records-grid">
                            {records.map((record, idx) => (
                                <article key={record.id} className="grid-card" style={{ '--stagger': idx }}>
                                    <div className="sleeve-stage" onClick={() => openEditDrawer(record)}>
                                        <div className="vinyl-peek-disc" />
                                        <div className="sleeve-artwork-wrap">
                                            <div className="sleeve-top-badges">
                                                <span className="badge badge-format">{record.format}</span>
                                                <span
                                                    className={`badge ${record.status === 'Owned' ? 'badge-owned' : 'badge-wantlist'
                                                        }`}
                                                >
                                                    {record.status}
                                                </span>
                                            </div>
                                            <AlbumCover
                                                src={record.coverImageUrl}
                                                alt={`${record.title} cover`}
                                                size={0}
                                            />
                                        </div>
                                    </div>

                                    <h3 className="grid-card-title" onClick={() => openEditDrawer(record)}>
                                        {record.title}
                                    </h3>
                                    <p className="grid-card-artist">
                                        {record.artistName}
                                        {record.releaseYear ? ` · ${record.releaseYear}` : ''}
                                    </p>

                                    {record.status === 'Wantlist' && (
                                        <div className="grid-card-footer">
                                            <button className="btn-acquire" onClick={() => startAcquire(record)}>
                                                Mark Owned
                                            </button>
                                        </div>
                                    )}

                                    {acquiringId === record.id && (
                                        <div className="acquire-box">
                                            <input
                                                placeholder="Pressing acquired..."
                                                value={acquireForm.pressing}
                                                onChange={(e) =>
                                                    setAcquireForm({ ...acquireForm, pressing: e.target.value })
                                                }
                                            />
                                            <button
                                                className="btn-acquire"
                                                onClick={() => handleConfirmAcquire(record.id)}
                                            >
                                                Confirm
                                            </button>
                                            <button className="btn-secondary" onClick={() => setAcquiringId(null)}>
                                                Cancel
                                            </button>
                                        </div>
                                    )}
                                </article>
                            ))}
                        </div>
                    ) : (
                        /* Compact Crate List View */
                        <div className="records-list">
                            {records.map((record, idx) => (
                                <article key={record.id} className="record-card" style={{ '--stagger': idx }}>
                                    <AlbumCover src={record.coverImageUrl} alt={`${record.title} cover`} size={64} />

                                    <div className="record-main">
                                        <div className="record-title-row">
                                            <h3 className="record-title">{record.title}</h3>
                                            <span className="badge badge-format">{record.format}</span>
                                            <span
                                                className={`badge ${record.status === 'Owned' ? 'badge-owned' : 'badge-wantlist'
                                                    }`}
                                            >
                                                {record.status}
                                            </span>
                                        </div>
                                        <p className="record-artist">
                                            {record.artistName}
                                            {record.releaseYear ? ` (${record.releaseYear})` : ''}
                                        </p>
                                        {record.pressing && (
                                            <p className="record-meta">PRESSING: {record.pressing}</p>
                                        )}
                                        {record.notes && <p className="record-notes">"{record.notes}"</p>}
                                    </div>

                                    <div className="record-actions">
                                        {record.status === 'Wantlist' && (
                                            <button className="btn-acquire" onClick={() => startAcquire(record)}>
                                                Mark Owned
                                            </button>
                                        )}
                                        <button className="btn-secondary" onClick={() => openEditDrawer(record)}>
                                            Inspect
                                        </button>
                                    </div>

                                    {acquiringId === record.id && (
                                        <div className="acquire-box">
                                            <input
                                                placeholder="Pressing acquired (e.g. 180g Reissue)"
                                                value={acquireForm.pressing}
                                                onChange={(e) =>
                                                    setAcquireForm({ ...acquireForm, pressing: e.target.value })
                                                }
                                            />
                                            <input
                                                placeholder="Notes (optional)"
                                                value={acquireForm.notes}
                                                onChange={(e) =>
                                                    setAcquireForm({ ...acquireForm, notes: e.target.value })
                                                }
                                            />
                                            <button
                                                className="btn-acquire"
                                                onClick={() => handleConfirmAcquire(record.id)}
                                            >
                                                Confirm
                                            </button>
                                            <button className="btn-secondary" onClick={() => setAcquiringId(null)}>
                                                Cancel
                                            </button>
                                        </div>
                                    )}
                                </article>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Slide-Over Pressing Entry / Inspection Drawer */}
            {showDrawer && (
                <div
                    className="drawer-backdrop"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            setShowDrawer(false);
                            setEditingId(null);
                        }
                    }}
                >
                    <aside className="drawer-panel" aria-label="Record pressing drawer">
                        <div className="drawer-header">
                            <span>{editingId ? 'INSPECT PRESSING' : 'PRESSING ENTRY'}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <span>NO. {pressingNumber}</span>
                                <button
                                    type="button"
                                    className="mono-link-btn"
                                    onClick={() => {
                                        setShowDrawer(false);
                                        setEditingId(null);
                                    }}
                                >
                                    [ESC]
                                </button>
                            </div>
                        </div>

                        <form
                            id="pressing-form"
                            className="drawer-body"
                            onSubmit={handleFormSubmit}
                        >
                            {/* Live Spinning Turntable Preview */}
                            <div className="platter-stage">
                                <div className="turntable-disc">
                                    <div className="turntable-label">
                                        {formData.coverImageUrl && (
                                            <img
                                                src={formData.coverImageUrl}
                                                alt=""
                                                referrerPolicy="no-referrer"
                                            />
                                        )}
                                        <div className="turntable-spindle" />
                                    </div>
                                </div>
                                <div className="platter-readout">
                                    <div className="platter-kicker">
                                        {formData.format} · {formData.status.toUpperCase()}
                                    </div>
                                    <div className="platter-title">
                                        {formData.title || 'Untitled Pressing'}
                                    </div>
                                    <div className="platter-sub">
                                        {formData.artistName || 'Select or enter artist'}
                                        {formData.releaseYear ? ` (${formData.releaseYear})` : ''}
                                    </div>
                                </div>
                            </div>

                            {!editingId && (
                                <div className="pressing-field">
                                    <label className="pressing-label">
                                        <span className="idx">00</span>Auto-Fill from Catalog / Discogs
                                    </label>
                                    <div className="catalog-search-row">
                                        <input
                                            type="search"
                                            className="underline-input"
                                            placeholder="Type artist or album (e.g. Brian Eno)..."
                                            value={catalogQuery}
                                            onChange={(e) => setCatalogQuery(e.target.value)}
                                        />
                                        <button
                                            type="button"
                                            className="btn-secondary"
                                            onClick={handleExternalDiscogsSearch}
                                            disabled={searchingCatalog || !catalogQuery.trim()}
                                        >
                                            {searchingCatalog ? '...' : 'Discogs'}
                                        </button>
                                    </div>

                                    {visibleCatalogResults.length > 0 && (
                                        <div className="catalog-results">
                                            {visibleCatalogResults.map((item, idx) => (
                                                <button
                                                    type="button"
                                                    key={`${item.source}-${item.catalogAlbumId ?? item.discogsMasterId ?? idx}`}
                                                    className="catalog-result-item"
                                                    onClick={() => applyCatalogMatch(item)}
                                                >
                                                    <div className="catalog-result-left">
                                                        <AlbumCover src={item.defaultCoverUrl} alt={item.title} size={40} />
                                                        <div>
                                                            <strong>{item.title}</strong>
                                                            <div className="subtitle">
                                                                {item.artistName}
                                                                {item.releaseYear ? ` (${item.releaseYear})` : ''}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <span className={`source-pill ${item.source === 'Catalog' ? 'catalog' : ''}`}>
                                                        {item.source === 'Catalog' ? 'Catalog' : 'Discogs'}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="pressing-field">
                                <label className="pressing-label">
                                    <span className="idx">A1</span>Artist *
                                </label>
                                <input
                                    required
                                    className="underline-input"
                                    placeholder="e.g. Brian Eno"
                                    value={formData.artistName}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            catalogAlbumId: null,
                                            discogsMasterId: null,
                                            artistName: e.target.value
                                        })
                                    }
                                />
                            </div>

                            <div className="pressing-field">
                                <label className="pressing-label">
                                    <span className="idx">A2</span>Album Title *
                                </label>
                                <input
                                    required
                                    className="underline-input"
                                    placeholder="e.g. Ambient 1: Music for Airports"
                                    value={formData.title}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            catalogAlbumId: null,
                                            discogsMasterId: null,
                                            title: e.target.value
                                        })
                                    }
                                />
                            </div>

                            <div className="pressing-field">
                                <label className="pressing-label">
                                    <span className="idx">A3</span>Format
                                </label>
                                <div className="pill-selector-row">
                                    {FORMAT_OPTIONS.map((fmt) => (
                                        <button
                                            key={fmt}
                                            type="button"
                                            className={`pill-choice ${formData.format === fmt ? 'selected' : ''}`}
                                            onClick={() => setFormData({ ...formData, format: fmt })}
                                        >
                                            {fmt}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="pressing-field">
                                <label className="pressing-label">
                                    <span className="idx">A4</span>Shelf Status
                                </label>
                                <div className="pill-selector-row">
                                    {['Owned', 'Wantlist'].map((st) => (
                                        <button
                                            key={st}
                                            type="button"
                                            className={`pill-choice ${formData.status === st ? 'selected' : ''}`}
                                            onClick={() => setFormData({ ...formData, status: st })}
                                        >
                                            {st === 'Owned' ? 'Owned' : 'Want List'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '1rem' }}>
                                <div className="pressing-field">
                                    <label className="pressing-label">
                                        <span className="idx">A5</span>Year
                                    </label>
                                    <input
                                        type="number"
                                        min="1900"
                                        max="2100"
                                        className="underline-input"
                                        placeholder="1978"
                                        value={formData.releaseYear}
                                        onChange={(e) => setFormData({ ...formData, releaseYear: e.target.value })}
                                    />
                                </div>

                                <div className="pressing-field">
                                    <label className="pressing-label">
                                        <span className="idx">A6</span>Pressing Details
                                    </label>
                                    <input
                                        className="underline-input"
                                        placeholder="UK First Press, 180g Black"
                                        value={formData.pressing}
                                        onChange={(e) => setFormData({ ...formData, pressing: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="pressing-field">
                                <label className="pressing-label">
                                    <span className="idx">A7</span>Cover Sleeve URL
                                </label>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <input
                                        type="url"
                                        className="underline-input"
                                        placeholder="https://..."
                                        value={formData.coverImageUrl}
                                        onChange={(e) => setFormData({ ...formData, coverImageUrl: e.target.value })}
                                    />
                                    {formData.defaultCoverUrl &&
                                        formData.coverImageUrl !== formData.defaultCoverUrl && (
                                            <button
                                                type="button"
                                                className="btn-secondary"
                                                onClick={() =>
                                                    setFormData({ ...formData, coverImageUrl: formData.defaultCoverUrl })
                                                }
                                            >
                                                Reset
                                            </button>
                                        )}
                                </div>
                            </div>

                            <div className="pressing-field">
                                <label className="pressing-label">
                                    <span className="idx">A8</span>Liner Notes
                                </label>
                                <input
                                    className="underline-input"
                                    placeholder="Matrix runout, sleeve grading, or pressing notes..."
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                />
                            </div>
                        </form>

                        <div className="drawer-footer">
                            {editingId ? (
                                <button
                                    type="button"
                                    className="btn-danger"
                                    onClick={() => handleDelete(editingId, formData.title)}
                                >
                                    Delete
                                </button>
                            ) : (
                                <span />
                            )}

                            <div style={{ display: 'flex', gap: '0.65rem' }}>
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => {
                                        setShowDrawer(false);
                                        setEditingId(null);
                                    }}
                                >
                                    Cancel
                                </button>
                                <button type="submit" form="pressing-form" className="btn-cream-pill">
                                    {editingId ? 'Save Changes ↗' : 'Press & Save ↗'}
                                </button>
                            </div>
                        </div>
                    </aside>
                </div>
            )}

            {/* Slide-Over Discogs OAuth Sync Drawer */}
            {showDiscogsDrawer && (
                <DiscogsImportDrawer
                    onClose={() => setShowDiscogsDrawer(false)}
                    onImported={() => setRefreshKey((k) => k + 1)}
                />
            )}
        </div>
    );
}