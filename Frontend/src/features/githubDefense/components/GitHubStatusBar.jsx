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
        <div className="git-card gh-account-card" role="region" aria-label="GitHub Account">
            <h3 className="sidebar-card-title">GitHub Account</h3>
            
            <div className="gh-account-card__top">
                <div className="gh-account-card__user">
                    <img
                        src={githubUser.avatarUrl}
                        alt={`${githubUser.username}'s GitHub avatar`}
                        className="gh-account-card__avatar"
                        width={36}
                        height={36}
                    />
                    <div className="gh-account-card__user-info">
                        <span className="gh-account-card__status">
                            <span className="gh-account-card__dot" aria-hidden="true" />
                            CONNECTED AS
                        </span>
                        <a
                            href={`https://github.com/${githubUser.username}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="gh-account-card__username"
                        >
                            @{githubUser.username}
                        </a>
                    </div>
                </div>

                <div className="gh-account-card__scopes">
                    {githubUser.scopes?.includes("repo") && (
                        <span className="scope-badge" title="Private repository access">repo</span>
                    )}
                    {githubUser.scopes?.includes("read:org") && (
                        <span className="scope-badge" title="Organization access">org</span>
                    )}
                </div>
            </div>

            {rateLimitStatus && (
                <div className="gh-account-card__rate">
                    <div className="gh-account-card__rate-header">
                        <span className="rate-label">API Quota</span>
                        <span className="rate-val" style={{ color: rateLimitColor }}>
                            {remaining} / {limit} {resetAt && <span className="rate-reset">resets {resetAt}</span>}
                        </span>
                    </div>
                    <div className="gh-account-card__rate-bar">
                        <div
                            className="gh-account-card__rate-fill"
                            style={{ width: `${rateLimitPercent}%`, background: rateLimitColor }}
                        />
                    </div>
                </div>
            )}

            <button
                className="gh-account-card__disconnect-btn"
                onClick={onDisconnect}
                disabled={disconnecting}
                id="githubDisconnectBtn"
            >
                {disconnecting ? "Disconnecting…" : "Disconnect"}
            </button>
        </div>
    );
};

export default GitHubStatusBar;
