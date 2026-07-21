const express = require("express")
const cookieParser = require("cookie-parser")
const cors = require("cors")

const nonceMiddleware = require("./middlewares/security/nonce.middleware")
const securityHeadersMiddleware = require("./middlewares/security/securityHeaders.middleware")
const { CORS_ALLOWED_ORIGINS } = require("./config/security.config")
const { correlationIdMiddleware, logger } = require("./utils/securityLogger")
const requestLoggerMiddleware = require("./middlewares/security/requestLogger.middleware")

const app = express()

// 0. Middleware to trace Correlation IDs and selectively log performance/failures
app.use(correlationIdMiddleware)
app.use(requestLoggerMiddleware)

// 1. Hide Express fingerprinting
app.disable("x-powered-by")

// 2. Set secure HTTP headers with dynamic CSP nonces
app.use(nonceMiddleware)
app.use(securityHeadersMiddleware)

app.use(express.json())
app.use(cookieParser())

// 4. Harden CORS configuration
app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true); // Allow non-browser requests
        const normalizedOrigin = origin.replace(/\/$/, "");
        if (CORS_ALLOWED_ORIGINS.includes(normalizedOrigin)) {
            callback(null, true);
        } else {
            callback(null, false); // Reject cross-origin requests cleanly
        }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "X-CSRF-Token"]
}))

/* require all the routes here */
const authRouter = require("./routes/auth.routes")
const interviewRouter = require("./routes/interview.routes")
const atsRouter = require("./routes/ats.routes")
const codingRouter = require("./routes/coding.routes")
const voiceRouter = require("./routes/voiceSession.routes")
const repositoryRouter = require("./routes/repositoryInterview.routes")
const githubOAuthRouter = require("./routes/githubOAuth.routes")
const aiRouter = require("./routes/ai.routes")
const systemRouter = require("./routes/system.routes")
const settingsRouter = require("./routes/settings.routes")

/* using all the routes here */
app.use("/api/auth", authRouter)
app.use("/api/interview", interviewRouter)
app.use("/api/ats", atsRouter)
app.use("/api/coding", codingRouter)
app.use("/api/voice-session", voiceRouter)
app.use("/api/github-defense", repositoryRouter)
app.use("/api/github-oauth", githubOAuthRouter)
app.use("/api/ai", aiRouter)
app.use("/api/system", systemRouter)
app.use("/api/settings", settingsRouter)



// 404 JSON Fallback Handler for unmatched API routes
app.use((req, res, next) => {
    res.status(404).json({
        success: false,
        message: `API Route Not Found: ${req.method} ${req.originalUrl}`,
        error: {
            code: "ROUTE_NOT_FOUND"
        }
    });
});

/* Global Error Handler Middleware */
app.use((err, req, res, next) => {
    logger.error("Unhandled Error Caught by Global Middleware:", err);
    
    let statusCode = err.status || err.statusCode || 500;
    let message = err.message || "An unexpected error occurred on the server.";
    let errCode = err.code || "INTERNAL_SERVER_ERROR";
    let details = process.env.NODE_ENV === "development" ? err.message : undefined;

    // Handle Mongoose validation errors
    if (err.name === "ValidationError") {
        statusCode = 400;
        errCode = "VALIDATION_ERROR";
        message = Object.values(err.errors).map(e => e.message).join(", ");
    } 
    // Handle Mongoose duplicate key errors
    else if (err.code === 11000) {
        statusCode = 400;
        errCode = "DUPLICATE_KEY_ERROR";
        const field = Object.keys(err.keyValue || {}).join(", ") || "field";
        message = `An account or record already exists with this ${field}.`;
    }
    // Handle JWT signature/expiration errors
    else if (err.name === "JsonWebTokenError") {
        statusCode = 401;
        errCode = "INVALID_TOKEN";
        message = "Invalid authentication token session.";
    } else if (err.name === "TokenExpiredError") {
        statusCode = 401;
        errCode = "TOKEN_EXPIRED";
        message = "Authentication token session has expired.";
    }

    res.status(statusCode).json({
        success: false,
        message,
        error: {
            code: errCode,
            details
        }
    });
});

module.exports = app