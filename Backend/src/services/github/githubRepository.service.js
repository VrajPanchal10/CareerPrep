/**
 * @module githubRepository.service
 * @description Intelligent repository analysis pipeline orchestrator.
 *
 * Pipeline stages:
 *  1. Security — validate repository access
 *  2. Rate limit — pre-flight quota check
 *  3. Size classification — Small / Medium / Large / Huge
 *  4. Cache — return cached result if commit SHA matches
 *  5. Tree fetch — recursive git tree with cancellation support
 *  6. File filtering — comprehensive exclusion patterns
 *  7. File prioritization — score and rank important files
 *  8. Content fetch — within character budget
 *  9. AI analysis — Gemini via repositoryAi.service
 * 10. Persist — save to MongoDB + update cache
 *
 * Size tiers (configurable via environment):
 *   Small   < 10 MB  → full analysis
 *   Medium  10-50 MB → selective analysis (priority files only)
 *   Large   50-150MB → return { requiresConfirmation: true }  (frontend prompts user)
 *   Huge    > 150 MB → reject with descriptive error
 */

const { GitHubApiError, GITHUB_ERROR_CODES } = require("./githubApi.service");
const githubApi = require("./githubApi.service");
const rateLimitService = require("./githubRateLimit.service");
const cacheService = require("./githubCache.service");
const securityService = require("./githubSecurity.service");
const repositoryAiService = require("../repositoryAi.service");
const repositoryAnalysisModel = require("../../models/repositoryAnalysis.model");
const { logger } = require("../../utils/securityLogger");

// ---------------------------------------------------------------------------
// Size tier thresholds (KB)
// ---------------------------------------------------------------------------
const SIZE_SMALL_KB  = parseInt(process.env.GITHUB_SIZE_SMALL_KB  || String(10  * 1024), 10); // 10 MB
const SIZE_MEDIUM_KB = parseInt(process.env.GITHUB_SIZE_MEDIUM_KB || String(50  * 1024), 10); // 50 MB
const SIZE_LARGE_KB  = parseInt(process.env.GITHUB_SIZE_LARGE_KB  || String(150 * 1024), 10); // 150 MB

// ---------------------------------------------------------------------------
// File processing limits
// ---------------------------------------------------------------------------
const MAX_FILES_FULL       = 20;
const MAX_FILES_SELECTIVE  = 8;
const MAX_CHAR_BUDGET      = 80000;
const MAX_CHARS_PER_FILE   = 12000;

// ---------------------------------------------------------------------------
// Expanded exclusion patterns (per user requirements)
// ---------------------------------------------------------------------------
const EXCLUDE_DIRS = new Set([
    "node_modules", "dist", "build", "out", "output", ".next", ".nuxt",
    "coverage", ".nyc_output", "__pycache__", ".cache", "tmp", "temp",
    "bower_components", "vendor", ".venv", "venv", "env",
    ".git", ".github", ".gitlab",
    ".idea", ".vscode", ".vs", ".eclipse",
    "generated", "auto-generated", "migrations",
    "static", "public/assets", "public/build", "assets",
    "e2e", "__tests__/__snapshots__"
]);

const EXCLUDE_EXTENSIONS = /\.(png|jpe?g|gif|svg|ico|webp|bmp|tiff?|pdf|zip|gz|tar|bz2|rar|7z|woff2?|eot|ttf|otf|mp4|mp3|wav|ogg|webm|mov|avi|mkv|exe|dll|so|dylib|bin|dat|db|sqlite|lock)$/i;

const EXCLUDE_FILENAMES = new Set([
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "composer.lock",
    ".DS_Store", "Thumbs.db", ".gitignore", ".gitattributes",
    ".eslintcache", ".parcel-cache"
]);

// Lock files we DO want (dependency manifests for AI context)
const ALLOW_LOCK_FILES = new Set(["package.json", "requirements.txt", "go.mod", "Cargo.toml", "pom.xml", "build.gradle"]);

function getExclusionReason(filePath) {
    const parts = filePath.split("/");

    // Check if any path segment is an excluded directory
    for (const part of parts.slice(0, -1)) {
        if (EXCLUDE_DIRS.has(part.toLowerCase())) return `Directory excluded: ${part}`;
    }

    const filename = parts[parts.length - 1];

    // Skip excluded filenames (lock files etc.) unless explicitly allowed
    if (EXCLUDE_FILENAMES.has(filename) && !ALLOW_LOCK_FILES.has(filename)) return `Filename excluded: ${filename}`;

    // Skip binary/media extensions
    if (EXCLUDE_EXTENSIONS.test(filename)) return `Extension excluded: ${filename}`;

    return null; // Not excluded
}

function isExcluded(filePath) {
    return getExclusionReason(filePath) !== null;
}

// ---------------------------------------------------------------------------
// File prioritization scoring
// ---------------------------------------------------------------------------

const FILE_PRIORITY_RULES = [
    // Highest priority: README and docs
    { pattern: /readme\.md$/i, score: 100 },
    { pattern: /^docs?\//i, score: 80 },

    // Package manifests and config
    { pattern: /^(package\.json|requirements\.txt|go\.mod|Cargo\.toml|pom\.xml|build\.gradle)$/i, score: 90 },
    { pattern: /(tsconfig|vite\.config|next\.config|webpack\.config|babel\.config)\.(js|ts|json|cjs|mjs)$/i, score: 85 },

    // Infrastructure
    { pattern: /Dockerfile$/i, score: 80 },
    { pattern: /docker-compose\.(yml|yaml)$/i, score: 78 },
    { pattern: /\.(yml|yaml)$/i, score: 40 }, // CI/CD etc.

    // Example env (never .env itself)
    { pattern: /\.env\.(example|sample|dev|test)$/i, score: 70 },

    // Core application entry points
    { pattern: /(app|server|main|index)\.(js|ts|py|go|java|rs)$/i, score: 75 },

    // Architecture: controllers, routes, services, models
    { pattern: /(controller|route|service|model|middleware|repository|store|provider)\.(js|ts|py|go|java|rs)$/i, score: 65 },

    // Components
    { pattern: /\.(jsx|tsx)$/i, score: 45 },

    // Generic source files
    { pattern: /\.(js|ts|py|go|java|rs|cpp|c|h|cs|rb|php|swift|kt)$/i, score: 30 },
];

function scoreFile(filePath) {
    const filename = filePath.split("/").pop();
    let maxScore = 0;
    for (const rule of FILE_PRIORITY_RULES) {
        if (rule.pattern.test(filePath) || rule.pattern.test(filename)) {
            if (rule.score > maxScore) maxScore = rule.score;
        }
    }
    return maxScore;
}

// ---------------------------------------------------------------------------
// Retry helper
// ---------------------------------------------------------------------------

/**
 * Retries an async function up to maxAttempts times with exponential backoff.
 * Respects an optional AbortSignal for cancellation.
 *
 * @param {() => Promise<T>} fn
 * @param {{ maxAttempts?: number, baseDelayMs?: number, signal?: AbortSignal }} opts
 * @returns {Promise<T>}
 */
async function withRetry(fn, { maxAttempts = 3, baseDelayMs = 1000, signal = null } = {}) {
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        if (signal?.aborted) {
            throw Object.assign(new Error("Repository analysis was cancelled."), { code: "ANALYSIS_CANCELLED" });
        }
        try {
            return await fn();
        } catch (err) {
            // Do not retry on auth/forbidden/cancel/rate-limit errors
            if (
                err.code === GITHUB_ERROR_CODES.UNAUTHORIZED ||
                err.code === GITHUB_ERROR_CODES.FORBIDDEN ||
                err.code === GITHUB_ERROR_CODES.NOT_FOUND ||
                err.code === GITHUB_ERROR_CODES.RATE_LIMITED ||
                err.code === "ANALYSIS_CANCELLED"
            ) {
                throw err;
            }
            lastError = err;
            if (attempt < maxAttempts) {
                const delay = baseDelayMs * Math.pow(2, attempt - 1);
                logger.warn(`[githubRepository] Attempt ${attempt} failed (${err.message}). Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    throw lastError;
}

// ---------------------------------------------------------------------------
// Main analysis pipeline
// ---------------------------------------------------------------------------

/**
 * Classifies repository size and returns the tier name.
 * @param {number} sizeKb
 * @returns {"small"|"medium"|"large"|"huge"}
 */
function classifySize(sizeKb) {
    if (sizeKb < SIZE_SMALL_KB)  return "small";
    if (sizeKb < SIZE_MEDIUM_KB) return "medium";
    if (sizeKb < SIZE_LARGE_KB)  return "large";
    return "huge";
}

/**
 * Main entry point — runs the full analysis pipeline.
 *
 * @param {{
 *   owner: string,
 *   repo: string,
 *   token: string|null,        — plaintext (already decrypted by caller)
 *   userId: string,
 *   forceAnalysis?: boolean,   — skip size confirmation prompt for large repos
 *   signal?: AbortSignal       — cancellation support
 * }} options
 *
 * @returns {Promise<{
 *   cached: boolean,
 *   requiresConfirmation?: boolean,
 *   sizeMb?: number,
 *   sizeTier?: string,
 *   analysis?: object
 * }>}
 */
async function analyzeRepository({ owner, repo, token, source, scopes, userId, forceAnalysis = false, signal = null }) {
    logger.debug(`[githubRepository] Starting analysis: ${owner}/${repo} (auth source: ${source})`);

    // --- Stage 1: Security validation ------------------------------------------
    let metadata;
    try {
        metadata = await withRetry(
            () => securityService.validateRepositoryAccess(token, source, owner, repo),
            { signal }
        );
    } catch (err) {
        if (err.code === GITHUB_ERROR_CODES.NOT_FOUND) {
            throw Object.assign(new Error("Repository not found or you do not have access to it."), { httpStatus: 404 });
        }
        throw err;
    }

    const sizeKb = metadata.size || 0;
    const sizeMb = Math.round(sizeKb / 1024 * 10) / 10;
    const defaultBranch = metadata.default_branch || "main";
    const isPrivate = metadata.private || false;
    
    // Verify OAuth scopes for private repo
    if (isPrivate) {
        if (source !== "user") {
            throw Object.assign(
                new Error("This is a private repository. Please connect your GitHub account to analyze private repositories."),
                { httpStatus: 403, code: GITHUB_ERROR_CODES.FORBIDDEN }
            );
        }
        const hasRepoScope = scopes.includes("repo");
        const hasUserScope = scopes.includes("read:user") || scopes.includes("user");
        const hasEmailScope = scopes.includes("user:email") || scopes.includes("user");
        if (!hasRepoScope || !hasUserScope || !hasEmailScope) {
            const missing = [];
            if (!hasRepoScope) missing.push("repo");
            if (!hasUserScope) missing.push("read:user");
            if (!hasEmailScope) missing.push("user:email");
            throw Object.assign(
                new Error(`Your connected GitHub account is missing scopes: ${missing.join(", ")}. Please reconnect your account in Settings.`),
                { httpStatus: 403, code: GITHUB_ERROR_CODES.FORBIDDEN }
            );
        }
    }

    const sizeTier = classifySize(sizeKb);
    logger.info(`[githubRepository] [STAGE 3] Detected default branch: ${defaultBranch}, Size: ${sizeKb}KB (${sizeTier})`);

    // --- Stage 2: Size classification ------------------------------------------
    if (sizeTier === "huge") {
        throw Object.assign(
            new Error(
                `Repository is too large to analyze (${sizeMb} MB). ` +
                `Maximum supported size is ${Math.round(SIZE_LARGE_KB / 1024)} MB.`
            ),
            { httpStatus: 413, code: "REPO_TOO_LARGE" }
        );
    }

    if (sizeTier === "large" && !forceAnalysis) {
        // Return a signal to the frontend to ask for user confirmation
        return { requiresConfirmation: true, sizeMb, sizeTier };
    }

    // --- Stage 3: Rate limit pre-flight ----------------------------------------
    rateLimitService.checkRateLimit(token);

    // --- Stage 4: Latest commit SHA (for cache key) ----------------------------
    let commitSha = null;
    try {
        commitSha = await withRetry(
            () => githubApi.getLatestCommitSha(owner, repo, defaultBranch, token),
            { maxAttempts: 2, signal }
        );
    } catch (shaErr) {
        logger.warn(`[githubRepository] Could not fetch commit SHA (${shaErr.message}). Cache will be skipped.`);
    }

    // --- Stage 5: Cache check --------------------------------------------------
    if (commitSha) {
        const cached = await cacheService.getCachedAnalysis(owner, repo, commitSha);
        if (cached) {
            logger.debug(`[githubRepository] Returning cached analysis for ${owner}/${repo}@${commitSha.slice(0, 8)}`);
            return { cached: true, analysis: cached };
        }
    }

    // --- Stage 6: Fetch repository tree ----------------------------------------
    logger.info(`[githubRepository] [STAGE 6] Fetching recursive git tree for ${owner}/${repo}...`);
    let tree = [];
    let fallbackMode = sizeTier === "medium" || sizeTier === "large"; // Use selective mode for anything medium or larger

    try {
        tree = await withRetry(
            () => githubApi.getRepositoryTree(owner, repo, defaultBranch, token),
            { maxAttempts: 2, signal }
        );
        logger.info(`[githubRepository] [STAGE 6] Tree fetched successfully. Total nodes returned: ${tree.length}`);
    } catch (treeErr) {
        if (
            treeErr.code === GITHUB_ERROR_CODES.RATE_LIMITED ||
            treeErr.code === GITHUB_ERROR_CODES.UNAUTHORIZED ||
            treeErr.code === GITHUB_ERROR_CODES.FORBIDDEN ||
            treeErr.code === GITHUB_ERROR_CODES.NOT_FOUND
        ) {
            throw treeErr;
        }
        logger.error(`[githubRepository] [STAGE 6] Tree fetch failed completely: ${treeErr.message}`);
        throw Object.assign(
            new Error(`Failed to fetch repository tree: ${treeErr.message}`),
            { httpStatus: 400, code: "TREE_FETCH_FAILED" }
        );
    }

    // --- Stage 7: Filter and prioritize files ----------------------------------
    let dirsTraversed = new Set();
    let filesSkipped = 0;
    let skipReasons = {};
    
    const filteredTree = tree.filter(node => {
        if (node.type === "tree") {
            dirsTraversed.add(node.path);
            return false; // we only fetch blobs
        }
        if (node.type === "blob") {
            const reason = getExclusionReason(node.path);
            if (reason) {
                filesSkipped++;
                skipReasons[reason] = (skipReasons[reason] || 0) + 1;
                return false;
            }
            return true;
        }
        return false;
    });

    const totalBlobs = tree.filter(n => n.type === 'blob').length;
    logger.info(`[githubRepository] [STAGE 7] Directories traversed: ${dirsTraversed.size}. Source files discovered: ${totalBlobs}. Files accepted: ${filteredTree.length}. Files skipped: ${filesSkipped}`);
    
    // Check if recursion reaches important directories
    const hasSrc = dirsTraversed.has("src");
    const hasComponents = dirsTraversed.has("src/components");
    const hasBackend = dirsTraversed.has("backend") || dirsTraversed.has("Backend") || dirsTraversed.has("server");
    logger.info(`[githubRepository] [STAGE 7] Recursion validation: src=${hasSrc}, src/components=${hasComponents}, backend/server=${hasBackend}`);

    if (filesSkipped > 0) {
        logger.debug(`[githubRepository] [STAGE 7] Skip reasons breakdown: ${JSON.stringify(skipReasons)}`);
    }

    // Score and sort by priority descending
    const scoredFiles = filteredTree
        .map(node => ({ ...node, priority: scoreFile(node.path) }))
        .filter(node => node.priority > 0)
        .sort((a, b) => b.priority - a.priority);

    const maxFiles = fallbackMode ? MAX_FILES_SELECTIVE : MAX_FILES_FULL;
    const filesToFetch = scoredFiles.slice(0, maxFiles).map(n => n.path);
    
    if (fallbackMode) {
        logger.info(`[githubRepository] [STAGE 7] Large repository handling activated. Intelligent sampling selected ${filesToFetch.length} top priority files.`);
    }

    // Build folder structure preview from filtered tree (directories only, max 120)
    const folderStructureLines = filteredTree
        .filter(n => n.type === "tree" || n.type === "blob")
        .slice(0, 120)
        .map(n => n.path + (n.type === "tree" ? "/" : ""));
    const folderStructureText = folderStructureLines.join("\n") || "Tree unavailable";

    // --- Stage 8: Fetch file contents ------------------------------------------
    logger.info(`[githubRepository] [STAGE 8] Fetching ${filesToFetch.length} prioritized files...`);
    let filesContextText = "";
    let filesAnalyzedCount = 0;
    let successfulBlobDownloads = 0;
    let failedBlobDownloads = 0;

    for (const filepath of filesToFetch) {
        if (signal?.aborted) {
            throw Object.assign(new Error("Repository analysis was cancelled."), { code: "ANALYSIS_CANCELLED" });
        }
        if (filesAnalyzedCount >= maxFiles) break;
        if (filesContextText.length >= MAX_CHAR_BUDGET) break;

        try {
            const rawText = await withRetry(
                () => githubApi.getFileContent(owner, repo, filepath, defaultBranch, token),
                { maxAttempts: 2, signal }
            );
            
            successfulBlobDownloads++;
            logger.debug(`[githubRepository] [STAGE 8] Decoded file ${filepath} successfully (size: ${rawText.length} chars)`);

            filesContextText += `\n\n--- FILE: ${filepath} ---\n`;
            filesContextText += rawText.slice(0, MAX_CHARS_PER_FILE);
            filesAnalyzedCount++;
        } catch (fetchErr) {
            failedBlobDownloads++;
            if (
                fetchErr.code === GITHUB_ERROR_CODES.RATE_LIMITED ||
                fetchErr.code === GITHUB_ERROR_CODES.UNAUTHORIZED ||
                fetchErr.code === GITHUB_ERROR_CODES.FORBIDDEN
            ) {
                throw fetchErr;
            }
            logger.warn(`[githubRepository] [STAGE 8] Failed to fetch blob for ${filepath}: ${fetchErr.message}`);
        }
    }

    logger.info(`[githubRepository] [STAGE 8] Blob downloads: ${successfulBlobDownloads} successful, ${failedBlobDownloads} failed.`);
    logger.info(`[githubRepository] [STAGE 8] Accumulated context size: ${filesContextText.length} chars. Ready for AI invocation.`);

    if (!filesContextText.trim() || filesAnalyzedCount === 0) {
        logger.error(`[githubRepository] [STAGE 8] Pipeline failed: Repository contains no analyzable source files.`);
        throw Object.assign(
            new Error("Repository contains no analyzable source files."),
            { httpStatus: 400, code: "EMPTY_REPOSITORY" }
        );
    }

    // --- Stage 9: AI analysis --------------------------------------------------
    if (signal?.aborted) {
        throw Object.assign(new Error("Repository analysis was cancelled."), { code: "ANALYSIS_CANCELLED" });
    }

    logger.info(`[githubRepository] [STAGE 9] Invoking AI provider... Prompt size: ${filesContextText.slice(0, MAX_CHAR_BUDGET).length} chars`);
    const repoUrl = `https://github.com/${owner}/${repo}`;
    const aiAnalysis = await repositoryAiService.generateRepoAnalysis({
        repoUrl,
        repoName: repo,
        owner,
        filesContext: filesContextText.slice(0, MAX_CHAR_BUDGET),
        folderStructure: folderStructureText
    });
    logger.info(`[githubRepository] [STAGE 9] AI analysis completed successfully.`);

    // --- Stage 10: Persist to MongoDB ------------------------------------------
    const savedAnalysis = await repositoryAnalysisModel.create({
        user: userId,
        repoUrl,
        repoName: repo,
        owner,
        isPrivate,
        authMethod: token ? "oauth" : "none",
        commitSha: commitSha || null,
        sizeKb,
        analysisVersion: 1,
        summary: aiAnalysis.summary,
        knowledgeGraph: aiAnalysis.knowledgeGraph,
        healthReport: aiAnalysis.healthReport,
        projectSnapshot: aiAnalysis.projectSnapshot
    });

    // --- Stage 11: Populate cache ----------------------------------------------
    if (commitSha) {
        await cacheService.setCachedAnalysis(owner, repo, commitSha, savedAnalysis.toObject());
    }

    logger.debug(`[githubRepository] Analysis complete for ${owner}/${repo}. ID: ${savedAnalysis._id}`);
    return { cached: false, analysis: savedAnalysis };
}

module.exports = {
    analyzeRepository,
    classifySize,
    isExcluded
};
