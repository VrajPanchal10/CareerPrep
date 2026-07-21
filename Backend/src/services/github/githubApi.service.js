/**
 * @module githubApi.service
 * @description Authenticated GitHub REST API wrapper.
 *
 * All methods:
 *  - Accept a decrypted access token (never expose it further)
 *  - Emit structured GitHubApiError instances for downstream handling
 *  - Pass rate-limit headers to githubRateLimit.service after each call
 */

const rateLimitService = require("./githubRateLimit.service");

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

const GITHUB_ERROR_CODES = {
    RATE_LIMITED: "GITHUB_RATE_LIMITED",
    NOT_FOUND: "GITHUB_NOT_FOUND",
    FORBIDDEN: "GITHUB_FORBIDDEN",
    UNAUTHORIZED: "GITHUB_UNAUTHORIZED",
    NETWORK_ERROR: "GITHUB_NETWORK_ERROR",
    UNKNOWN: "GITHUB_UNKNOWN_ERROR"
};

class GitHubApiError extends Error {
    constructor(code, message, httpStatus) {
        super(message);
        this.name = "GitHubApiError";
        this.code = code;
        this.httpStatus = httpStatus || 500;
    }
}

// ---------------------------------------------------------------------------
// Internal fetch helper
// ---------------------------------------------------------------------------

const GITHUB_API_BASE = "https://api.github.com";
const USER_AGENT = "CareerPrep-Platform";

/**
 * Wraps every GitHub API call with:
 *  - Auth header injection
 *  - Rate-limit header tracking
 *  - Structured error mapping
 *
 * @param {string} url
 * @param {string|null} token - plaintext (decrypted) access token
 * @param {RequestInit} [options]
 * @param {string} [acceptHeader]
 * @returns {Promise<Response>}
 */
async function githubFetch(url, token, options = {}, acceptHeader = "application/vnd.github+json") {
    const headers = {
        "User-Agent": USER_AGENT,
        "Accept": acceptHeader,
        ...(options.headers || {})
    };
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    // Authorization Header Verification
    if (token && headers["Authorization"] !== `Bearer ${token}`) {
        throw new GitHubApiError(
            GITHUB_ERROR_CODES.UNAUTHORIZED,
            "Authorization header verification failed. Bearer token is invalid or missing.",
            401
        );
    }

    let response;
    try {
        response = await fetch(url, { ...options, headers });
    } catch (networkErr) {
        throw new GitHubApiError(
            GITHUB_ERROR_CODES.NETWORK_ERROR,
            `GitHub API network error: ${networkErr.message}`,
            503
        );
    }

    // Forward rate-limit headers to the rate-limit service
    rateLimitService.updateFromHeaders(token, response.headers);

    // Map HTTP errors to structured codes
    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const msg = body.message || response.statusText;

        if (response.status === 401) {
            throw new GitHubApiError(GITHUB_ERROR_CODES.UNAUTHORIZED, "GitHub token is invalid or expired. Please reconnect.", 401);
        }
        if (response.status === 403) {
            if (response.headers.get("x-ratelimit-remaining") === "0") {
                const resetTime = response.headers.get("x-ratelimit-reset");
                const resetDate = resetTime ? new Date(parseInt(resetTime, 10) * 1000) : null;
                const limit = response.headers.get("x-ratelimit-limit");
                const message = resetDate 
                    ? `GitHub API rate limit exceeded (limit: ${limit || "unknown"}). Retry is possible after ${resetDate.toLocaleTimeString()}. Please connect your GitHub account in Settings to raise limits.`
                    : "GitHub API rate limit exceeded. Please connect your GitHub account in Settings to raise limits.";
                throw new GitHubApiError(GITHUB_ERROR_CODES.RATE_LIMITED, message, 429);
            }
            throw new GitHubApiError(GITHUB_ERROR_CODES.FORBIDDEN, `Access forbidden: ${msg}`, 403);
        }
        if (response.status === 429) {
            const resetTime = response.headers.get("x-ratelimit-reset");
            const resetDate = resetTime ? new Date(parseInt(resetTime, 10) * 1000) : null;
            const limit = response.headers.get("x-ratelimit-limit");
            const message = resetDate 
                ? `GitHub API rate limit exceeded (limit: ${limit || "unknown"}). Retry is possible after ${resetDate.toLocaleTimeString()}. Please connect your GitHub account in Settings to raise limits.`
                : "GitHub API rate limit exceeded. Please connect your GitHub account in Settings to raise limits.";
            throw new GitHubApiError(GITHUB_ERROR_CODES.RATE_LIMITED, message, 429);
        }
        if (response.status === 404) {
            throw new GitHubApiError(GITHUB_ERROR_CODES.NOT_FOUND, `Repository or resource not found: ${msg}`, 404);
        }
        throw new GitHubApiError(GITHUB_ERROR_CODES.UNKNOWN, `GitHub API error ${response.status}: ${msg}`, response.status);
    }

    return response;
}

// ---------------------------------------------------------------------------
// Public API methods
// ---------------------------------------------------------------------------

/**
 * Fetches the authenticated GitHub user profile.
 * @param {string} token
 * @returns {Promise<object>} GitHub /user response
 */
async function getAuthenticatedUser(token) {
    const res = await githubFetch(`${GITHUB_API_BASE}/user`, token);
    return res.json();
}

/**
 * Lists repositories for the authenticated user.
 * @param {string} token
 * @param {{ page?: number, perPage?: number, sort?: string, type?: string }} opts
 * @returns {Promise<object[]>}
 */
async function listUserRepositories(token, { page = 1, perPage = 30, sort = "updated", type = "all" } = {}) {
    const params = new URLSearchParams({ page, per_page: perPage, sort, type });
    const res = await githubFetch(`${GITHUB_API_BASE}/user/repos?${params}`, token);
    return res.json();
}

/**
 * Lists repositories for a specific GitHub organization.
 * @param {string} token
 * @param {string} org
 * @param {{ page?: number, perPage?: number }} opts
 * @returns {Promise<object[]>}
 */
async function listOrgRepositories(token, org, { page = 1, perPage = 30 } = {}) {
    const params = new URLSearchParams({ page, per_page: perPage });
    const res = await githubFetch(`${GITHUB_API_BASE}/orgs/${org}/repos?${params}`, token);
    return res.json();
}

/**
 * Fetches metadata for a specific repository.
 * @param {string} owner
 * @param {string} repo
 * @param {string|null} token
 * @returns {Promise<object>}
 */
async function getRepositoryMetadata(owner, repo, token) {
    const res = await githubFetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, token);
    return res.json();
}

/**
 * Fetches the recursive git tree for a repository branch.
 * @param {string} owner
 * @param {string} repo
 * @param {string} branch
 * @param {string|null} token
 * @returns {Promise<object[]>} array of tree nodes
 */
async function getRepositoryTree(owner, repo, branch, token) {
    const res = await githubFetch(
        `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
        token
    );
    const data = await res.json();
    return data.tree || [];
}

/**
 * Fetches the latest commit SHA on a branch.
 * @param {string} owner
 * @param {string} repo
 * @param {string} branch
 * @param {string|null} token
 * @returns {Promise<string>} commit SHA
 */
async function getLatestCommitSha(owner, repo, branch, token) {
    const res = await githubFetch(
        `${GITHUB_API_BASE}/repos/${owner}/${repo}/commits/${branch}`,
        token
    );
    const data = await res.json();
    return data.sha || null;
}

/**
 * Fetches the raw text content of a file in a repository.
 * @param {string} owner
 * @param {string} repo
 * @param {string} filePath
 * @param {string} branch
 * @param {string|null} token
 * @returns {Promise<string>} raw file text
 */
async function getFileContent(owner, repo, filePath, branch, token) {
    const encodedFilePath = filePath.split('/').map(encodeURIComponent).join('/');
    const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${encodedFilePath}?ref=${branch}`;
    const res = await githubFetch(url, token, {}, "application/vnd.github+json");
    const data = await res.json();
    
    if (data.encoding === "base64" && data.content) {
        return Buffer.from(data.content, "base64").toString("utf8");
    }
    
    return data.content || "";
}

/**
 * Returns the current GitHub API rate limit status for the token.
 * @param {string|null} token
 * @returns {Promise<object>}
 */
async function getRateLimit(token) {
    const res = await githubFetch(`${GITHUB_API_BASE}/rate_limit`, token);
    const data = await res.json();
    return data.rate || data.resources?.core || {};
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = {
    GitHubApiError,
    GITHUB_ERROR_CODES,
    getAuthenticatedUser,
    listUserRepositories,
    listOrgRepositories,
    getRepositoryMetadata,
    getRepositoryTree,
    getLatestCommitSha,
    getFileContent,
    getRateLimit
};
