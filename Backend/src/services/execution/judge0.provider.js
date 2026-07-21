const axios = require("axios");
const { logger } = require("../../utils/securityLogger");

// ─── Configuration ────────────────────────────────────────────────────────────
const JUDGE0_BASE_URL = (process.env.JUDGE0_BASE_URL || "http://localhost:2358").replace(/\/$/, "");
const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY || null;
const JUDGE0_RAPIDAPI_HOST = process.env.JUDGE0_RAPIDAPI_HOST || null;

const TIMEOUT_MS = parseInt(process.env.CODE_EXECUTION_TIMEOUT || "15000", 10);
const MAX_CONCURRENCY = parseInt(process.env.MAX_EXECUTION_CONCURRENCY || "10", 10);

// Default limits
const DEFAULT_TIME_LIMIT_SECONDS = parseInt(process.env.MAX_EXECUTION_TIME || "5", 10);
const DEFAULT_MEMORY_LIMIT_KB = parseInt(process.env.MAX_MEMORY_LIMIT || "262144", 10); // 256 MB

// Simple concurrency limiter
function pLimit(concurrency) {
    const queue = [];
    let activeCount = 0;
    const next = () => {
        activeCount--;
        if (queue.length > 0) queue.shift()();
    };
    return (fn) => new Promise((resolve, reject) => {
        const run = async () => {
            activeCount++;
            try { resolve(await fn()); }
            catch (err) { reject(err); }
            finally { next(); }
        };
        if (activeCount < concurrency) run();
        else queue.push(run);
    });
}
const limitQueue = pLimit(MAX_CONCURRENCY);

// ─── Circuit Breaker & Retry State ────────────────────────────────────────────
const CIRCUIT_BREAKER = {
    failures: 0,
    threshold: 5,
    resetTimeout: 30000, // 30s before trying again
    lastFailureTime: null,
    isOpen: function () {
        if (this.failures >= this.threshold) {
            const now = Date.now();
            if (now - this.lastFailureTime > this.resetTimeout) {
                // Half-open: allow next request to try
                return false;
            }
            return true;
        }
        return false;
    },
    recordFailure: function () {
        this.failures++;
        this.lastFailureTime = Date.now();
    },
    recordSuccess: function () {
        this.failures = 0;
        this.lastFailureTime = null;
    }
};

// ─── Axios Instance ───────────────────────────────────────────────────────────
const headers = {
    "Content-Type": "application/json",
    "Accept": "application/json"
};
if (JUDGE0_API_KEY) headers["X-Auth-Token"] = JUDGE0_API_KEY;
if (JUDGE0_RAPIDAPI_HOST) headers["X-RapidAPI-Host"] = JUDGE0_RAPIDAPI_HOST;
if (JUDGE0_API_KEY && JUDGE0_RAPIDAPI_HOST) headers["X-RapidAPI-Key"] = JUDGE0_API_KEY; // RapidAPI uses this header

const judge0Client = axios.create({
    baseURL: JUDGE0_BASE_URL,
    timeout: TIMEOUT_MS,
    headers
});

// ─── Runtime Cache ────────────────────────────────────────────────────────────
let runtimesCache = [];
let lastRuntimeFetch = null;
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

/**
 * Validates Judge0 connection and fetches available runtimes.
 * Does not crash the application if unavailable; retries periodically.
 */
async function syncRuntimes(force = false) {
    if (!force && lastRuntimeFetch && (Date.now() - lastRuntimeFetch < REFRESH_INTERVAL_MS)) {
        return;
    }
    try {
        const response = await judge0Client.get("/languages");
        // Judge0 returns: [ { id: 71, name: "Python (3.8.1)" }, ... ]
        runtimesCache = response.data;
        lastRuntimeFetch = Date.now();
        logger.info(`[Judge0 Provider] Successfully fetched ${runtimesCache.length} runtimes.`);
        CIRCUIT_BREAKER.recordSuccess();
    } catch (err) {
        logger.error(`[Judge0 Provider] Failed to fetch runtimes: ${err.message}. Using cache if available.`);
        CIRCUIT_BREAKER.recordFailure();
        if (runtimesCache.length === 0) {
            logger.warn("[Judge0 Provider] Runtime cache is empty. Provider might be completely down.");
        }
    }
}

/**
 * Returns cached runtimes and attempts background refresh if needed.
 */
async function getRuntimes() {
    if (!lastRuntimeFetch || (Date.now() - lastRuntimeFetch >= REFRESH_INTERVAL_MS)) {
        // Trigger background refresh, don't wait if we have cache
        syncRuntimes().catch(() => {});
    }
    return runtimesCache;
}

/**
 * Intelligent language/version fallback to find best matching runtime.
 */
async function resolveRuntime(languageName, requestedVersion = "*") {
    const runtimes = await getRuntimes();
    const normalizedName = languageName.toLowerCase();
    
    // Exact match by name
    const exact = runtimes.find(r => r.name.toLowerCase() === normalizedName);
    if (exact) return exact;

    // Substring match (e.g. "python" matching "Python (3.8.1)")
    // If multiple match, we take the last one (usually highest version in Judge0's list)
    const matches = runtimes.filter(r => r.name.toLowerCase().includes(normalizedName));
    if (matches.length > 0) {
        return matches[matches.length - 1];
    }
    
    throw new Judge0Error(`Language ${languageName} is not supported by the execution provider.`, "UNSUPPORTED_LANGUAGE");
}

// ─── Execution Logic ──────────────────────────────────────────────────────────

/**
 * Retry wrapper with exponential backoff for transient failures (429, 5xx, timeouts)
 */
async function executeWithRetry(operation, maxRetries = 2) {
    let attempt = 0;
    while (attempt <= maxRetries) {
        if (CIRCUIT_BREAKER.isOpen()) {
            throw new Judge0Error("Execution provider circuit breaker is open. Service temporarily unavailable.", "CIRCUIT_BREAKER_OPEN", 503);
        }
        try {
            const result = await operation();
            CIRCUIT_BREAKER.recordSuccess();
            return { data: result, retries: attempt };
        } catch (err) {
            const status = err.response?.status;
            const isTransient = err.code === "ECONNABORTED" || err.code === "ETIMEDOUT" || status === 429 || (status >= 500 && status <= 599);
            
            if (isTransient) {
                CIRCUIT_BREAKER.recordFailure();
                if (attempt < maxRetries) {
                    const backoffMs = Math.pow(2, attempt) * 500;
                    logger.warn(`[Judge0 Provider] Transient error (${status || err.code}). Retrying in ${backoffMs}ms... (Attempt ${attempt + 1}/${maxRetries})`);
                    await new Promise(res => setTimeout(res, backoffMs));
                    attempt++;
                    continue;
                }
            } else {
                // Non-transient (400, etc), fail immediately
                throw err;
            }
            throw err;
        }
    }
}

/**
 * Helper to delay execution (polling).
 */
const delay = ms => new Promise(res => setTimeout(res, ms));

/**
 * Execute code on Judge0 using standard polling.
 * AbortController signal can be passed in opts.signal.
 */
async function executeCode(opts) {
    return limitQueue(async () => {
        const {
            sourceCode,
            language,
            version = "*",
            stdin = "",
            timeLimitS = DEFAULT_TIME_LIMIT_SECONDS,
            memoryLimitKb = DEFAULT_MEMORY_LIMIT_KB,
            signal = null
        } = opts;

        const runtime = await resolveRuntime(language, version);
        
        const payload = {
            language_id: runtime.id,
            source_code: sourceCode,
            stdin: stdin,
            cpu_time_limit: timeLimitS,
            memory_limit: memoryLimitKb
        };

        const startTime = Date.now();
        
        try {
            // 1. Create submission
            const { data: createResponse, retries } = await executeWithRetry(() => 
                judge0Client.post("/submissions?base64_encoded=false", payload, { signal })
            );
            
            const token = createResponse.data.token;
            if (!token) throw new Error("No submission token received from Judge0.");

            // 2. Poll for status
            let statusResponse;
            let pollingRetries = 0;
            const MAX_POLLS = 15; // e.g. up to 15 seconds max (depending on delay)

            while (pollingRetries < MAX_POLLS) {
                if (signal?.aborted) {
                    logger.info(`[Judge0 Provider] Polling cancelled by AbortController.`);
                    throw new Judge0Error("Execution cancelled", "CANCELLED", 499);
                }

                await delay(1000); // 1s poll interval
                
                const { data: pollData } = await executeWithRetry(() => 
                    judge0Client.get(`/submissions/${token}?base64_encoded=false`, { signal })
                );
                
                statusResponse = pollData.data;
                const statusId = statusResponse.status?.id;

                // 1 = In Queue, 2 = Processing
                if (statusId > 2) {
                    break;
                }
                pollingRetries++;
            }

            if (!statusResponse || statusResponse.status?.id <= 2) {
                throw new Judge0Error("Execution timed out while polling", "POLL_TIMEOUT", 408);
            }

            const durationMs = Date.now() - startTime;
            const normalized = normalizeJudge0Result(statusResponse, runtime);
            normalized.retryCount = retries;
            return normalized;
        } catch (err) {
            if (axios.isCancel(err)) {
                logger.info(`[Judge0 Provider] Request cancelled by AbortController.`);
                throw new Judge0Error("Execution cancelled", "CANCELLED", 499);
            }
            if (err.response) {
                logger.error(`[Judge0 Provider] API Error: ${err.response.status} - ${JSON.stringify(err.response.data)}`);
                throw new Judge0Error(err.response.data.message || "Provider API Error", "API_ERROR", err.response.status);
            }
            if (err instanceof Judge0Error) throw err;
            throw new Judge0Error(err.message, "NETWORK_ERROR");
        }
    });
}

/**
 * Normalizes Judge0 API response to standard internal execution format.
 */
function normalizeJudge0Result(data, runtime) {
    let verdict = "UNKNOWN";
    const statusId = data.status?.id;

    switch (statusId) {
        case 3: verdict = "ACCEPTED"; break;
        case 4: verdict = "WRONG_ANSWER"; break;
        case 5: verdict = "TLE"; break;
        case 6: verdict = "COMPILATION_ERROR"; break;
        case 7:
        case 8:
        case 9:
        case 10:
        case 11:
        case 12: verdict = "RUNTIME_ERROR"; break;
        case 13: verdict = "INTERNAL_ERROR"; break;
        case 14: verdict = "EXEC_FORMAT_ERROR"; break;
        default: verdict = "UNKNOWN";
    }

    return {
        verdict,
        statusLabel: verdict, // Simple map
        stdout: (data.stdout || "").trim(),
        stderr: (data.stderr || "").trim(),
        compileOutput: (data.compile_output || "").trim(),
        message: (data.message || "").trim(),
        timeMs: data.time ? parseFloat(data.time) * 1000 : null,
        memoryKb: data.memory || null,
        exitCode: data.exit_code,
        provider: "Judge0",
        runtime: runtime.name // e.g. "Python (3.8.1)"
    };
}

/**
 * Check health for /api/coding/health
 */
async function checkHealth() {
    return {
        healthy: !CIRCUIT_BREAKER.isOpen(),
        status: CIRCUIT_BREAKER.isOpen() ? "circuit_breaker_open" : "online",
        cache: {
            runtimeCount: runtimesCache.length,
            lastSync: lastRuntimeFetch ? new Date(lastRuntimeFetch).toISOString() : null
        }
    };
}

class Judge0Error extends Error {
    constructor(message, code = "JUDGE0_ERROR", status = 500) {
        super(message);
        this.name = "Judge0Error";
        this.code = code;
        this.status = status;
    }
}

module.exports = {
    executeCode,
    checkHealth,
    syncRuntimes,
    getRuntimes,
    resolveRuntime,
    Judge0Error
};
