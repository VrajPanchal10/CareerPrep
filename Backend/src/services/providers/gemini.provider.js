const { GoogleGenAI } = require("@google/genai");
const aiConfig = require("../../config/aiProviders.config");
const { logger } = require("../../utils/securityLogger");

let client = null;
function getClient() {
    if (!client) {
        if (!aiConfig.keys.gemini) {
            throw new Error("GOOGLE_GENAI_API_KEY is not configured.");
        }
        client = new GoogleGenAI({
            apiKey: aiConfig.keys.gemini
        });
    }
    return client;
}

function withTimeout(promise, ms, errorMessage = "Request timed out") {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(errorMessage));
        }, ms);
    });
    return Promise.race([
        promise.then((res) => {
            clearTimeout(timeoutId);
            return res;
        }),
        timeoutPromise
    ]);
}

/**
 * Executes a text generation task via Gemini API.
 * Supports primary/fallback model progression, retries, and formatting.
 */
async function execute(payload, options = {}) {
    const providerConfig = aiConfig.providers.gemini;
    const primaryModel = options.model || providerConfig.primaryModel;
    const fallbackModel = providerConfig.fallbackModel;
    const timeoutMs = options.timeoutMs || providerConfig.timeoutMs;
    
    const startTime = Date.now();
    const clientInstance = getClient();
    
    let currentModel = primaryModel;
    let attempt = 1;
    const maxAttempts = 1 + providerConfig.maxRetries; // 1 initial + 2 retries = 3 total
    let lastError = null;

    while (true) {
        const attemptStart = Date.now();
        try {
            const geminiConfig = {};
            if (options.jsonMode) {
                geminiConfig.responseMimeType = "application/json";
                if (options.responseSchema) {
                    geminiConfig.responseSchema = options.responseSchema;
                }
            }

            const response = await withTimeout(
                clientInstance.models.generateContent({
                    model: currentModel,
                    contents: payload.prompt,
                    config: geminiConfig
                }),
                timeoutMs,
                `Gemini API request timed out after ${timeoutMs / 1000}s`
            );

            const duration = Date.now() - startTime;
            
            // Success normalization
            let outputText = response.text;
            let parsedOutput = outputText;
            if (options.jsonMode) {
                try {
                    parsedOutput = JSON.parse(outputText);
                } catch (e) {
                    // If parsing fails but jsonMode is requested, throw so it retries/normalizes
                    throw new Error("Failed to parse Gemini output as JSON.");
                }
            }

            logger.debug("Gemini text generation complete", { model: currentModel, latencyMs: duration });

            return {
                success: true,
                provider: "gemini",
                model: currentModel,
                output: parsedOutput,
                usage: {
                    promptTokens: response.usageMetadata?.promptTokenCount || 0,
                    completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
                    totalTokens: response.usageMetadata?.totalTokenCount || 0
                },
                latency: duration,
                error: null
            };

        } catch (err) {
            const attemptDuration = Date.now() - attemptStart;
            lastError = err;

            const status = err.status || err.code || (err.message && err.message.includes("timed out") ? "TIMEOUT" : "UNKNOWN");
            const isTimeout = status === "TIMEOUT" || err.message?.toLowerCase().includes("timeout");
            const isRetryable = [429, 503, 500, "UNAVAILABLE", "RESOURCE_EXHAUSTED", "INTERNAL"].includes(status) || isTimeout;

            if (isRetryable && attempt < maxAttempts) {
                const waitMs = providerConfig.backoffMs[attempt - 1] || 2000;
                await new Promise(r => setTimeout(r, waitMs));
                attempt++;
            } else {
                // If primary model failed all retries, switch to fallback model (lite version) if it's different
                if (currentModel === primaryModel && fallbackModel && primaryModel !== fallbackModel) {
                    currentModel = fallbackModel;
                    attempt = 1; // Reset attempt counter for fallback model
                } else {
                    break; // break and return error
                }
            }
        }
    }

    const duration = Date.now() - startTime;
    logger.warn("Gemini text generation failed", { model: currentModel, error: lastError?.message });
    return {
        success: false,
        provider: "gemini",
        model: currentModel,
        output: null,
        usage: null,
        latency: duration,
        error: {
            message: lastError.message || "Failed to generate content from Gemini",
            status: lastError.status || lastError.code || 500,
            code: "PROVIDER_ERROR",
            timestamp: new Date().toISOString()
        }
    };
}

module.exports = {
    execute
};
