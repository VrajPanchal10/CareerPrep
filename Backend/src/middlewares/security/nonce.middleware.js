const { generateCorrelationId } = require("../../utils/securityLogger");
const crypto = require("crypto");

/**
 * Middleware to generate unique correlation IDs and CSP nonces for requests.
 */
function nonceMiddleware(req, res, next) {
    // Generate and attach a unique request correlation ID
    const correlationId = generateCorrelationId();
    req.correlationId = correlationId;
    res.locals.correlationId = correlationId;
    res.setHeader("X-Correlation-ID", correlationId);

    // Generate a unique cryptographic nonce
    const nonce = crypto.randomBytes(16).toString("base64");
    res.locals.nonce = nonce;

    next();
}

module.exports = nonceMiddleware;
