import { useState, useCallback, useEffect, useRef } from "react";
import {
    getGithubStatus,
    initiateGithubConnect,
    disconnectGithub,
    listGithubRepositories,
    getGithubRateLimit
} from "../services/githubOAuth.api";

const RATE_LIMIT_POLL_MS = 60 * 1000; // Poll rate limit every 60 seconds

/**
 * Hook managing GitHub OAuth connection state, repository listing, and rate limit tracking.
 */
export const useGithubOAuth = () => {
    const [isConnected, setIsConnected] = useState(false);
    const [githubUser, setGithubUser] = useState(null);   // { githubUsername, githubAvatarUrl, scopes, connectedAt }
    const [repositories, setRepositories] = useState([]);
    const [reposLoading, setReposLoading] = useState(false);
    const [repoTotal, setRepoTotal] = useState(0);
    const [rateLimitStatus, setRateLimitStatus] = useState(null);
    const [statusLoading, setStatusLoading] = useState(true);
    const [disconnecting, setDisconnecting] = useState(false);
    const [error, setError] = useState(null);

    const rateLimitIntervalRef = useRef(null);

    // -----------------------------------------------------------------------
    // Check OAuth status on mount and after URL param ?connected=true
    // -----------------------------------------------------------------------
    const refreshStatus = useCallback(async () => {
        setStatusLoading(true);
        setError(null);
        try {
            const data = await getGithubStatus();
            setIsConnected(data.connected);
            if (data.connected) {
                setGithubUser({
                    username: data.githubUsername,
                    avatarUrl: data.githubAvatarUrl,
                    scopes: data.scopes || [],
                    connectedAt: data.connectedAt
                });
                if (data.rateLimitStatus) setRateLimitStatus(data.rateLimitStatus);
            } else {
                setGithubUser(null);
                setRateLimitStatus(null);
            }
        } catch (err) {
            // Non-fatal — user may simply not be connected
            setIsConnected(false);
            setGithubUser(null);
        } finally {
            setStatusLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshStatus();

        // Check for ?connected=true in URL after OAuth redirect
        const params = new URLSearchParams(window.location.search);
        if (params.get("connected") === "true") {
            // Clean up URL without page reload
            window.history.replaceState({}, "", window.location.pathname);
        }
        if (params.get("error")) {
            const errorMessages = {
                access_denied: "GitHub authorization was denied.",
                invalid_state: "Security validation failed. Please try again.",
                token_exchange_failed: "Failed to connect GitHub account. Please try again.",
                session_expired: "Your session expired. Please log in and try again.",
                oauth_init_failed: "Could not start GitHub authorization. Please try again."
            };
            setError(errorMessages[params.get("error")] || "GitHub connection failed.");
            window.history.replaceState({}, "", window.location.pathname);
        }
    }, [refreshStatus]);

    // -----------------------------------------------------------------------
    // Rate limit polling when connected
    // -----------------------------------------------------------------------
    useEffect(() => {
        if (!isConnected) {
            if (rateLimitIntervalRef.current) {
                clearInterval(rateLimitIntervalRef.current);
                rateLimitIntervalRef.current = null;
            }
            return;
        }

        const poll = async () => {
            try {
                const data = await getGithubRateLimit();
                if (data.rateLimit) setRateLimitStatus(data.rateLimit);
            } catch (_) {
                // Silent — rate limit polling is non-critical
            }
        };

        rateLimitIntervalRef.current = setInterval(poll, RATE_LIMIT_POLL_MS);
        return () => clearInterval(rateLimitIntervalRef.current);
    }, [isConnected]);

    // -----------------------------------------------------------------------
    // Actions
    // -----------------------------------------------------------------------

    const connect = useCallback(() => {
        setError(null);
        initiateGithubConnect(); // Full-page redirect
    }, []);

    const disconnect = useCallback(async () => {
        setDisconnecting(true);
        setError(null);
        try {
            await disconnectGithub();
            setIsConnected(false);
            setGithubUser(null);
            setRepositories([]);
            setRateLimitStatus(null);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to disconnect GitHub account.");
        } finally {
            setDisconnecting(false);
        }
    }, []);

    const fetchRepositories = useCallback(async (opts = {}) => {
        if (!isConnected) return;
        setReposLoading(true);
        setError(null);
        try {
            const data = await listGithubRepositories(opts);
            setRepositories(data.repositories || []);
            setRepoTotal(data.total || 0);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to load repositories.");
        } finally {
            setReposLoading(false);
        }
    }, [isConnected]);

    return {
        // State
        isConnected,
        githubUser,
        repositories,
        reposLoading,
        repoTotal,
        rateLimitStatus,
        statusLoading,
        disconnecting,
        error,
        // Actions
        connect,
        disconnect,
        fetchRepositories,
        refreshStatus
    };
};
