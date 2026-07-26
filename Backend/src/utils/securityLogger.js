const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { AsyncLocalStorage } = require("async_hooks");

// Context store for Correlation ID propagation
const asyncLocalStorage = new AsyncLocalStorage();

// Log level weights
const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    SECURITY: 4
};

// Logs folder config
const LOGS_DIR = path.join(__dirname, "../../logs");
const MAX_LOG_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_BACKUP_FILES = 3;

// Keep references to original console functions
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

/**
 * Generates a unique correlation / request ID for request tracing.
 */
function generateCorrelationId() {
    try {
        return crypto.randomUUID();
    } catch {
        return crypto.randomBytes(16).toString("hex");
    }
}

/**
 * Log rotation logic in pure JS to prevent external dependency issues.
 */
function rotateFile(filePath) {
    try {
        if (!fs.existsSync(filePath)) return;
        const stats = fs.statSync(filePath);
        if (stats.size < MAX_LOG_SIZE_BYTES) return;

        // Rotate backup files: .2 -> .3, .1 -> .2, file -> .1
        for (let i = MAX_BACKUP_FILES - 1; i >= 1; i--) {
            const currentBackup = `${filePath}.${i}`;
            const nextBackup = `${filePath}.${i + 1}`;
            if (fs.existsSync(currentBackup)) {
                fs.renameSync(currentBackup, nextBackup);
            }
        }
        fs.renameSync(filePath, `${filePath}.1`);
    } catch (err) {
        originalError(`[LOGGER_ROTATION_ERROR] Failed to rotate log file ${filePath}:`, err);
    }
}

/**
 * Helper to write a log line to a specified log file.
 */
function writeToFile(fileName, line) {
    try {
        if (!fs.existsSync(LOGS_DIR)) {
            fs.mkdirSync(LOGS_DIR, { recursive: true });
        }
        const filePath = path.join(LOGS_DIR, fileName);
        rotateFile(filePath);
        fs.appendFileSync(filePath, line + "\n", "utf8");
    } catch (err) {
        originalError(`[LOGGER_WRITE_ERROR] Failed to write to log file ${fileName}:`, err);
    }
}

/**
 * Recursively filters and sanitizes sensitive data keys like tokens, passwords, and cookies.
 */
function sanitizeMetadata(metadata) {
    if (!metadata) return {};
    
    let sanitized;
    try {
        sanitized = JSON.parse(JSON.stringify(metadata));
    } catch {
        return { error: "Unparseable metadata context" };
    }

    const sensitiveKeys = [
        "cookie", "authorization", "token", "password", 
        "jwt", "csrf", "x-csrf-token", "cookies", "headers"
    ];

    const sanitizeObject = (obj) => {
        if (!obj || typeof obj !== "object") return;
        if (obj._skipRedaction) return; // TEMPORARY BYPASS FOR CSRF DEBUGGING
        
        Object.keys(obj).forEach(key => {
            const lowerKey = key.toLowerCase();
            if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
                obj[key] = "[REDACTED_SENSITIVE_VALUE]";
            } else if (typeof obj[key] === "object") {
                sanitizeObject(obj[key]);
            }
        });
    };

    sanitizeObject(sanitized);
    if (sanitized && sanitized._skipRedaction) delete sanitized._skipRedaction;
    return sanitized;
}

/**
 * Resolve target log level threshold based on environment settings.
 */
function getLogLevel() {
    const envLevel = process.env.LOG_LEVEL?.toUpperCase();
    if (envLevel && LOG_LEVELS[envLevel] !== undefined) {
        return LOG_LEVELS[envLevel];
    }
    return process.env.NODE_ENV === "production" ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG;
}

/**
 * Primary logger function. Writes to central and level-specific log files, and outputs to console.
 */
function writeLog(level, message, details = {}, correlationId = null) {
    const targetLevel = LOG_LEVELS[level];
    const currentLevel = getLogLevel();

    // Skip logs lower than current configured level
    if (targetLevel < currentLevel) {
        return;
    }

    // Automatically resolve current correlation ID from context if not explicitly passed
    const store = asyncLocalStorage.getStore();
    const trackingId = correlationId || (store && store.correlationId) || generateCorrelationId();

    const timestamp = new Date().toISOString();
    const sanitizedDetails = sanitizeMetadata(details);
    const contextStr = Object.keys(sanitizedDetails).length ? ` | Context: ${JSON.stringify(sanitizedDetails)}` : "";

    const logOutput = `[${level}][${timestamp}][CorrelationId: ${trackingId}] ${message}${contextStr}`;

    // 1. Write to app.log (all logs)
    writeToFile("app.log", logOutput);

    // 2. Write to error.log
    if (level === "ERROR") {
        writeToFile("error.log", logOutput);
    }

    // 3. Write to security.log
    if (level === "SECURITY") {
        writeToFile("security.log", logOutput);
    }

    // 4. Output to terminal
    const isProd = process.env.NODE_ENV === "production";
    
    // In production, suppress DEBUG and INFO messages
    if (isProd && targetLevel < LOG_LEVELS.WARN) {
        return;
    }

    if (level === "ERROR" || level === "SECURITY") {
        originalError(logOutput);
    } else if (level === "WARN") {
        originalWarn(logOutput);
    } else {
        originalLog(logOutput);
    }
}

// Noise patterns to filter out verbose expected warnings or debug routes
const NOISE_PATTERNS = [
    /JWT token not provided/i,
    /Token not provided/i,
    /No token to refresh/i,
    /INVALID_JWT/i,
    /401 Unauthorized/i,
    /successful authentication/i,
    /Route reached/i,
    /STT Stage/i,
    /TTS Stage/i,
    /OpenRouter Fallback/i,
    /Sarvam Provider/i,
    /Gemini mentor/i,
    /Cache HIT/i,
    /Cache SET/i,
    /Cache INVALIDATED/i,
    /Starting analysis/i,
    /Fetching git tree/i,
    /Fetching.*prioritized files/i,
    /Running Gemini analysis/i,
    /Analysis complete/i,
    /Evaluating question index/i,
    /Generating follow-up check/i,
    /Follow-up question injected/i,
    /Connection lost/i,
    /Compiling EJS/i,
    /PDF Parsing/i,
    /DOCX Parsing/i
];

function isNoise(msg) {
    return NOISE_PATTERNS.some(pattern => pattern.test(msg));
}

/**
 * Globally intercept and hook console calls to run them through the structured logger.
 */
function hookConsole() {
    console.log = (...args) => {
        const msg = args.map(a => typeof a === "object" ? JSON.stringify(a) : a).join(" ");
        if (isNoise(msg)) {
            writeLog("DEBUG", msg);
        } else {
            writeLog("INFO", msg);
        }
    };
    
    console.warn = (...args) => {
        const msg = args.map(a => typeof a === "object" ? JSON.stringify(a) : a).join(" ");
        if (isNoise(msg)) {
            writeLog("DEBUG", msg);
        } else {
            writeLog("WARN", msg);
        }
    };
    
    console.error = (...args) => {
        const msg = args.map(a => typeof a === "object" ? (a.stack || JSON.stringify(a)) : a).join(" ");
        if (isNoise(msg)) {
            writeLog("DEBUG", msg);
        } else {
            writeLog("ERROR", msg);
        }
    };
}

/**
 * Legacy support wrapper matching previous logSecurityEvent signatures.
 * Automatically filters out expected/unauthenticated token warnings.
 */
function logSecurityEvent({ eventType, ip = "unknown", correlationId, details = {} }) {
    const isMissingToken = details === "JWT token not provided." || 
                          (details && typeof details === "object" && details.message?.includes("not provided")) || 
                          (typeof details === "string" && details.includes("not provided"));

    if (eventType === "INVALID_JWT" && isMissingToken) {
        return;
    }

    let level = "SECURITY";
    let message = `Type: ${eventType} | IP: ${ip}`;

    const detailsStr = typeof details === "string" ? details : (details.message || "");
    if (eventType === "INVALID_JWT" && detailsStr.includes("expired")) {
        level = "WARN";
        message = `JWT Expired | IP: ${ip}`;
    }

    writeLog(level, message, details, correlationId);
}

// Logger helper methods
const logger = {
    debug: (message, details, cid) => writeLog("DEBUG", message, details, cid),
    info: (message, details, cid) => writeLog("INFO", message, details, cid),
    warn: (message, details, cid) => writeLog("WARN", message, details, cid),
    error: (message, details, cid) => writeLog("ERROR", message, details, cid),
    security: (message, details, cid) => writeLog("SECURITY", message, details, cid),
    raw: (message) => originalLog(message),
    hookConsole
};

/**
 * Middleware to trace requests and inject correlation ID context.
 */
function correlationIdMiddleware(req, res, next) {
    const correlationId = req.headers["x-correlation-id"] || generateCorrelationId();
    res.setHeader("x-correlation-id", correlationId);
    req.correlationId = correlationId;

    asyncLocalStorage.run({ correlationId }, () => {
        next();
    });
}

module.exports = {
    logSecurityEvent,
    generateCorrelationId,
    logger,
    correlationIdMiddleware,
    asyncLocalStorage
};
