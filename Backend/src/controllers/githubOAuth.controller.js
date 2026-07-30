/**
 * @module githubOAuth.controller
 * @description Thin controller layer for GitHub OAuth endpoints.
 * All business logic lives in the service layer.
 */

const userModel = require("../models/user.model");
const oauthService = require("../services/github/githubOAuth.service");
const githubApi = require("../services/github/githubApi.service");
const rateLimitService = require("../services/github/githubRateLimit.service");
const { buildRepoPickerEntry } = require("../services/github/githubSecurity.service");
const { logger } = require("../utils/securityLogger");
const { resolveGithubConfig } = require("../config/githubOAuth.config");

function getFrontendRedirect() {
    return resolveGithubConfig().frontendRedirect;
}

// ---------------------------------------------------------------------------
// Helper: load and decrypt user's stored GitHub token
// ---------------------------------------------------------------------------

/**
 * @param {object} user - Mongoose user document
 * @returns {string|null} plaintext access token, or null if not connected
 */
/**
 * @param {object} user - Mongoose user document
 * @returns {string|null} plaintext access token, or null if not connected
 * @throws {Error} if token decryption fails (corrupted key/payload)
 */
function resolveToken(user) {
    const gh = user.githubOAuth;
    if (!gh || !gh.encryptedAccessToken || !gh.tokenIv || !gh.tokenAuthTag) return null;
    try {
        return oauthService.decryptToken({
            encrypted: gh.encryptedAccessToken,
            iv: gh.tokenIv,
            authTag: gh.tokenAuthTag
        });
    } catch (err) {
        logger.error("[githubOAuth] Token decryption failed:", err.message);
        throw new Error("GITHUB_DECRYPTION_FAILED");
    }
}

// ---------------------------------------------------------------------------
// Controllers
// ---------------------------------------------------------------------------

/**
 * GET /api/github-oauth/connect
 * Redirects the browser to GitHub's OAuth authorization page.
 */
async function initiateOAuthController(req, res, next) {
    try {
        const { url } = oauthService.getAuthorizationUrl(req);
        // Redirect the browser — state is stored server-side, not in URL query visible to client
        return res.redirect(url);
    } catch (err) {
        logger.error("[githubOAuth] initiateOAuth error:", err.message);
        const frontendRedirect = resolveGithubConfig(req).frontendRedirect;
        return res.redirect(`${frontendRedirect}?error=oauth_init_failed`);
    }
}

/**
 * GET /api/github-oauth/callback?code=xxx&state=yyy
 * Handles the GitHub redirect after user authorizes.
 * Exchanges code for token, stores encrypted token on User, redirects to frontend.
 */
async function oauthCallbackController(req, res, next) {
    const activeConfig = resolveGithubConfig(req);
    const targetFrontend = activeConfig.frontendRedirect;

    try {
        const { code, state, error: githubError } = req.query;

        // Diagnostic logging for callback
        const stateCheck = oauthService.validateAndConsumeOAuthStateDetailed(state);

        logger.info("==================================================");
        logger.info("        GITHUB OAUTH CALLBACK DIAGNOSTICS         ");
        logger.info("==================================================");
        logger.info(` Environment:        ${process.env.NODE_ENV || "development"}`);
        logger.info(` Request Host:       ${req.headers.host || "N/A"}`);
        logger.info(` OAuth Mode:         ${activeConfig.mode}`);
        logger.info(` Received State:     ${state ? state.slice(0, 8) + "..." : "NONE"}`);
        logger.info(` Expected State:     ${stateCheck.expected}`);
        logger.info(` State Match:        ${stateCheck.valid}`);
        logger.info(` Redirect Selected:  ${targetFrontend}`);
        logger.info("==================================================");

        // User denied access
        if (githubError) {
            return res.redirect(`${targetFrontend}?error=access_denied`);
        }

        // CSRF state validation
        if (!stateCheck.valid) {
            logger.warn(`[githubOAuth] State validation failed for received state: ${state}`);
            return res.redirect(`${targetFrontend}?error=invalid_state`);
        }

        if (!code) {
            return res.redirect(`${targetFrontend}?error=missing_code`);
        }

        // This callback is unauthenticated by GitHub — we need the user's JWT from cookie
        // to know which User document to update. Decode it manually.
        let userId;
        try {
            const jwt = require("jsonwebtoken");
            const token = req.cookies?.token;
            if (!token) throw new Error("No session cookie");
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            userId = decoded.id;
        } catch (sessionErr) {
            return res.redirect(`${targetFrontend}?error=session_expired`);
        }

        // Exchange code for token
        const { accessToken, scopes } = await oauthService.exchangeCodeForToken(code, req);

        // Fetch GitHub user profile
        const githubUser = await githubApi.getAuthenticatedUser(accessToken);

        // Encrypt before persisting
        const { encrypted, iv, authTag } = oauthService.encryptToken(accessToken);

        // Save to User document
        await userModel.findByIdAndUpdate(userId, {
            $set: {
                "githubOAuth.encryptedAccessToken": encrypted,
                "githubOAuth.tokenIv": iv,
                "githubOAuth.tokenAuthTag": authTag,
                "githubOAuth.githubUserId": String(githubUser.id),
                "githubOAuth.githubUsername": githubUser.login,
                "githubOAuth.githubAvatarUrl": githubUser.avatar_url,
                "githubOAuth.scopes": scopes,
                "githubOAuth.connectedAt": new Date()
            }
        });

        const finalRedirectUrl = `${targetFrontend}?connected=true`;
        if (logger && logger.info) {
            logger.info(`[githubOAuth] GitHub account connected for user ${userId}: @${githubUser.login}`);
            logger.info(`[githubOAuth] Executing final browser 302 redirect to: ${finalRedirectUrl}`);
        }
        return res.redirect(finalRedirectUrl);
    } catch (err) {
        if (logger && logger.error) {
            logger.error("[githubOAuth] Callback error:", err.message || err);
        } else {
            console.error("[githubOAuth] Callback error:", err);
        }
        return res.redirect(`${targetFrontend}?error=token_exchange_failed`);
    }
}

/**
 * GET /api/github-oauth/status
 * Returns connected GitHub account info (no token exposed).
 */
async function getGithubStatusController(req, res, next) {
    try {
        const user = await userModel.findById(req.user.id).select("githubOAuth");
        const gh = user?.githubOAuth;

        if (!gh?.encryptedAccessToken) {
            return res.status(200).json({ success: true, connected: false });
        }

        // Get rate limit status if we have a token
        let token;
        try {
            token = resolveToken(user);
        } catch (err) {
            // Decryption failed. Corrupted credentials. Clear and return connected: false.
            await userModel.findByIdAndUpdate(req.user.id, {
                $set: {
                    "githubOAuth.encryptedAccessToken": null,
                    "githubOAuth.tokenIv": null,
                    "githubOAuth.tokenAuthTag": null,
                    "githubOAuth.githubUserId": null,
                    "githubOAuth.githubUsername": null,
                    "githubOAuth.githubAvatarUrl": null,
                    "githubOAuth.scopes": [],
                    "githubOAuth.connectedAt": null
                }
            });
            logger.warn(`[githubOAuth] Cleared corrupted token for user ${req.user.id}`);
            return res.status(200).json({ success: true, connected: false, message: "GitHub connection corrupted. Please reconnect." });
        }
        const rateLimitStatus = token ? rateLimitService.getRateLimitStatus(token) : null;

        return res.status(200).json({
            success: true,
            connected: true,
            githubUsername: gh.githubUsername,
            githubAvatarUrl: gh.githubAvatarUrl,
            scopes: gh.scopes,
            connectedAt: gh.connectedAt,
            rateLimitStatus
        });
    } catch (err) {
        logger.error("[githubOAuth] getGithubStatus error:", err.message);
        next(err);
    }
}

/**
 * DELETE /api/github-oauth/disconnect
 * Revokes token with GitHub and clears stored credentials.
 */
async function disconnectGithubController(req, res, next) {
    try {
        const user = await userModel.findById(req.user.id).select("githubOAuth");
        let token;
        try {
            token = resolveToken(user);
        } catch (err) {
            token = null;
        }

        if (token) {
            // Best-effort revocation — non-fatal if it fails
            await oauthService.revokeToken(token);
        }

        // Clear all GitHub OAuth fields
        await userModel.findByIdAndUpdate(req.user.id, {
            $set: {
                "githubOAuth.encryptedAccessToken": null,
                "githubOAuth.tokenIv": null,
                "githubOAuth.tokenAuthTag": null,
                "githubOAuth.githubUserId": null,
                "githubOAuth.githubUsername": null,
                "githubOAuth.githubAvatarUrl": null,
                "githubOAuth.scopes": [],
                "githubOAuth.connectedAt": null
            }
        });

        logger.info(`[githubOAuth] GitHub account disconnected for user ${req.user.id}`);
        return res.status(200).json({
            success: true,
            message: "GitHub account disconnected successfully."
        });
    } catch (err) {
        logger.error("[githubOAuth] disconnect error:", err.message);
        next(err);
    }
}

/**
 * GET /api/github-oauth/repositories
 * Lists the authenticated user's repositories with search and pagination.
 * Query params: page, perPage, sort, search, visibility
 */
async function listRepositoriesController(req, res, next) {
    try {
        const user = await userModel.findById(req.user.id).select("githubOAuth");
        let token;
        try {
            token = resolveToken(user);
        } catch (err) {
            return res.status(401).json({
                success: false,
                message: "GitHub credentials corrupted. Please reconnect your account in Settings."
            });
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "GitHub account is not connected. Please connect your GitHub account first."
            });
        }

        const { page = 1, perPage = 30, sort = "updated", search = "", visibility = "all" } = req.query;

        const repos = await githubApi.listUserRepositories(token, {
            page: parseInt(page, 10),
            perPage: Math.min(parseInt(perPage, 10), 100),
            sort,
            type: "all"
        });

        // Apply client-side filtering (search + visibility)
        let filtered = repos;

        if (search) {
            const q = search.toLowerCase();
            filtered = filtered.filter(r =>
                r.name.toLowerCase().includes(q) ||
                (r.description || "").toLowerCase().includes(q)
            );
        }

        if (visibility === "public") {
            filtered = filtered.filter(r => !r.private);
        } else if (visibility === "private") {
            filtered = filtered.filter(r => r.private);
        }

        const entries = filtered.map(buildRepoPickerEntry);

        return res.status(200).json({
            success: true,
            repositories: entries,
            total: entries.length
        });
    } catch (err) {
        logger.error("[githubOAuth] listRepositories error:", err.message);
        if (err.code === "GITHUB_UNAUTHORIZED") {
            return res.status(401).json({
                success: false,
                message: "GitHub token is invalid or expired. Please reconnect your account."
            });
        }
        next(err);
    }
}

/**
 * GET /api/github-oauth/rate-limit
 * Returns current GitHub API rate limit status.
 */
async function getRateLimitController(req, res, next) {
    try {
        const user = await userModel.findById(req.user.id).select("githubOAuth");
        let token;
        try {
            token = resolveToken(user);
        } catch (err) {
            return res.status(401).json({
                success: false,
                message: "GitHub credentials corrupted. Please reconnect your account in Settings."
            });
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "GitHub account is not connected."
            });
        }

        // Fetch fresh rate limit data from GitHub
        const rateLimit = await githubApi.getRateLimit(token);

        return res.status(200).json({
            success: true,
            rateLimit: {
                limit: rateLimit.limit,
                remaining: rateLimit.remaining,
                resetAt: new Date(rateLimit.reset * 1000)
            }
        });
    } catch (err) {
        logger.error("[githubOAuth] getRateLimit error:", err.message);
        next(err);
    }
}

module.exports = {
    initiateOAuthController,
    oauthCallbackController,
    getGithubStatusController,
    disconnectGithubController,
    listRepositoriesController,
    getRateLimitController
};
