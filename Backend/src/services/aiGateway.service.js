const crypto = require("crypto");
const aiConfig = require("../config/aiProviders.config");
const { logger } = require("../utils/securityLogger");

// Import provider adapters
const geminiProvider = require("./providers/gemini.provider");
const groqProvider = require("./providers/groq.provider");
const openrouterProvider = require("./providers/openrouter.provider");
const sarvamProvider = require("./providers/sarvam.provider");

// Reusable Map for optional response caching
const responseCache = new Map();

// Circuit Breaker state for Gemini
const circuitBreaker = {
    state: "CLOSED", // "CLOSED", "OPEN", "HALF-OPEN"
    failureCount: 0,
    lastFailureTime: 0
};

// Cacheable task types (expensive operations, non-conversational)
const CACHEABLE_TASKS = [
    "atsResumeAnalysis",
    "resumeSuggestions",
    "weaknessHeatmap",
    "skillBreakdown",
    "githubRepositoryAnalysis",
    "projectDefense",
    "pdfReportGeneration"
];

/**
 * Helper to compute prompt SHA-256 hash for cache key validation.
 */
function getCacheKey(task, prompt) {
    const serializedPrompt = typeof prompt === "string" ? prompt : JSON.stringify(prompt);
    const hash = crypto.createHash("sha256").update(serializedPrompt).digest("hex");
    return `${task}:${hash}`;
}

/**
 * Gateways-wide central routing log.
 */
/**
 * Gateways-wide central routing log.
 */
function logGatewayEvent({ success, task, provider, model, latency, cacheStatus = "MISS", fallbackUsed, failureReason }) {
    logger.debug(`[AI Gateway] [${cacheStatus}] Task: '${task}' | Success: ${success} | Provider: ${provider} | Model: ${model} | Latency: ${latency}ms | Fallback: ${fallbackUsed ? "Yes" : "No"}${failureReason ? ` | Failures: ${failureReason}` : ""}`);
}

/**
 * Route a task to the configured AI provider.
 */
async function routeTask(taskName, payload, options = {}) {
    const startTime = Date.now();
    const routeConfig = aiConfig.routingTable[taskName];

    if (!routeConfig) {
        throw new Error(`No provider configuration mapped for task '${taskName}'.`);
    }

    const primaryProvider = typeof routeConfig === "string" ? routeConfig : routeConfig.provider;
    const taskTemperature = typeof routeConfig === "string" ? undefined : routeConfig.temperature;
    
    // Inject task-level temperature into options if not overridden
    if (taskTemperature !== undefined && options.temperature === undefined) {
        options.temperature = taskTemperature;
    }

    // 1. Caching Layer Check
    const isCacheable = aiConfig.cache.enabled && CACHEABLE_TASKS.includes(taskName) && (options.cache !== false);
    let cacheKey = null;
    if (isCacheable && payload.prompt) {
        cacheKey = getCacheKey(taskName, payload.prompt);
        if (responseCache.has(cacheKey)) {
            const cachedItem = responseCache.get(cacheKey);
            if (Date.now() - cachedItem.timestamp < aiConfig.cache.ttlMs) {
                const cacheHitLatency = Date.now() - startTime;
                logGatewayEvent({
                    success: true,
                    task: taskName,
                    provider: cachedItem.response.provider,
                    model: cachedItem.response.model,
                    latency: cacheHitLatency,
                    cacheStatus: "HIT",
                    fallbackUsed: false
                });
                return {
                    ...cachedItem.response,
                    cached: true,
                    latency: cacheHitLatency
                };
            } else {
                // Evict expired cache
                responseCache.delete(cacheKey);
            }
        }
    }

    // Determine fallback sequence chain
    let chain = [primaryProvider];
    if (primaryProvider === "gemini") {
        chain = ["gemini", "openrouter", "groq"];
    } else if (primaryProvider === "groq") {
        chain = ["groq", "gemini"];
    }

    let finalResponse = null;
    let errors = [];
    let success = false;
    let selectedProvider = null;
    let fallbackTriggered = false;

    for (let i = 0; i < chain.length; i++) {
        selectedProvider = chain[i];
        if (selectedProvider !== primaryProvider) {
            fallbackTriggered = true;
        }

        // Circuit Breaker check for Gemini
        if (selectedProvider === "gemini" && circuitBreaker.state === "OPEN") {
            const timeSinceFailure = Date.now() - circuitBreaker.lastFailureTime;
            if (timeSinceFailure > aiConfig.circuitBreaker.recoveryTimeoutMs) {
                logger.warn(`[AI Gateway] Circuit breaker recovery timeout elapsed. Setting to HALF-OPEN for Gemini.`);
                circuitBreaker.state = "HALF-OPEN";
            } else {
                logger.warn(`[AI Gateway] Circuit breaker is OPEN for Gemini. Bypassing Gemini.`);
                errors.push("Gemini circuit breaker is OPEN");
                continue;
            }
        }

        try {
            if (selectedProvider === "gemini") {
                finalResponse = await geminiProvider.execute(payload, options);
                if (finalResponse && finalResponse.success) {
                    if (circuitBreaker.state === "HALF-OPEN") {
                        logger.debug(`[AI Gateway] Gemini request succeeded in HALF-OPEN state. Resetting Circuit Breaker to CLOSED.`);
                    }
                    circuitBreaker.state = "CLOSED";
                    circuitBreaker.failureCount = 0;
                    success = true;
                    break;
                } else {
                    throw new Error(finalResponse?.error?.message || "Gemini execution failure");
                }
            } else if (selectedProvider === "groq") {
                finalResponse = await groqProvider.execute(payload, options);
                if (finalResponse && finalResponse.success) {
                    success = true;
                    break;
                } else {
                    throw new Error(finalResponse?.error?.message || "Groq execution failure");
                }
            } else if (selectedProvider === "sarvam") {
                finalResponse = await sarvamProvider.execute(payload, { ...options, task: taskName });
                if (finalResponse && finalResponse.success) {
                    success = true;
                    break;
                } else {
                    throw new Error(finalResponse?.error?.message || "Sarvam execution failure");
                }
            } else if (selectedProvider === "openrouter") {
                finalResponse = await openrouterProvider.execute(payload, options);
                if (finalResponse && finalResponse.success) {
                    success = true;
                    break;
                } else {
                    throw new Error(finalResponse?.error?.message || "OpenRouter execution failure");
                }
            }
        } catch (err) {
            logger.warn(`[AI Gateway] Provider ${selectedProvider} failed on task '${taskName}': ${err.message}`);
            errors.push(`${selectedProvider} error: ${err.message}`);

            // Track Gemini circuit breaker failures
            if (selectedProvider === "gemini") {
                circuitBreaker.failureCount += 1;
                if (circuitBreaker.failureCount >= aiConfig.circuitBreaker.failureThreshold) {
                    circuitBreaker.state = "OPEN";
                    circuitBreaker.lastFailureTime = Date.now();
                    logger.error(`[AI Gateway] Circuit breaker tripped to OPEN for Gemini. Threshold reached.`);
                }
            }
        }
    }

    const totalLatency = Date.now() - startTime;

    if (!success) {
        logGatewayEvent({
            success: false,
            task: taskName,
            provider: chain.join("->"),
            model: "fallback-sequence",
            latency: totalLatency,
            cacheStatus: "MISS",
            fallbackUsed: fallbackTriggered,
            failureReason: errors.join(" | ")
        });

        const normErr = new Error(`AI Gateway execution failed for task '${taskName}' on all attempted providers: ${errors.join(" | ")}`);
        normErr.status = 500;
        normErr.code = "GATEWAY_FALLBACK_FAILURE";
        normErr.provider = primaryProvider;
        normErr.latency = totalLatency;
        normErr.timestamp = new Date().toISOString();
        throw normErr;
    }

    finalResponse.latency = totalLatency;

    logGatewayEvent({
        success: true,
        task: taskName,
        provider: finalResponse.provider,
        model: finalResponse.model,
        latency: totalLatency,
        cacheStatus: "MISS",
        fallbackUsed: fallbackTriggered
    });

    // Populate Cache if applicable
    if (isCacheable && cacheKey && finalResponse.success) {
        responseCache.set(cacheKey, {
            response: finalResponse,
            timestamp: Date.now()
        });
    }

    return finalResponse;
}



/**
 * Diagnostics Health Query.
 */
function getHealthStatus() {
    return {
        gemini: {
            configuredModel: aiConfig.providers.gemini.primaryModel,
            status: circuitBreaker.state === "OPEN" ? "Unavailable (Circuit Open)" : "Healthy",
            state: circuitBreaker.state,
            failureCount: circuitBreaker.failureCount
        },
        groq: {
            configuredModel: aiConfig.providers.groq.primaryModel,
            status: aiConfig.keys.groq ? "Healthy" : "Unconfigured"
        },
        sarvam: {
            configuredModel: `STT: ${aiConfig.providers.sarvam.sttModel} | TTS: ${aiConfig.providers.sarvam.ttsModel}`,
            status: aiConfig.keys.sarvam ? "Healthy" : "Unconfigured"
        },
        openrouter: {
            configuredModels: aiConfig.providers.openrouter.fallbackModels,
            status: aiConfig.keys.openrouter ? "Healthy" : "Unconfigured"
        }
    };
}

module.exports = {
    routeTask,
    getHealthStatus
};
