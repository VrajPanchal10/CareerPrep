/**
 * executionCache.service.js
 * In-memory LRU-style cache for execution results.
 *
 * Prevents duplicate API calls when users re-submit identical code.
 *
 * Key construction:  SHA-256( language + "::" + sourceCode + "::" + sortedTestInputs )
 * TTL:               10 minutes by default (EXECUTION_CACHE_TTL_MS env var)
 * Max entries:       500 (configurable via EXECUTION_CACHE_MAX_ENTRIES)
 *
 * Note: Custom input runs are NEVER cached (always fresh execution).
 */

const crypto = require("crypto");

const TTL_MS      = parseInt(process.env.EXECUTION_CACHE_TTL_MS || String(10 * 60 * 1000), 10);
const MAX_ENTRIES = parseInt(process.env.EXECUTION_CACHE_MAX_ENTRIES || "500", 10);

// ─── In-Memory Cache Provider ─────────────────────────────────────────────────

class MemoryCacheProvider {
    constructor() {
        /** @type {Map<string, { value: any, expiresAt: number }>} */
        this._store = new Map();
    }

    get(key) {
        const entry = this._store.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expiresAt) {
            this._store.delete(key);
            return null;
        }
        return entry.value;
    }

    set(key, value, ttlMs = TTL_MS) {
        // Evict oldest entry if at capacity
        if (this._store.size >= MAX_ENTRIES) {
            const firstKey = this._store.keys().next().value;
            this._store.delete(firstKey);
        }
        this._store.set(key, { value, expiresAt: Date.now() + ttlMs });
    }

    delete(key) {
        this._store.delete(key);
    }

    clear() {
        this._store.clear();
    }

    get size() {
        return this._store.size;
    }

    stats() {
        let live = 0;
        const now = Date.now();
        for (const entry of this._store.values()) {
            if (now <= entry.expiresAt) live++;
        }
        return { total: this._store.size, live, ttlMs: TTL_MS, maxEntries: MAX_ENTRIES };
    }
}

// Singleton — shared across all requests in the same process
const provider = new MemoryCacheProvider();

// ─── Cache Key ────────────────────────────────────────────────────────────────

/**
 * Build a deterministic SHA-256 cache key.
 *
 * @param {string}   language     - Language name/identifier
 * @param {string}   sourceCode   - User-submitted source code
 * @param {string[]} testInputs   - Array of stdin strings for each test case
 * @returns {string}
 */
function buildCacheKey(language, sourceCode, testInputs) {
    const payload = [
        String(language),
        sourceCode,
        [...testInputs].sort().join("|")
    ].join("::");
    return crypto.createHash("sha256").update(payload).digest("hex");
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Look up a cached execution result.
 *
 * @param {string}   language
 * @param {string}   sourceCode
 * @param {string[]} testInputs
 * @returns {object | null}  The cached result, or null if not cached / expired
 */
function getCached(language, sourceCode, testInputs) {
    const key = buildCacheKey(language, sourceCode, testInputs);
    return provider.get(key);
}

/**
 * Store an execution result in the cache.
 *
 * @param {string}   language
 * @param {string}   sourceCode
 * @param {string[]} testInputs
 * @param {object}   result       - The evaluation result to cache
 * @param {number}   [ttlMs]      - Optional override TTL
 */
function setCached(language, sourceCode, testInputs, result, ttlMs) {
    const key = buildCacheKey(language, sourceCode, testInputs);
    provider.set(key, { ...result, cachedAt: new Date().toISOString() }, ttlMs);
}

/**
 * Explicitly invalidate a cached result (e.g., after a question is updated).
 *
 * @param {string}   language
 * @param {string}   sourceCode
 * @param {string[]} testInputs
 */
function invalidate(language, sourceCode, testInputs) {
    const key = buildCacheKey(language, sourceCode, testInputs);
    provider.delete(key);
}

/**
 * Return cache health stats (for diagnostics, never expose to end users).
 * @returns {object}
 */
function getStats() {
    return provider.stats();
}

module.exports = {
    getCached,
    setCached,
    invalidate,
    getStats,
    // Expose for testing
    _provider: provider
};
