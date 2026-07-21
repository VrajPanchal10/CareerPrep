import React from "react";
import "./githubComponents.scss";

/**
 * GitHubConnectPanel — shown when no GitHub account is connected.
 * Displays a clear CTA to start the OAuth flow.
 */
const GitHubConnectPanel = ({ onConnect, loading, error }) => {
    return (
        <div className="gh-connect-panel" role="region" aria-label="GitHub Connection">
            <div className="gh-connect-panel__icon" aria-hidden="true">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
                </svg>
            </div>
            <h3 className="gh-connect-panel__title">Connect GitHub Account</h3>
            <p className="gh-connect-panel__desc">
                Link your GitHub account to analyze <strong>private and organization repositories</strong>.
                Public repositories can still be analyzed using the URL form below.
            </p>
            <ul className="gh-connect-panel__perms" aria-label="Permissions requested">
                <li>
                    <span className="perm-icon" aria-hidden="true">🔒</span>
                    <span>Access to private repositories</span>
                </li>
                <li>
                    <span className="perm-icon" aria-hidden="true">🏢</span>
                    <span>Organization repository access (when permitted)</span>
                </li>
                <li>
                    <span className="perm-icon" aria-hidden="true">👤</span>
                    <span>Read your username and profile info</span>
                </li>
            </ul>
            <p className="gh-connect-panel__note">
                No write access is requested. CareerPrep never modifies your repositories.
            </p>
            {error && (
                <div className="gh-connect-panel__error" role="alert">
                    ⚠️ {error}
                </div>
            )}
            <button
                className="gh-connect-btn"
                onClick={onConnect}
                disabled={loading}
                aria-label="Connect your GitHub account"
                id="githubConnectBtn"
            >
                {loading ? (
                    <span className="gh-connect-btn__spinner" aria-hidden="true" />
                ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
                    </svg>
                )}
                {loading ? "Redirecting..." : "Connect with GitHub"}
            </button>
        </div>
    );
};

export default GitHubConnectPanel;
