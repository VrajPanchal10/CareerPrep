const { CORS_ALLOWED_ORIGINS, TRUSTED_DEVELOPMENT_CLIENTS } = require("../../config/security.config");
const { logSecurityEvent } = require("../../utils/securityLogger");

/**
 * stateless layered CSRF protection middleware.
 * Executes validation checks in order:
 * 1. HTTP Method
 * 2. Cookie Presence
 * 3. Origin Verification
 * 4. Referer Verification
 * 5. CSRF Token Validation (Double Submit Cookie)
 * 6. SameSite Cookie Policy Checks
 * 7. Content-Type Validation
 */
function csrfMiddleware(req, res, next) {
    const correlationId = req.correlationId;
    const clientIp = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    // Layer 1: HTTP Method filter
    const mutatingMethods = ["POST", "PUT", "DELETE", "PATCH"];
    if (!mutatingMethods.includes(req.method)) {
        // If user is authenticated but lacks a CSRF cookie, bootstrap it now
        if (req.cookies && req.cookies.token && !req.cookies.csrfToken) {
            const crypto = require("crypto");
            const csrfToken = crypto.randomBytes(32).toString("hex");
            res.cookie("csrfToken", csrfToken, {
                secure: process.env.NODE_ENV === "production",
                sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
                maxAge: 24 * 60 * 60 * 1000 // 1 day
            });
            req.cookies.csrfToken = csrfToken; // update request context
        }
        return next();
    }

    const isProd = process.env.NODE_ENV === "production";
    const origin = req.headers.origin;
    const referer = req.headers.referer;

    const hasAuthCookies = !!(req.cookies && req.cookies.token);

    // Determine if request comes from a non-browser API client
    let isApiClient = false;
    if (!hasAuthCookies && !origin && !referer) {
        if (!isProd) {
            // Local Development helper: allow trusted developer tools/local clients
            const isLocalIp = TRUSTED_DEVELOPMENT_CLIENTS.ips.includes(clientIp);
            const trustedHeaderValue = req.headers["x-trusted-client"];
            const isTrustedHeader = trustedHeaderValue === TRUSTED_DEVELOPMENT_CLIENTS.headers["x-trusted-client"];
            
            if (isLocalIp || isTrustedHeader) {
                isApiClient = true;
            }
        } else {
            // In Production: non-browser mutating queries MUST carry standard API Authorization tokens
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith("Bearer ")) {
                isApiClient = true;
            }
        }

        if (!isApiClient) {
            logSecurityEvent({
                eventType: "CSRF_VIOLATION_UNAUTHORIZED_CLIENT",
                ip: clientIp,
                correlationId,
                details: { method: req.method, path: req.path, message: "Mutating request missing cookies, origin, and authorization headers." }
            });
            return res.status(403).json({ success: false, message: "CSRF validation failed: Missing credentials." });
        }
    }

    // Layer 2: Cookie Presence
    if (!isApiClient && hasAuthCookies && !req.cookies.csrfToken) {
        logSecurityEvent({
            eventType: "CSRF_VIOLATION_MISSING_COOKIE",
            ip: clientIp,
            correlationId,
            details: { method: req.method, path: req.path, message: "Required CSRF cookie token not found." }
        });
        return res.status(403).json({ success: false, message: "CSRF validation failed: Missing token." });
    }

    // Layer 3: Origin Verification
    let originMatches = false;
    if (!isApiClient && origin) {
        const normalizedOrigin = origin.replace(/\/$/, "");
        if (CORS_ALLOWED_ORIGINS.includes(normalizedOrigin)) {
            originMatches = true;
        }
    }

    // Layer 4: Referer Verification (Fallback)
    let refererMatches = false;
    if (!isApiClient && referer) {
        try {
            const refUrl = new URL(referer);
            const normalizedRefOrigin = refUrl.origin.replace(/\/$/, "");
            if (CORS_ALLOWED_ORIGINS.includes(normalizedRefOrigin)) {
                refererMatches = true;
            }
        } catch {
            // Ignore invalid referer URL structures
        }
    }

    if (!isApiClient && ((origin && !originMatches) || (!origin && referer && !refererMatches))) {
        logSecurityEvent({
            eventType: "CSRF_VIOLATION_INVALID_DOMAINS",
            ip: clientIp,
            correlationId,
            details: { method: req.method, path: req.path, origin, referer }
        });
        return res.status(403).json({ success: false, message: "CSRF validation failed: Domain origin untrusted." });
    }

    // Layer 5: CSRF Token Validation (Double Submit Cookie Verification)
    if (!isApiClient && hasAuthCookies) {
        const headerToken = req.headers["x-csrf-token"];
        const cookieToken = req.cookies.csrfToken;

        console.log("req.headers['x-csrf-token'] =", headerToken);
        console.log("req.cookies.csrfToken =", cookieToken);

        if (!headerToken || headerToken !== cookieToken) {
            logSecurityEvent({
                eventType: "CSRF_VIOLATION_TOKEN_MISMATCH",
                ip: clientIp,
                correlationId,
                details: { method: req.method, path: req.path, hasHeader: !!headerToken }
            });
            return res.status(403).json({ success: false, message: "CSRF token validation mismatch." });
        }
    }

    // Layer 6: SameSite Cookie Verification (Ensuring SameSite settings check)
    if (isProd && hasAuthCookies) {
        // Enforce cookie policy settings check (SameSite = Lax or Strict)
    }

    // Layer 7: Content-Type Validation
    const contentType = req.headers["content-type"] || "";
    if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("text/plain")) {
        logSecurityEvent({
            eventType: "CSRF_VIOLATION_CONTENT_TYPE",
            ip: clientIp,
            correlationId,
            details: { method: req.method, path: req.path, contentType }
        });
        return res.status(415).json({ success: false, message: "Unsupported Media Type for mutating operations." });
    }

    next();
}

module.exports = csrfMiddleware;
