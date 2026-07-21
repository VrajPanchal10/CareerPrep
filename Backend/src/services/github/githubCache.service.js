/**
 * @module githubCache.service
 * @description Provider-abstracted repository analysis cache.
 *
 * Cache key: `{owner}/{repo}@{commitSha}`
 * Invalidation: commit SHA changes on every push → natural expiry.
 * TTL: 24 hours (configurable via GITHUB_CACHE_TTL_HOURS env var).
 */

// ---------------------------------------------------------------------------
// Provider interface (duck-typed contract)
// ---------------------------------------------------------------------------
// All providers must implement:
//   async get(key: string): any | null
//   async set(key: string, value: any, ttlMs: number): void
//   async del(pattern: string): void   // pattern is owner/repo prefix
//   async clear(): void

// ---------------------------------------------------------------------------
// In-memory provider
// ---------------------------------------------------------------------------

class MemoryCacheProvider {
    constructor() {
        /** @type {Map<string, { value: any, expiresAt: number }>} */
        this._store = new Map();
    }

    async get(key) {
        const entry = this._store.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expiresAt) {
            this._store.delete(key);
            return null;
        }
        return entry.value;
    }

    async set(key, value, ttlMs) {
        this._store.set(key, { value, expiresAt: Date.now() + ttlMs });
    }

    /**
     * Deletes all entries whose key starts with the given prefix.
     * Used to invalidate all cached analyses for a single repo.
     */
    async del(prefix) {
        for (const k of this._store.keys()) {
            if (k.startsWith(prefix)) this._store.delete(k);
        }
    }

    async clear() {
        this._store.clear();
    }

    /** Diagnostic — number of live entries */
    size() {
        const now = Date.now();
        let count = 0;
        for (const entry of this._store.values()) {
            if (now <= entry.expiresAt) count++;
        }
        return count;
    }
}

const { logger } = require("../../utils/securityLogger");

const provider = new MemoryCacheProvider();

// ---------------------------------------------------------------------------
// TTL configuration
// ---------------------------------------------------------------------------
const TTL_HOURS = parseInt(process.env.GITHUB_CACHE_TTL_HOURS || "24", 10);
const TTL_MS = TTL_HOURS * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Builds a cache key from owner, repo, and commit SHA.
 * @param {string} owner
 * @param {string} repo
 * @param {string} commitSha
 * @returns {string}
 */
function buildCacheKey(owner, repo, commitSha) {
    return `${owner}/${repo}@${commitSha}`;
}

/**
 * Retrieves a cached analysis if it exists and has not expired.
 * @param {string} owner
 * @param {string} repo
 * @param {string} commitSha
 * @returns {Promise<object|null>}
 */
async function getCachedAnalysis(owner, repo, commitSha) {
    const key = buildCacheKey(owner, repo, commitSha);
    const cached = await provider.get(key);
    if (cached) {
        logger.debug(`[githubCache] Cache HIT: ${key}`);
    }
    return cached;
}

/**
 * Stores an analysis result in the cache.
 * @param {string} owner
 * @param {string} repo
 * @param {string} commitSha
 * @param {object} analysisData
 * @returns {Promise<void>}
 */
async function setCachedAnalysis(owner, repo, commitSha, analysisData) {
    const key = buildCacheKey(owner, repo, commitSha);
    await provider.set(key, analysisData, TTL_MS);
    logger.debug(`[githubCache] Cache SET: ${key} (TTL: ${TTL_HOURS}h)`);
}

/**
 * Invalidates all cached analyses for a repository (any commit SHA).
 * @param {string} owner
 * @param {string} repo
 * @returns {Promise<void>}
 */
async function invalidateRepoCache(owner, repo) {
    const prefix = `${owner}/${repo}@`;
    await provider.del(prefix);
    logger.debug(`[githubCache] Cache INVALIDATED: ${prefix}*`);
}

/**
 * Returns diagnostic cache info.
 */
function getCacheStats() {
    return {
        provider: PROVIDER,
        ttlHours: TTL_HOURS,
        size: typeof provider.size === "function" ? provider.size() : "unknown"
    };
}

module.exports = {
    getCachedAnalysis,
    setCachedAnalysis,
    invalidateRepoCache,
    getCacheStats
};
