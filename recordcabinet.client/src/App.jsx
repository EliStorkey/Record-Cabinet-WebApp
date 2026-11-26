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
            style={{ width: size, height: size }}
            aria-label="Default vinyl sleeve"
        >
            <svg
                width={size * 0.55}
                height={size * 0.55}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
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
                <h1>Record Cabinet</h1>
                <p className="subtitle">
                    {mode === 'login'
                        ? 'Sign in to access your vinyl archive'
                        : 'Create an account to start your shelf'}
                </p>

                {error && (
                    <div className="error-banner" style={{ marginTop: '1rem' }}>
                        {error}
                    </div>
                )}

                <form className="auth-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>{mode === 'login' ? 'Username or Email' : 'Username *'}</label>
                        <input
                            required
                            autoComplete="username"
                            placeholder={mode === 'login' ? 'eli or eli@example.com' : 'e.g. elistorkey'}
                            value={userName}
                            onChange={(e) => setUserName(e.target.value)}
                        />
                    </div>

                    {mode === 'register' && (
                        <>
                            <div className="form-group">
                                <label>Display Name</label>
                                <input
                                    placeholder="e.g. Eli"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label>Email *</label>
                                <input
                                    required
                                    type="email"
                                    autoComplete="email"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                        </>
                    )}

                    <div className="form-group">
                        <label>Password *</label>
                        <input
                            required
                            type="password"
                            minLength={8}
                            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                            placeholder="At least 8 characters (with a number)"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    <button type="submit" className="btn-primary" disabled={submitting}>
                        {submitting
                            ? 'Please wait...'
                            : mode === 'login'
                                ? 'Sign In'
                                : 'Create Account'}
                    </button>
                </form>

                <p className="auth-switch">
                    {mode === 'login' ? (
                        <>
                            New to Record Cabinet?{' '}
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
                            Already have an account?{' '}
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

export default function App() {
    const [currentUser, setCurrentUser] = useState(null);
    const [authChecked, setAuthChecked] = useState(false);

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

    const [showForm, setShowForm] = useState(false);
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

    // 2. Fetch signed-in user's records and stats
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

    // 3. Debounced local-first catalog search when typing in Add form
    useEffect(() => {
        if (!showForm || editingId) return;

        const trimmed = catalogQuery.trim();
        let ignore = false;

        const timer = setTimeout(() => {
            if (!trimmed) {
                setCatalogResults([]);
                return;
            }

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
    }, [catalogQuery, showForm, editingId]);

    async function handleLogout() {
        await logoutUser();
        setCurrentUser(null);
        setRecords([]);
        setStats({ totalOwned: 0, totalWantlist: 0, totalArtists: 0, byFormat: {} });
        setShowForm(false);
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

    function openAddForm() {
        setEditingId(null);
        setCatalogQuery('');
        setCatalogResults([]);
        setFormData({
            ...EMPTY_FORM,
            status: activeTab === 'Wantlist' ? 'Wantlist' : 'Owned'
        });
        setShowForm(true);
    }

    function openEditForm(record) {
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
        setShowForm(true);
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

            setShowForm(false);
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
            setRefreshKey((k) => k + 1);
        } catch (err) {
            setError(err.message || 'Could not delete record.');
        }
    }

    if (!authChecked) {
        return (
            <div className="auth-shell">
                <p className="subtitle">Checking session...</p>
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

    return (
        <div className="app-container">
            <header className="app-header">
                <div>
                    <h1>Record Cabinet</h1>
                    <p className="subtitle">Personal vinyl archive &amp; want list</p>
                </div>
                <div className="header-actions">
                    <span className="user-chip">@{currentUser.userName}</span>
                    <button className="btn-primary" onClick={openAddForm}>
                        + Add Record
                    </button>
                    <button className="btn-secondary" onClick={handleLogout}>
                        Sign Out
                    </button>
                </div>
            </header>

            <section className="stats-grid">
                <div className="stat-card">
                    <span className="stat-label">Owned Records</span>
                    <span className="stat-value">{stats.totalOwned}</span>
                </div>
                <div className="stat-card">
                    <span className="stat-label">Want List</span>
                    <span className="stat-value">{stats.totalWantlist}</span>
                </div>
                <div className="stat-card">
                    <span className="stat-label">Artists Collected</span>
                    <span className="stat-value">{stats.totalArtists}</span>
                </div>
                <div className="stat-card">
                    <span className="stat-label">By Format</span>
                    <div className="stat-formats">
                        {Object.keys(stats.byFormat).length === 0 ? (
                            <span className="format-pill">None yet</span>
                        ) : (
                            Object.entries(stats.byFormat).map(([fmt, count]) => (
                                <span key={fmt} className="format-pill">
                                    {fmt}: {count}
                                </span>
                            ))
                        )}
                    </div>
                </div>
            </section>

            {error && <div className="error-banner">{error}</div>}

            {showForm && (
                <form className="form-panel" onSubmit={handleFormSubmit}>
                    <h2>{editingId ? 'Edit Record' : 'Add to Cabinet'}</h2>

                    {!editingId && (
                        <div className="catalog-search-box">
                            <div className="catalog-search-row">
                                <input
                                    type="search"
                                    placeholder="Search existing catalog or Discogs (e.g. Brian Eno)..."
                                    value={catalogQuery}
                                    onChange={(e) => setCatalogQuery(e.target.value)}
                                />
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={handleExternalDiscogsSearch}
                                    disabled={searchingCatalog || !catalogQuery.trim()}
                                >
                                    {searchingCatalog ? 'Searching...' : 'Search Discogs'}
                                </button>
                            </div>

                            {catalogResults.length > 0 && (
                                <div className="catalog-results">
                                    {catalogResults.map((item, idx) => (
                                        <button
                                            type="button"
                                            key={`${item.source}-${item.catalogAlbumId ?? item.discogsMasterId ?? idx}`}
                                            className="catalog-result-item"
                                            onClick={() => applyCatalogMatch(item)}
                                        >
                                            <div className="catalog-result-left">
                                                <AlbumCover src={item.defaultCoverUrl} alt={item.title} size={44} />
                                                <div>
                                                    <strong>{item.title}</strong>
                                                    <div className="subtitle">
                                                        {item.artistName}
                                                        {item.releaseYear ? ` (${item.releaseYear})` : ''}
                                                    </div>
                                                </div>
                                            </div>
                                            <span className={`source-pill ${item.source === 'Catalog' ? 'catalog' : ''}`}>
                                                {item.source === 'Catalog' ? 'In Catalog' : 'Discogs'}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="form-grid">
                        <div className="form-group">
                            <label>Artist *</label>
                            <input
                                required
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

                        <div className="form-group">
                            <label>Album Title *</label>
                            <input
                                required
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

                        <div className="form-group">
                            <label>Release Year</label>
                            <input
                                type="number"
                                min="1900"
                                max="2100"
                                placeholder="e.g. 1978"
                                value={formData.releaseYear}
                                onChange={(e) => setFormData({ ...formData, releaseYear: e.target.value })}
                            />
                        </div>

                        <div className="form-group">
                            <label>Format</label>
                            <select
                                value={formData.format}
                                onChange={(e) => setFormData({ ...formData, format: e.target.value })}
                            >
                                {FORMAT_OPTIONS.map((fmt) => (
                                    <option key={fmt} value={fmt}>
                                        {fmt}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Pressing Details</label>
                            <input
                                placeholder="e.g. UK First Press, 180g Black"
                                value={formData.pressing}
                                onChange={(e) => setFormData({ ...formData, pressing: e.target.value })}
                            />
                        </div>

                        <div className="form-group">
                            <label>Status</label>
                            <select
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                            >
                                <option value="Owned">Owned</option>
                                <option value="Wantlist">Wantlist</option>
                            </select>
                        </div>

                        <div className="form-group full-width">
                            <label>Cover Image URL (leave blank for default vinyl sleeve)</label>
                            <div className="cover-preview-row">
                                <AlbumCover src={formData.coverImageUrl} alt="Cover preview" size={64} />
                                <input
                                    type="url"
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
                                            Reset Default
                                        </button>
                                    )}
                            </div>
                        </div>

                        <div className="form-group full-width">
                            <label>Notes</label>
                            <textarea
                                rows="2"
                                placeholder="Sleeve details, matrix runout, or pressing preferences..."
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="form-actions">
                        <button type="submit" className="btn-primary">
                            {editingId ? 'Save Changes' : 'Save Record'}
                        </button>
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => {
                                setShowForm(false);
                                setEditingId(null);
                            }}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            )}

            <div className="controls-bar">
                <div className="tabs">
                    {[
                        { id: 'Owned', label: 'My Collection' },
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
                        placeholder="Search artist, title, or pressing..."
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
                </div>
            </div>

            {loading ? (
                <p className="subtitle">Loading records...</p>
            ) : records.length === 0 ? (
                <div className="empty-state">
                    No records match the current view. Add one above to get started.
                </div>
            ) : (
                <div className="records-list">
                    {records.map((record) => (
                        <article key={record.id} className="record-card">
                            <AlbumCover src={record.coverImageUrl} alt={`${record.title} cover`} size={76} />

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
                                    <p className="record-meta">Pressing: {record.pressing}</p>
                                )}
                                {record.notes && <p className="record-notes">"{record.notes}"</p>}
                            </div>

                            <div className="record-actions">
                                {record.status === 'Wantlist' && (
                                    <button className="btn-acquire" onClick={() => startAcquire(record)}>
                                        Mark Owned
                                    </button>
                                )}
                                <button className="btn-secondary" onClick={() => openEditForm(record)}>
                                    Edit
                                </button>
                                <button
                                    className="btn-danger"
                                    onClick={() => handleDelete(record.id, record.title)}
                                >
                                    Delete
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
        </div>
    );
}