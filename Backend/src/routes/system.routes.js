const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth.middleware");
const gateway = require("../services/aiGateway.service");
const { checkGmailConnection } = require("../services/auth/email.service");
const { getRateLimit } = require("../services/github/githubApi.service");
const userModel = require("../models/user.model");
const oauthService = require("../services/github/githubOAuth.service");
const { logger } = require("../utils/securityLogger");

/**
 * Resolves the plaintext GitHub access token from the User document.
 */
async function resolveUserToken(userId) {
    try {
        const user = await userModel.findById(userId).select("githubOAuth");
        const gh = user?.githubOAuth;
        if (!gh?.encryptedAccessToken || !gh?.tokenIv || !gh?.tokenAuthTag) return null;
        return oauthService.decryptToken({
            encrypted: gh.encryptedAccessToken,
            iv: gh.tokenIv,
            authTag: gh.tokenAuthTag
        });
    } catch (err) {
        logger.error("[System Health] GitHub token decryption failed:", err);
        return null;
    }
}

/**
 * @route GET /api/system/health
 * @description Centralized diagnostic endpoint checking all external provider health status.
 * @access private
 */
router.get("/health", authMiddleware.authUser, async (req, res, next) => {
    try {
        // Execute checks concurrently using Promise.allSettled to prevent one failure from blocking others.
        const [gmailResult, githubToken] = await Promise.all([
            checkGmailConnection().catch(err => ({ connected: false, error: err.message })),
            resolveUserToken(req.user.id)
        ]);

        // If GitHub token is present, perform a live rate limit health query.
        let githubStatus = { status: "unconfigured" };
        if (githubToken) {
            try {
                const rate = await getRateLimit(githubToken);
                githubStatus = {
                    status: "healthy",
                    rateLimit: {
                        remaining: rate.remaining,
                        limit: rate.limit,
                        reset: rate.reset
                    }
                };
            } catch (err) {
                logger.error("[System Health] GitHub API rate limit request failed:", err);
                githubStatus = {
                    status: "unhealthy",
                    error: err.message || "Failed to reach GitHub API"
                };
            }
        }

        // Get AI Gateway statuses
        const aiStatus = gateway.getHealthStatus();

        // Normalize AI statuses
        const normalizeAiStatus = (providerKey) => {
            const provider = aiStatus[providerKey];
            if (!provider) return { status: "unconfigured" };
            if (provider.status === "Unconfigured") {
                return { status: "unconfigured" };
            }
            if (provider.status?.includes("Unavailable") || provider.state === "OPEN") {
                return { status: "degraded", model: provider.configuredModel || provider.configuredModels };
            }
            return { status: "healthy", model: provider.configuredModel || provider.configuredModels };
        };

        const responseData = {
            success: true,
            timestamp: new Date().toISOString(),
            providers: {
                gemini: normalizeAiStatus("gemini"),
                groq: normalizeAiStatus("groq"),
                openrouter: normalizeAiStatus("openrouter"),
                sarvam: normalizeAiStatus("sarvam"),
                github: githubStatus,
                gmail: gmailResult.connected 
                    ? { status: "healthy", email: gmailResult.email } 
                    : { status: "unhealthy", error: gmailResult.error || "Gmail REST API verification failed" }
            }
        };

        return res.status(200).json(responseData);
    } catch (error) {
        logger.error("[System Health] Unexpected health check route error:", error);
        next(error);
    }
});

module.exports = router;
