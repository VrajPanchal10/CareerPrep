const { logger } = require("../../utils/securityLogger");

/**
 * Middleware to selectively log requests matching performance or error criteria:
 * - 5xx Server Errors
 * - Unexpected 4xx Client Errors (excluding standard 401, 404, 422)
 * - Slow requests taking more than 2 seconds
 */
function requestLoggerMiddleware(req, res, next) {
    const start = Date.now();

    res.on("finish", () => {
        const duration = Date.now() - start;
        const status = res.statusCode;

        const isSlow = duration >= 2000;
        const is5xx = status >= 500;
        const isUnexpected4xx = (status >= 400 && status < 500) && status !== 401 && status !== 404 && status !== 422;

        if (isSlow || is5xx || isUnexpected4xx) {
            const message = `${req.method} ${req.originalUrl} - Status: ${status} - Duration: ${duration}ms`;
            const details = {
                method: req.method,
                url: req.originalUrl,
                status,
                durationMs: duration,
                ip: req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress
            };

            if (is5xx) {
                logger.error(message, details);
            } else if (isSlow) {
                logger.warn(`Slow Request Detected: ${message}`, details);
            } else {
                logger.warn(`Unexpected Client Response: ${message}`, details);
            }
        }
    });

    next();
}

module.exports = requestLoggerMiddleware;
