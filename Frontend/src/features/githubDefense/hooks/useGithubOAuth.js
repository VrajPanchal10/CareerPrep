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
 * @param {{ addToast?: (msg: string, type: string) => void }} [options]
 */
export const useGithubOAuth = ({ addToast } = {}) => {
    const [isConnected, setIsConnected] = useState(false);
    const [githubUser, setGithubUser] = useState(null);   // { githubUsername, githubAvatarUrl, scopes, connectedAt }
    const [repositories, setRepositories] = useState([]);
    const [reposLoading, setReposLoading] = useState(false);
    const [repoTotal, setRepoTotal] = useState(0);
    const [rateLimitStatus, setRateLimitStatus] = useState(null);
    const [statusLoading, setStatusLoading] = useState(true);
    const [isConnecting, setIsConnecting] = useState(false);
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
            return data;
        } catch (err) {
            // Non-fatal — user may simply not be connected
            setIsConnected(false);
            setGithubUser(null);
            return null;
        } finally {
            setStatusLoading(false);
        }
    }, []);

    const hasProcessedUrlRef = useRef(false);

    useEffect(() => {
        if (hasProcessedUrlRef.current) return;

        // Check for ?connected=true or ?error=... in URL after OAuth redirect
        const params = new URLSearchParams(window.location.search);
        const isOAuthReturn = params.get("connected") === "true";
        const oauthErrorParam = params.get("error");

        if (isOAuthReturn) {
            hasProcessedUrlRef.current = true;
            // Clean up URL parameters immediately to prevent duplicate triggers
            window.history.replaceState({}, "", window.location.pathname);
            setIsConnecting(true);
            
            refreshStatus().then(() => {
                if (addToast) {
                    addToast("GitHub account connected successfully!", "success");
                }
                setIsConnecting(false);
            });
        } else if (oauthErrorParam) {
            hasProcessedUrlRef.current = true;
            window.history.replaceState({}, "", window.location.pathname);
            
            const errorMessages = {
                access_denied: "GitHub authorization was denied.",
                invalid_state: "Security validation failed. Please try again.",
                token_exchange_failed: "Failed to connect GitHub account. Please try again.",
                session_expired: "Your session expired. Please log in and try again.",
                oauth_init_failed: "Could not start GitHub authorization. Please try again."
            };
            const msg = errorMessages[oauthErrorParam] || "GitHub connection failed.";
            setError(msg);
            if (addToast) {
                addToast(`⚠️ ${msg}`, "error");
            }
            refreshStatus();
        } else {
            refreshStatus();
        }
    }, [refreshStatus, addToast]);

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
        isConnecting,
        disconnecting,
        error,
        // Actions
        connect,
        disconnect,
        fetchRepositories,
        refreshStatus
    };
};
