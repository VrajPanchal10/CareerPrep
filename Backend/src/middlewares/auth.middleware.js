const jwt = require("jsonwebtoken")
const tokenBlacklistModel = require("../models/blacklist.model")

/**
 * @description Security-focused logging helper.
 */
function logSecurityEvent({ eventType, ip, details }) {
    const timestamp = new Date().toISOString();
    console.warn(`[SECURITY EVENT] [${timestamp}] [${eventType}] [IP: ${ip}] - ${details}`);
}

async function authUser(req, res, next) {
    const token = req.cookies.token
    const clientIp = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress

    if (!token) {
        logSecurityEvent({
            eventType: "INVALID_JWT",
            ip: clientIp,
            details: "JWT token not provided."
        });
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

/**
 * @description Stateless CSRF Protection for browser cookie authenticated mutate operations.
 */
const csrfProtection = (req, res, next) => {
    const mutatingMethods = ["POST", "PUT", "DELETE", "PATCH"];
    if (!mutatingMethods.includes(req.method)) {
        return next();
    }

    const origin = req.headers.origin;
    const referer = req.headers.referer;
    const clientIp = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    const allowedOrigins = [
        "http://localhost:5173",
        process.env.FRONTEND_URL
    ].filter(Boolean);

    let isAllowed = false;

    if (origin) {
        if (allowedOrigins.includes(origin)) {
            isAllowed = true;
        }
    } else if (referer) {
        try {
            const refererUrl = new URL(referer);
            if (allowedOrigins.includes(refererUrl.origin)) {
                isAllowed = true;
            }
        } catch (e) {
            // invalid URL structure in referer
        }
    } else {
        // Enforce CSRF header check only if JWT token cookies are present
        if (req.cookies && req.cookies.token) {
            isAllowed = false;
        } else {
            isAllowed = true;
        }
    }

    if (!isAllowed) {
        logSecurityEvent({
            eventType: "CSRF_VIOLATION",
            ip: clientIp,
            details: `Mutating request rejected. Origin: ${origin || "none"}, Referer: ${referer || "none"}`
        });

        return res.status(403).json({
            success: false,
            message: "Cross-Site Request Forgery validation failed."
        });
    }

    next();
};

const rateLimit = require("express-rate-limit");

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
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

module.exports = { authUser, csrfProtection, logSecurityEvent, authLimiter, aiLimiter }