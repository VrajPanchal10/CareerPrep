const jwt = require("jsonwebtoken")
const tokenBlacklistModel = require("../models/blacklist.model")

const { logSecurityEvent, logger } = require("../utils/securityLogger");

async function authUser(req, res, next) {
    const token = req.cookies ? req.cookies.token : undefined
    const clientIp = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress

    if (!token) {
        return res.status(401).json({
            message: "Token not provided."
        })
    }

    const isTokenBlacklisted = await tokenBlacklistModel.findOne({
        token
    })

    if (isTokenBlacklisted) {
        logSecurityEvent({
            eventType: "INVALID_JWT",
            ip: clientIp,
            details: "JWT token is blacklisted."
        });
        return res.status(401).json({
            message: "token is invalid"
        })
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        // Session Revocation Check: Verify session is active in database
        if (decoded && decoded.id && decoded.sessionId) {
            const userModel = require("../models/user.model");
            const user = await userModel.findById(decoded.id).select("refreshSessions");

            if (!user) {
                return res.status(401).json({ message: "User session is invalid." });
            }

            const activeSession = (user.refreshSessions || []).find(s => s.sessionId === decoded.sessionId);
            if (!activeSession) {
                res.clearCookie("token");
                res.clearCookie("csrfToken");
                logSecurityEvent({
                    eventType: "REVOKED_SESSION_ATTEMPT",
                    ip: clientIp,
                    details: `Access attempt with revoked session ID: ${decoded.sessionId}`
                });
                return res.status(401).json({ message: "Session has been signed out or revoked." });
            }

            // Periodically update lastActivity on active session
            const now = new Date();
            if (!activeSession.lastActivity || (now - new Date(activeSession.lastActivity)) > 60000) {
                await userModel.updateOne(
                    { _id: decoded.id, "refreshSessions.sessionId": decoded.sessionId },
                    { $set: { "refreshSessions.$.lastActivity": now } }
                ).catch(() => {});
            }
        }

        req.user = decoded
        next()

    } catch (err) {
        logSecurityEvent({
            eventType: "INVALID_JWT",
            ip: clientIp,
            details: `JWT token verification failed: ${err.message}`
        });

        return res.status(401).json({
            message: "Invalid token."
        })
    }
}

const csrfProtection = require("./security/csrf.middleware");

const { rateLimit, ipKeyGenerator } = require("express-rate-limit");

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === "production" ? 10 : 100,
    message: "Too many authentication attempts. Please try again in 15 minutes.",
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, options) => {
        logSecurityEvent({
            eventType: "RATE_LIMIT_VIOLATION",
            ip: req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress,
            details: `Auth rate limit exceeded on path: ${req.originalUrl}`
        });
        return res.status(options.statusCode).json({
            success: false,
            message: options.message
        });
    }
});

const forgotPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: "Too many password reset attempts. Please try again in 15 minutes.",
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, options) => {
        logSecurityEvent({
            eventType: "RATE_LIMIT_VIOLATION",
            ip: req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress,
            details: `Forgot password rate limit exceeded on path: ${req.originalUrl}`
        });
        return res.status(options.statusCode).json({
            success: false,
            message: options.message
        });
    }
});

const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: "Too many AI generation attempts. Please try again in 15 minutes.",
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, options) => {
        logSecurityEvent({
            eventType: "RATE_LIMIT_VIOLATION",
            ip: req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress,
            details: `AI endpoint rate limit exceeded on path: ${req.originalUrl}`
        });
        return res.status(options.statusCode).json({
            success: false,
            message: options.message
        });
    }
});

// Code execution rate limiter — stricter than aiLimiter to prevent sandbox abuse.
// 15 executions per user per minute (applies to both /submit and /run).
const executionLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,  // 1 minute window
    max: parseInt(process.env.PISTON_EXECUTION_LIMIT_MIN || "15", 10),
    message: "Too many code execution attempts. Please wait a moment before trying again.",
    standardHeaders: true,
    legacyHeaders: false,
    // Rate-limit by authenticated user ID when available; fall back to IP via
    // ipKeyGenerator (required by express-rate-limit v8 for IPv6 correctness).
    keyGenerator: (req) => {
        if (req.user?.id) return `user:${req.user.id}`;
        return ipKeyGenerator(req);
    },
    handler: (req, res, next, options) => {
        logSecurityEvent({
            eventType: "RATE_LIMIT_VIOLATION",
            ip: req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress,
            details: `Execution rate limit exceeded on path: ${req.originalUrl} by user: ${req.user?.id || "unknown"}`
        });
        return res.status(options.statusCode).json({
            success: false,
            message: options.message,
            error: { code: "EXECUTION_RATE_LIMIT" }
        });
    }
});

module.exports = { authUser, csrfProtection, logSecurityEvent, logger, authLimiter, forgotPasswordLimiter, aiLimiter, executionLimiter }