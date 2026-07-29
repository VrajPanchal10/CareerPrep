/**
 * @module githubOAuth.service
 * @description GitHub OAuth lifecycle management.
 *
 * Responsibilities:
 *  - Build authorization URL with state (CSRF) parameter
 *  - Exchange authorization code for access token
 *  - Validate and revoke tokens
 *  - Encrypt / decrypt tokens using AES-256-GCM before DB storage
 *
 * Tokens are NEVER exposed to the frontend or written to logs.
 */

const crypto = require("crypto");
const { logger } = require("../../utils/securityLogger");
const { resolveGithubConfig, maskString } = require("../../config/githubOAuth.config");

// ---------------------------------------------------------------------------
// Environment getters (dynamic resolution at call-time via centralized config)
// ---------------------------------------------------------------------------
function getGithubConfig() {
    return resolveGithubConfig();
}

// ---------------------------------------------------------------------------
// AES-256-GCM Encryption helpers
// ---------------------------------------------------------------------------

/**
 * Derives a 32-byte key buffer from the hex env variable.
 * Throws clearly if the key is missing or malformed.
 */
function getEncryptionKey() {
    const keyStr = process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
    if (!keyStr) {
        throw new Error(
            "[githubOAuth] GITHUB_TOKEN_ENCRYPTION_KEY environment variable is not set. " +
            "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
        );
    }
    const keyBuffer = Buffer.from(keyStr, "hex");
    if (keyBuffer.length !== 32) {
        throw new Error("[githubOAuth] GITHUB_TOKEN_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes).");
    }
    return keyBuffer;
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * @param {string} plaintext
 * @returns {{ encrypted: string, iv: string, authTag: string }} — all hex strings
 */
function encryptToken(plaintext) {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag().toString("hex");

    return {
        encrypted,
        iv: iv.toString("hex"),
        authTag
    };
}

/**
 * Decrypts a token previously encrypted with encryptToken.
 * @param {{ encrypted: string, iv: string, authTag: string }} payload
 * @returns {string} plaintext token
 */
function decryptToken({ encrypted, iv, authTag }) {
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        key,
        Buffer.from(iv, "hex")
    );
    decipher.setAuthTag(Buffer.from(authTag, "hex"));

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
}

// ---------------------------------------------------------------------------
// OAuth State (CSRF) management — in-memory store with TTL
// ---------------------------------------------------------------------------
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const pendingStates = new Map(); // state → { expiresAt }

/**
 * Generates a cryptographically random state token and stores it.
 * @returns {string} state
 */
function generateOAuthState() {
    const state = crypto.randomBytes(32).toString("hex");
    pendingStates.set(state, { expiresAt: Date.now() + STATE_TTL_MS });

    // Cleanup expired states lazily
    for (const [s, meta] of pendingStates.entries()) {
        if (Date.now() > meta.expiresAt) pendingStates.delete(s);
    }

    return state;
}

/**
 * Validates and consumes a state token (one-time use).
 * @param {string} state
 * @returns {boolean}
 */
function validateAndConsumeOAuthState(state) {
    if (!state || !pendingStates.has(state)) return false;
    const meta = pendingStates.get(state);
    pendingStates.delete(state); // One-time use
    return Date.now() <= meta.expiresAt;
}

// ---------------------------------------------------------------------------
// GitHub OAuth API calls
// ---------------------------------------------------------------------------

/**
 * Builds the GitHub authorization URL.
 * @returns {{ url: string, state: string }}
 */
function getAuthorizationUrl() {
    const config = getGithubConfig();
    if (!config.clientId) {
        throw new Error(`[githubOAuth] Client ID is not configured for ${config.mode} environment.`);
    }
    const state = generateOAuthState();
    const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.callbackUrl,
        scope: config.scopes,
        state,
        allow_signup: "false"
    });

    logger.info(`[githubOAuth] Redirecting to GitHub OAuth: App=${config.mode}, ClientID=${maskString(config.clientId)}, Callback=${config.callbackUrl}, FrontendRedirect=${config.frontendRedirect}`);

    return {
        url: `https://github.com/login/oauth/authorize?${params.toString()}`,
        state
    };
}

/**
 * Exchanges an authorization code for a GitHub access token.
 * @param {string} code
 * @returns {Promise<{ accessToken: string, scopes: string[] }>}
 */
async function exchangeCodeForToken(code) {
    const config = getGithubConfig();

    if (!config.clientId || !config.clientSecret) {
        throw new Error(`[githubOAuth] GitHub OAuth credentials are not configured for ${config.mode} mode.`);
    }

    logger.info(`[githubOAuth] Exchanging code for token: App=${config.mode}, ClientID=${maskString(config.clientId)}, Callback=${config.callbackUrl}`);

    const response = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": "CareerPrep-Platform"
        },
        body: JSON.stringify({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            code,
            redirect_uri: config.callbackUrl
        })
    });

    const data = await response.json();

    if (data.error) {
        throw new Error(`GitHub OAuth token exchange failed: ${data.error_description || data.error}`);
    }

    if (!data.access_token) {
        throw new Error("[githubOAuth] GitHub did not return an access token.");
    }

    const scopes = (data.scope || "").split(",").map(s => s.trim()).filter(Boolean);
    return { accessToken: data.access_token, scopes };
}

/**
 * Revokes a GitHub access token (used on disconnect).
 * @param {string} accessToken
 * @returns {Promise<void>}
 */
async function revokeToken(accessToken) {
    try {
        const config = getGithubConfig();
        if (!config.clientId || !config.clientSecret) return;

        const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
        await fetch(
            `https://api.github.com/applications/${config.clientId}/token`,
            {
                method: "DELETE",
                headers: {
                    "Authorization": `Basic ${credentials}`,
                    "Accept": "application/vnd.github+json",
                    "User-Agent": "CareerPrep-Platform"
                },
                body: JSON.stringify({ access_token: accessToken })
            }
        );
    } catch (err) {
        logger.warn("[githubOAuth] Token revocation call failed (non-fatal):", err.message);
    }
}
        // We intentionally do not throw on revocation failure — the local data
        // should be cleared regardless.
    } catch (err) {
        logger.warn("[githubOAuth] Token revocation call failed (non-fatal):", err.message);
    }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = {
    encryptToken,
    decryptToken,
    getAuthorizationUrl,
    validateAndConsumeOAuthState,
    exchangeCodeForToken,
    revokeToken
};
