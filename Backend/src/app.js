const express = require("express")
const cookieParser = require("cookie-parser")
const cors = require("cors")

const nonceMiddleware = require("./middlewares/security/nonce.middleware")
const securityHeadersMiddleware = require("./middlewares/security/securityHeaders.middleware")
const { CORS_ALLOWED_ORIGINS } = require("./config/security.config")
const { correlationIdMiddleware, logger } = require("./utils/securityLogger")
const requestLoggerMiddleware = require("./middlewares/security/requestLogger.middleware")

const app = express()

// Trust reverse proxy (e.g. Render / Cloudflare / NGINX) for accurate client IP rate-limiting
app.set("trust proxy", 1)

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
const voiceRouter = require("./routes/voiceSession.routes")
const repositoryRouter = require("./routes/repositoryInterview.routes")
const githubOAuthRouter = require("./routes/githubOAuth.routes")
const aiRouter = require("./routes/ai.routes")
const systemRouter = require("./routes/system.routes")
const settingsRouter = require("./routes/settings.routes")

const pkg = require("../package.json");

/* using all the routes here */
app.use("/api/auth", authRouter)
app.use("/api/interview", interviewRouter)
app.use("/api/ats", atsRouter)
app.use("/api/voice-session", voiceRouter)
app.use("/api/github-defense", repositoryRouter)
app.use("/api/github-oauth", githubOAuthRouter)
app.use("/api/ai", aiRouter)
app.use("/api/system", systemRouter)
app.use("/api/settings", settingsRouter)

// Root API Welcome Endpoint
app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        name: "CareerPrep Backend API",
        description: "AI-powered placement readiness platform backend.",
        version: pkg.version || "1.0.0",
        environment: process.env.NODE_ENV || "development",
        status: "Online",
        timestamp: new Date().toISOString(),
        documentation: "https://github.com/VrajPanchal10/Ai-resume-analyzer",
        availableRoutes: {
            "Authentication": "/api/auth",
            "ATS Resume Analysis": "/api/ats",
            "Mock Interview": "/api/interview",
            "Voice Session": "/api/voice-session",
            "GitHub Project Defense": "/api/github-defense",
            "GitHub OAuth": "/api/github-oauth",
            "AI Gateway": "/api/ai",
            "System Diagnostics": "/api/system",
            "Settings": "/api/settings"
        }
    });
});

// Print registered routes on startup for audit
console.log("=== REGISTERED EXPRESS ROUTES ===");
const printRoutes = (stack, parentPath = '') => {
    stack.forEach((layer) => {
        if (layer.route) {
            const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase()).join(', ');
            console.log(`[ROUTE] ${methods.padEnd(7)} ${parentPath}${layer.route.path}`);
        } else if (layer.name === 'router' && layer.handle.stack) {
            let path = layer.regexp.source
                .replace('^\\/', '/')
                .replace('\\/?(?=\\/|$)', '')
                .replace(/\\\//g, '/')
                .replace('(?i)', '')
                .replace('(?:\\/(?=$))?', '');
            printRoutes(layer.handle.stack, parentPath + path);
        }
    });
};
if (app._router && app._router.stack) {
    printRoutes(app._router.stack);
}
console.log("=================================");



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

/* Helper to parse file and line number from error stack trace */
function parseErrorLocation(stack) {
    if (!stack) return { file: "unknown", line: "unknown" };
    const lines = stack.split("\n");
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes("node_modules")) continue; // Filter out node_modules frames
        const match = line.match(/\((.+):(\d+):(\d+)\)/) || line.match(/at\s+(.+):(\d+):(\d+)/);
        if (match) {
            return { file: match[1], line: match[2] };
        }
    }
    return { file: "unknown", line: "unknown" };
}

/* Global Error Handler Middleware */
app.use((err, req, res, next) => {
    const correlationId = req.correlationId || req.headers?.["x-correlation-id"] || "N/A";
    const { file, line } = parseErrorLocation(err.stack);

    logger.error("================ GLOBAL ERROR CAUGHT ================");
    logger.error(`Correlation ID : ${correlationId}`);
    logger.error(`Route / Method : ${req.method} ${req.originalUrl}`);
    logger.error(`Error Name     : ${err.name || "Error"}`);
    logger.error(`Message        : ${err.message}`);
    logger.error(`File / Line    : ${file}:${line}`);
    logger.error(`Stack Trace    :\n${err.stack || err}`);
    logger.error("====================================================");
    
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