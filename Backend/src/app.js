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
    process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true); // Allow non-browser requests
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error("CORS validation failed: Origin not allowed."));
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


/* using all the routes here */
app.use("/api/auth", authRouter)
app.use("/api/interview", interviewRouter)
app.use("/api/ats", atsRouter)
app.use("/api/code", codeRouter)
app.use("/api/voice-session", voiceRouter)


/* Global Error Handler Middleware */
app.use((err, req, res, next) => {
    console.error("Unhandled Error Caught by Global Middleware:", err);
    res.status(err.status || 500).json({
        success: false,
        message: "An unexpected error occurred on the server.",
        error: {
            code: err.code || "INTERNAL_SERVER_ERROR",
            details: process.env.NODE_ENV === "development" ? err.message : undefined
        }
    });
});

module.exports = app