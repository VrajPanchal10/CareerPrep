/**
 * @module githubOAuth.config
 * @description Centralized, environment-aware configuration for GitHub OAuth.
 *
 * Automatically switches between PRODUCTION OAuth App and LOCAL OAuth App
 * based on process.env.NODE_ENV.
 *
 * Validates configuration on load and exports masked diagnostic helpers.
 */

const { logger } = require("../utils/securityLogger");

const isProduction = process.env.NODE_ENV === "production";

/**
 * Resolves current active GitHub OAuth configuration dynamically.
 * @param {object} [req] - Optional Express request object for dynamic host inspection
 */
function resolveGithubConfig(req = null) {
    let host = "";
    if (req && req.headers && req.headers.host) {
        host = req.headers.host;
    }

    // Auto-detect local request host (localhost or 127.0.0.1)
    const isLocalHostRequest = host.includes("localhost") || host.includes("127.0.0.1");
    const isProductionEnv = process.env.NODE_ENV === "production";
    
    // Force LOCAL mode if request originates from localhost, even if NODE_ENV was set to production by mistake
    const isProduction = isProductionEnv && !isLocalHostRequest;

    let clientId;
    let clientSecret;
    let callbackUrl;
    let frontendRedirect;
    let mode;

    if (isProduction) {
        mode = "PRODUCTION";
        clientId = process.env.GITHUB_CLIENT_ID;
        clientSecret = process.env.GITHUB_CLIENT_SECRET;
        callbackUrl = process.env.GITHUB_OAUTH_REDIRECT_URI || 
            (process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL.replace(/\/$/, "")}/api/github-oauth/callback` : "https://careerprep-platform.vercel.app/api/github-oauth/callback");
        frontendRedirect = process.env.FRONTEND_GITHUB_REDIRECT || 
            (process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL.replace(/\/$/, "")}/github-defense` : "https://careerprep-platform.vercel.app/github-defense");
    } else {
        mode = "LOCAL";
        // Prefer LOCAL_* variables if present, fallback to GITHUB_* credentials for client keys, but strictly enforce LOCAL localhost URLs
        clientId = process.env.LOCAL_GITHUB_CLIENT_ID || process.env.GITHUB_CLIENT_ID;
        clientSecret = process.env.LOCAL_GITHUB_CLIENT_SECRET || process.env.GITHUB_CLIENT_SECRET;
        callbackUrl = process.env.LOCAL_GITHUB_OAUTH_REDIRECT_URI || "http://localhost:3000/api/github-oauth/callback";
        frontendRedirect = process.env.LOCAL_FRONTEND_GITHUB_REDIRECT || "http://localhost:5173/github-defense";
    }

    return {
        mode,
        isProduction,
        clientId: clientId ? clientId.trim() : null,
        clientSecret: clientSecret ? clientSecret.trim() : null,
        callbackUrl: callbackUrl ? callbackUrl.trim() : null,
        frontendRedirect: frontendRedirect ? frontendRedirect.trim() : null,
        encryptionKey: process.env.GITHUB_TOKEN_ENCRYPTION_KEY ? process.env.GITHUB_TOKEN_ENCRYPTION_KEY.trim() : null,
        systemToken: process.env.GITHUB_SYSTEM_TOKEN ? process.env.GITHUB_SYSTEM_TOKEN.trim() : null,
        scopes: "repo read:org read:user user:email"
    };
}

/**
 * Mask sensitive string for safe diagnostic logging (e.g. Ov23liBhicIOPJRvkfRO -> ********kfRO).
 */
function maskString(str, visibleChars = 4) {
    if (!str) return "NOT_SET";
    if (str.length <= visibleChars) return "*".repeat(str.length);
    return "*".repeat(str.length - visibleChars) + str.slice(-visibleChars);
}

/**
 * Validates startup configuration and logs masked diagnostics on boot.
 */
function validateAndLogGithubConfig() {
    const config = resolveGithubConfig();
    const missing = [];

    if (!config.clientId) missing.push(isProduction ? "GITHUB_CLIENT_ID" : "LOCAL_GITHUB_CLIENT_ID (or GITHUB_CLIENT_ID)");
    if (!config.clientSecret) missing.push(isProduction ? "GITHUB_CLIENT_SECRET" : "LOCAL_GITHUB_CLIENT_SECRET (or GITHUB_CLIENT_SECRET)");
    if (!config.callbackUrl) missing.push(isProduction ? "GITHUB_OAUTH_REDIRECT_URI" : "LOCAL_GITHUB_OAUTH_REDIRECT_URI");
    if (!config.encryptionKey) missing.push("GITHUB_TOKEN_ENCRYPTION_KEY");

    console.log("\n==========================================");
    console.log("   GITHUB OAUTH CONFIGURATION DIAGNOSTICS");
    console.log("==========================================");
    console.log(` Environment:        ${process.env.NODE_ENV || "development"}`);
    console.log(` Selected OAuth App: ${config.mode}`);
    console.log(` Callback URL:       ${config.callbackUrl || "MISSING"}`);
    console.log(` Frontend Redirect:  ${config.frontendRedirect || "MISSING"}`);
    console.log(` Client ID:          ${maskString(config.clientId)}`);
    console.log(` Client Secret:      ${config.clientSecret ? "[CONFIGURED - HIDDEN]" : "MISSING"}`);
    console.log(` Encryption Key:     ${config.encryptionKey ? "[CONFIGURED - 32 BYTES]" : "MISSING"}`);
    console.log("==========================================\n");

    if (missing.length > 0) {
        const errorMsg = `[CRITICAL FATAL] Missing required GitHub OAuth environment variable(s) for ${config.mode} mode: ${missing.join(", ")}`;
        logger.error(errorMsg);
        if (isProduction) {
            throw new Error(errorMsg);
        } else {
            console.warn(`⚠️ WARNING: ${errorMsg}`);
        }
    }

    return config;
}

module.exports = {
    resolveGithubConfig,
    validateAndLogGithubConfig,
    maskString
};
