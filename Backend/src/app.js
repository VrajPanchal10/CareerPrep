const express = require("express")
const cookieParser = require("cookie-parser")
const cors = require("cors")
const helmet = require("helmet")

const app = express()

// 1. Hide Express fingerprinting (Phase 2)
app.disable("x-powered-by")

// 2. Set secure HTTP headers (Phase 2)
app.use(helmet())

app.use(express.json())
app.use(cookieParser())

// 4. Harden CORS configuration (Phase 3)
const allowedOrigins = [
    "http://localhost:5173",
    "https://careerprep-platform.vercel.app",
    process.env.FRONTEND_URL
].map(o => o && o.replace(/\/$/, "")).filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true); // Allow non-browser requests
        const normalizedOrigin = origin.replace(/\/$/, "");
        if (allowedOrigins.includes(normalizedOrigin)) {
            callback(null, true);
        } else {
            callback(null, false); // Reject cross-origin requests cleanly
        }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"]
}))

/* require all the routes here */
const authRouter = require("./routes/auth.routes")
const interviewRouter = require("./routes/interview.routes")
const atsRouter = require("./routes/ats.routes")
const codeRouter = require("./routes/code.routes")
const voiceRouter = require("./routes/voiceSession.routes")
const repositoryRouter = require("./routes/repositoryInterview.routes")


/* using all the routes here */
app.use("/api/auth", authRouter)
app.use("/api/interview", interviewRouter)
app.use("/api/ats", atsRouter)
app.use("/api/code", codeRouter)
app.use("/api/voice-session", voiceRouter)
app.use("/api/github-defense", repositoryRouter)



/* Global Error Handler Middleware */
app.use((err, req, res, next) => {
    console.error("Unhandled Error Caught by Global Middleware:", err);
    
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