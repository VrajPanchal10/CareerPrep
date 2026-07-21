import api from "../../../utils/apiClient";

/**
 * Fetches the GitHub connection status for the current user.
 * @returns {Promise<{ connected: boolean, githubUsername?: string, githubAvatarUrl?: string, scopes?: string[], connectedAt?: string, rateLimitStatus?: object }>}
 */
export const getGithubStatus = async () => {
    const response = await api.get("/api/github-oauth/status");
    return response.data;
};

/**
 * Initiates the GitHub OAuth flow by redirecting the browser to the backend connect endpoint.
 * The backend redirects to GitHub, which then redirects back to /api/github-oauth/callback.
 */
export const initiateGithubConnect = () => {
    // Full page redirect — the backend handles GitHub OAuth redirect
    window.location.href = `${import.meta.env.VITE_API_URL || ""}/api/github-oauth/connect`;
};

/**
 * Disconnects the GitHub account and revokes the token.
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export const disconnectGithub = async () => {
    const response = await api.delete("/api/github-oauth/disconnect");
    return response.data;
};

/**
 * Lists repositories for the connected GitHub user.
 * @param {{ page?: number, perPage?: number, sort?: string, search?: string, visibility?: string }} opts
 * @returns {Promise<{ success: boolean, repositories: object[], total: number }>}
 */
export const listGithubRepositories = async ({ page = 1, perPage = 30, sort = "updated", search = "", visibility = "all" } = {}) => {
    const params = new URLSearchParams({ page, perPage, sort, search, visibility });
    const response = await api.get(`/api/github-oauth/repositories?${params}`);
    return response.data;
};

/**
 * Fetches the current GitHub API rate limit status.
 * @returns {Promise<{ success: boolean, rateLimit: { limit: number, remaining: number, resetAt: string } }>}
 */
export const getGithubRateLimit = async () => {
    const response = await api.get("/api/github-oauth/rate-limit");
    return response.data;
};
