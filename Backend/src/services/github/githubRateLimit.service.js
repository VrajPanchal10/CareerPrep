/**
 * @module githubRateLimit.service
 * @description Tracks GitHub API rate limit state from response headers.
 *
 * - Updated automatically by githubApi.service after every API call.
 * - Provides pre-flight check before expensive calls.
 * - Keyed by a SHA-256 hash of the token (so the token itself is never stored here).
 */

const crypto = require("crypto");

// In-memory store: tokenHash → { remaining, limit, resetAt }
const rateLimitStore = new Map();

// Minimum remaining requests before we block new analysis calls
const RATE_LIMIT_THRESHOLD = 50;

/**
 * Computes a safe key from a token without storing the token.
 */
function tokenKey(token) {
    if (!token) return "anonymous";
    return crypto.createHash("sha256").update(token).digest("hex").slice(0, 16);
}

/**
 * Called by githubApi.service after every fetch response.
 * Reads x-ratelimit-* headers and updates the in-memory store.
 *
 * @param {string|null} token
 * @param {Headers} headers - Fetch API Headers object
 */
function updateFromHeaders(token, headers) {
    const remaining = parseInt(headers.get("x-ratelimit-remaining") ?? "-1", 10);
    const limit = parseInt(headers.get("x-ratelimit-limit") ?? "-1", 10);
    const resetTimestamp = parseInt(headers.get("x-ratelimit-reset") ?? "0", 10);

    if (remaining === -1) return; // Not a rate-limited endpoint

    rateLimitStore.set(tokenKey(token), {
        remaining,
        limit,
        resetAt: new Date(resetTimestamp * 1000)
    });
}

/**
 * Returns the last known rate-limit status for a token.
 * @param {string|null} token
 * @returns {{ remaining: number, limit: number, resetAt: Date } | null}
 */
function getRateLimitStatus(token) {
    return rateLimitStore.get(tokenKey(token)) || null;
}

/**
 * Pre-flight check before expensive operations.
 * Throws a user-friendly error when rate limit is critically low.
 *
 * @param {string|null} token
 * @throws {Error} if remaining < RATE_LIMIT_THRESHOLD and reset time is known
 */
function checkRateLimit(token) {
    const status = rateLimitStore.get(tokenKey(token));
    if (!status) return; // No data yet — allow the call

    if (status.remaining < RATE_LIMIT_THRESHOLD) {
        const resetIn = Math.ceil((status.resetAt - Date.now()) / 60000);
        throw Object.assign(
            new Error(
                `GitHub API rate limit is critically low (${status.remaining} requests remaining). ` +
                `Limit resets in approximately ${resetIn} minute(s).`
            ),
            { code: "GITHUB_RATE_LIMITED", httpStatus: 429 }
        );
    }
}

module.exports = {
    updateFromHeaders,
    getRateLimitStatus,
    checkRateLimit
};
