require("dotenv").config();
const { logger } = require("./src/utils/securityLogger");
const { validateAndLogGithubConfig } = require("./src/config/githubOAuth.config");

// Validate GitHub OAuth Environment Configuration on startup
validateAndLogGithubConfig();

// Enforce environment validation
const requiredEnv = ["JWT_SECRET", "GOOGLE_GENAI_API_KEY", "MONGO_URI"];
const missingEnv = [];
for (const key of requiredEnv) {
    if (!process.env[key] || process.env[key].trim() === "") {
        missingEnv.push(key);
    }
}
if (missingEnv.length > 0) {
    logger.error(`[FATAL] Missing required environment variables: ${missingEnv.join(", ")}`);
    process.exit(1);
}

// Globally hook console logging methods to route via the centralized level-based logger
logger.hookConsole();

const app = require("./src/app");
const connectToDB = require("./src/config/database");
const mongoose = require("mongoose");
const { checkGmailConnection } = require("./src/services/auth/email.service");
const judge0Provider = require("./src/services/execution/judge0.provider");

let serverInstance = null;

// Global exception and rejection handlers
process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled Rejection at Promise", { reason: reason?.stack || reason });
});

process.on("uncaughtException", (error) => {
    logger.error("Uncaught Exception thrown", { error: error?.stack || error });
    if (process.env.NODE_ENV === "production") {
        gracefulShutdown(1);
    }
});

/**
 * Perform graceful resource cleanups on shutdown events
 */
let isShuttingDown = false;
async function gracefulShutdown(code = 0) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info("Initiating graceful shutdown sequence...");

    // 1. Close HTTP server
    if (serverInstance) {
        serverInstance.close(() => {
            logger.info("HTTP server closed.");
        });
    }

    // 2. Close MongoDB connection
    try {
        await mongoose.connection.close();
        logger.info("MongoDB connection closed.");
    } catch (err) {
        logger.error("Error closing MongoDB connection during shutdown", err);
    }

    // 3. Close Puppeteer instance
    try {
        const pdfRenderer = require("./src/services/pdf/pdfRenderer.service");
        await pdfRenderer.shutdown();
        logger.info("Puppeteer browser session closed.");
    } catch (err) {
        logger.error("Error closing Puppeteer during shutdown", err);
    }

    logger.info("Graceful shutdown completed successfully. Exiting.");
    process.exit(code);
}

process.on("SIGINT", () => gracefulShutdown(0));
process.on("SIGTERM", () => gracefulShutdown(0));

function printStartupBanner(port, dbHealthy, gmailStatus) {
    const isProd = process.env.NODE_ENV === "production";
    const envStr = isProd ? "Production" : "Development";

    const hasGemini = !!process.env.GOOGLE_GENAI_API_KEY;
    const hasGroq = !!process.env.Groq_API_KEY;
    const hasSarvam = !!process.env.SARVAM_API_KEY;

    let gmailLine = `Gmail API   : Connected ✅`;
    if (!gmailStatus.connected) {
        gmailLine = `Gmail API   : Connection Unverified ⚠️\n\nReason:\n${gmailStatus.error}`;
    }

    logger.raw(`
CareerPrep Backend
────────────────────────────────────
Environment : ${envStr}
Port        : ${port}

Database    : ${dbHealthy ? "Connected ✅" : "Failed ❌"}

Piston      : Configured ✅
Gemini      : API Key Loaded ✅
Groq        : API Key Loaded ✅
Sarvam      : API Key Loaded ✅

${gmailLine}

Server Ready 🚀
`);
}

async function startServer() {
    let dbHealthy = false;
    try {
        await connectToDB();
        dbHealthy = mongoose.connection.readyState === 1;
    } catch (err) {
        logger.error("Startup database connection check failed", err);
    }

    // Sync Piston runtimes on startup
    judge0Provider.syncRuntimes().catch(err => {
        logger.error("[Server] Failed initial Judge0 runtime sync:", err.message);
    });

    const gmailStatus = await checkGmailConnection();

    const port = process.env.PORT || 3000;
    serverInstance = app.listen(port, () => {
        printStartupBanner(port, dbHealthy, gmailStatus);
    });

    serverInstance.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
            const port = err.port || process.env.PORT || 3000;
            logger.raw(`
❌ Backend failed to start

Reason:
Port ${port} is already in use.

Suggestions:
• Stop the process currently using port ${port}.
• Or change PORT in .env.
• Then restart the backend.
`);
            if (process.env.LOG_LEVEL === "debug") {
                logger.error("Raw EADDRINUSE error:", err);
            }
            process.exit(1);
        } else {
            logger.error("Server listener encountered a fatal error during run:", err);
            gracefulShutdown(1);
        }
    });
}

startServer();