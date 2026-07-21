import React from "react";
import "./githubComponents.scss";

/**
 * GitHubStatusBar — persistent bar showing connected account details and rate limit.
 *
 * Props:
 *   githubUser        {{ username, avatarUrl, scopes, connectedAt }}
 *   rateLimitStatus   {{ remaining, limit, resetAt }} | null
 *   onDisconnect      () => void
 *   disconnecting     boolean
 */
const GitHubStatusBar = ({ githubUser, rateLimitStatus, onDisconnect, disconnecting }) => {
    if (!githubUser) return null;

    const remaining = rateLimitStatus?.remaining ?? "—";
    const limit = rateLimitStatus?.limit ?? "—";
    const resetAt = rateLimitStatus?.resetAt
        ? new Date(rateLimitStatus.resetAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : null;

    const rateLimitPercent = rateLimitStatus
        ? Math.round((rateLimitStatus.remaining / rateLimitStatus.limit) * 100)
        : 100;

    const rateLimitColor =
        rateLimitPercent < 20 ? "#e74c3c" :
        rateLimitPercent < 50 ? "#f39c12" :
        "#27ae60";

    return (
        <div className="gh-status-bar" role="status" aria-label="GitHub connection status">
            <div className="gh-status-bar__left">
                <img
                    src={githubUser.avatarUrl}
                    alt={`${githubUser.username}'s GitHub avatar`}
                    className="gh-status-bar__avatar"
                    width={32}
                    height={32}
                />
                <div className="gh-status-bar__user">
                    <span className="gh-status-bar__connected-label">
                        <span className="gh-status-bar__dot" aria-hidden="true" />
                        Connected as
                    </span>
                    <a
                        href={`https://github.com/${githubUser.username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="gh-status-bar__username"
                        aria-label={`GitHub profile of ${githubUser.username}`}
                    >
                        @{githubUser.username}
                    </a>
                </div>
            </div>

            {rateLimitStatus && (
                <div className="gh-status-bar__rate" aria-label={`GitHub API rate limit: ${remaining} of ${limit} remaining`}>
                    <span className="gh-status-bar__rate-label">API Quota</span>
                    <div className="gh-status-bar__rate-bar" role="progressbar"
                        aria-valuenow={rateLimitPercent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                    >
                        <div
                            className="gh-status-bar__rate-fill"
                            style={{ width: `${rateLimitPercent}%`, background: rateLimitColor }}
                        />
                    </div>
                    <span className="gh-status-bar__rate-text" style={{ color: rateLimitColor }}>
                        {remaining}/{limit}
                        {resetAt && <span className="gh-status-bar__reset"> resets {resetAt}</span>}
                    </span>
                </div>
            )}

            <div className="gh-status-bar__right">
                <span className="gh-status-bar__scopes" aria-label={`Granted scopes: ${githubUser.scopes?.join(", ")}`}>
                    {githubUser.scopes?.includes("repo") && (
                        <span className="scope-badge" title="Private repository access">repo</span>
                    )}
                    {githubUser.scopes?.includes("read:org") && (
                        <span className="scope-badge" title="Organization access">org</span>
                    )}
                </span>
                <button
                    className="gh-status-bar__disconnect-btn"
                    onClick={onDisconnect}
                    disabled={disconnecting}
                    aria-label="Disconnect GitHub account"
                    id="githubDisconnectBtn"
                >
                    {disconnecting ? "Disconnecting…" : "Disconnect"}
                </button>
            </div>
        </div>
    );
};

export default GitHubStatusBar;
