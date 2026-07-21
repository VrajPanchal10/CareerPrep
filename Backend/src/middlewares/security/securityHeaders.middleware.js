const helmet = require("helmet");
const { CSP_DIRECTIVES } = require("../../config/security.config");

/**
 * Custom security headers middleware using Helmet and request nonces.
 */
function securityHeadersMiddleware(req, res, next) {
    const nonce = res.locals.nonce;
    const isProd = process.env.NODE_ENV === "production";

    // Build script-src and connect-src dynamically
    const scriptSrcDirectives = [
        "'self'",
        `'nonce-${nonce}'`,
        "cdnjs.cloudflare.com"
    ];

    // Relax script evaluation ONLY in local development for live hot-reload tools
    if (!isProd) {
        scriptSrcDirectives.push("'unsafe-eval'");
    }

    const connectSrcDirectives = [
        "'self'",
        "http://localhost:3000",
        "http://localhost:5173",
        process.env.FRONTEND_URL,
        process.env.BACKEND_URL
    ].filter(Boolean);

    helmet({
        contentSecurityPolicy: {
            directives: {
                ...CSP_DIRECTIVES,
                scriptSrc: scriptSrcDirectives,
                connectSrc: connectSrcDirectives,
                upgradeInsecureRequests: isProd ? [] : null // Do not force upgrade in development
            }
        },
        crossOriginEmbedderPolicy: false,
        crossOriginResourcePolicy: { policy: "cross-origin" },
        xFrameOptions: { action: "deny" } // Protect against clickjacking
    })(req, res, next);
}

module.exports = securityHeadersMiddleware;
