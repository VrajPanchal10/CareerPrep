import React, { useEffect, useState, useCallback, useRef } from "react";
import "./githubComponents.scss";

const SORT_OPTIONS = [
    { value: "updated", label: "Recently Updated" },
    { value: "created", label: "Recently Created" },
    { value: "full_name", label: "Name (A–Z)" },
    { value: "pushed", label: "Last Pushed" }
];

const VISIBILITY_OPTIONS = [
    { value: "all", label: "All" },
    { value: "public", label: "Public" },
    { value: "private", label: "Private" }
];

/**
 * RepositoryPicker — displayed when GitHub is connected.
 * Renders a searchable, filterable, paginated list of repositories.
 *
 * Props:
 *   repositories   {object[]}  — list from useGithubOAuth
 *   loading        {boolean}
 *   total          {number}
 *   onFetch        {(opts) => void}  — triggers useGithubOAuth.fetchRepositories
 *   onAnalyze      {(repo) => void}  — called when user clicks Analyze
 *   analyzingRepo  {string|null}     — fullName of repo currently being analyzed
 */
const RepositoryPicker = ({ repositories, loading, total, onFetch, onAnalyze, analyzingRepo }) => {
    const [search, setSearch] = useState("");
    const [sort, setSort] = useState("updated");
    const [visibility, setVisibility] = useState("all");
    const [page, setPage] = useState(1);
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const listRef = useRef(null);
    const debounceRef = useRef(null);
    const PER_PAGE = 20;

    // Fetch on filter/page changes
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            onFetch({ page, perPage: PER_PAGE, sort, search, visibility });
        }, search ? 350 : 0);

        return () => clearTimeout(debounceRef.current);
    }, [search, sort, visibility, page]); // eslint-disable-line react-hooks/exhaustive-deps

    const formatSize = (kb) => {
        if (kb < 1024) return `${kb} KB`;
        return `${(kb / 1024).toFixed(1)} MB`;
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return "";
        const d = new Date(dateStr);
        return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    };

    const totalPages = Math.ceil(total / PER_PAGE);

    // Keyboard navigation through the repo list
    const handleKeyDown = useCallback((e) => {
        if (!repositories.length) return;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setFocusedIndex(i => Math.min(i + 1, repositories.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setFocusedIndex(i => Math.max(i - 1, 0));
        } else if (e.key === "Enter" && focusedIndex >= 0) {
            e.preventDefault();
            onAnalyze(repositories[focusedIndex]);
        }
    }, [repositories, focusedIndex, onAnalyze]);

    useEffect(() => {
        if (focusedIndex >= 0 && listRef.current) {
            const items = listRef.current.querySelectorAll(".repo-picker__item");
            items[focusedIndex]?.focus();
        }
    }, [focusedIndex]);

    const searchInputRef = useRef(null);

    // Global Ctrl+K keyboard shortcut listener
    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
        };
        window.addEventListener("keydown", handleGlobalKeyDown);
        return () => window.removeEventListener("keydown", handleGlobalKeyDown);
    }, []);

    return (
        <div className="repo-picker" role="region" aria-label="Repository Picker">
            {/* Search + Filters */}
            <div className="repo-picker__controls">
                <div className="repo-picker__search-wrap">
                    <span className="repo-picker__search-icon" aria-hidden="true">🔍</span>
                    <input
                        ref={searchInputRef}
                        type="search"
                        className="repo-picker__search"
                        placeholder="Search repositories…"
                        value={search}
                        onChange={e => { setSearch(e.target.value); setPage(1); }}
                        aria-label="Search repositories"
                        id="repoPickerSearch"
                    />
                    {search ? (
                        <button
                            type="button"
                            className="repo-picker__clear-btn"
                            onClick={() => { setSearch(""); setPage(1); }}
                            aria-label="Clear search"
                        >
                            ×
                        </button>
                    ) : (
                        <kbd className="repo-picker__shortcut-badge">Ctrl K</kbd>
                    )}
                </div>
                <div className="repo-picker__filters">
                    <select
                        className="repo-picker__select"
                        value={sort}
                        onChange={e => { setSort(e.target.value); setPage(1); }}
                        aria-label="Sort repositories by"
                        id="repoPickerSort"
                    >
                        {SORT_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                    </select>
                    <div className="repo-picker__visibility-btns" role="group" aria-label="Filter by visibility">
                        {VISIBILITY_OPTIONS.map(o => (
                            <button
                                key={o.value}
                                className={`repo-picker__vis-btn ${visibility === o.value ? "repo-picker__vis-btn--active" : ""}`}
                                onClick={() => { setVisibility(o.value); setPage(1); }}
                                aria-pressed={visibility === o.value}
                                id={`visFilter_${o.value}`}
                            >
                                {o.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Repository List */}
            <div
                className="repo-picker__list"
                ref={listRef}
                onKeyDown={handleKeyDown}
                role="listbox"
                aria-label="GitHub repositories"
                aria-busy={loading}
            >
                {loading ? (
                    <div className="repo-picker__loading" aria-live="polite">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="repo-picker__skeleton" aria-hidden="true">
                                <div className="skeleton-line skeleton-line--wide" />
                                <div className="skeleton-line skeleton-line--narrow" />
                            </div>
                        ))}
                    </div>
                ) : repositories.length === 0 ? (
                    <div className="repo-picker__empty" role="status">
                        {search ? `No repositories matching "${search}"` : "No repositories found."}
                    </div>
                ) : (
                    repositories.map((repo, idx) => {
                        const isAnalyzing = analyzingRepo === repo.fullName;
                        return (
                            <div
                                key={repo.id}
                                className={`repo-picker__item ${idx === focusedIndex ? "repo-picker__item--focused" : ""}`}
                                role="option"
                                aria-selected={false}
                                tabIndex={0}
                                onFocus={() => setFocusedIndex(idx)}
                                aria-label={`${repo.name} — ${repo.isPrivate ? "private" : "public"} repository`}
                            >
                                <div className="repo-picker__item-info">
                                    <div className="repo-picker__item-header">
                                        <span className="repo-picker__name">📁 {repo.name}</span>
                                        <span
                                            className={`repo-picker__badge ${repo.isPrivate ? "repo-picker__badge--private" : "repo-picker__badge--public"}`}
                                            aria-label={repo.isPrivate ? "Private repository" : "Public repository"}
                                        >
                                            {repo.isPrivate ? "🔒 Private" : "Public"}
                                        </span>
                                    </div>
                                    <div className="repo-picker__meta">
                                        {repo.language && (
                                            <span className="repo-picker__lang">
                                                <span className="lang-dot" aria-hidden="true" />
                                                {repo.language}
                                            </span>
                                        )}
                                        <span className="repo-picker__size" aria-label={`Size: ${formatSize(repo.sizeKb)}`}>
                                            • {formatSize(repo.sizeKb)}
                                        </span>
                                        <span className="repo-picker__updated" aria-label={`Updated ${formatDate(repo.updatedAt)}`}>
                                            • {formatDate(repo.updatedAt)}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    className={`repo-picker__analyze-btn ${isAnalyzing ? "repo-picker__analyze-btn--loading" : ""}`}
                                    onClick={() => onAnalyze(repo)}
                                    disabled={!!analyzingRepo}
                                    aria-label={`Analyze ${repo.name}`}
                                    id={`analyzeRepo_${repo.id}`}
                                >
                                    {isAnalyzing ? (
                                        <>
                                            <span className="spinner" aria-hidden="true" />
                                            Analyzing…
                                        </>
                                    ) : (
                                        "🔍 Analyze"
                                    )}
                                </button>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && !loading && (
                <div className="repo-picker__pagination" role="navigation" aria-label="Repository list pagination">
                    <button
                        className="repo-picker__page-btn"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        aria-label="Previous page"
                        id="repoPickerPrev"
                    >
                        ← Previous
                    </button>
                    <span className="repo-picker__page-info" aria-current="page">
                        Page {page} of {totalPages}
                    </span>
                    <button
                        className="repo-picker__page-btn"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        aria-label="Next page"
                        id="repoPickerNext"
                    >
                        Next →
                    </button>
                </div>
            )}
        </div>
    );
};

export default RepositoryPicker;
