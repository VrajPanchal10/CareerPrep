const aiConfig = require("../../config/aiProviders.config");
const { logger } = require("../../utils/securityLogger");

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
 * Executes a text generation task via Groq API.
 */
async function execute(payload, options = {}) {
    const providerConfig = aiConfig.providers.groq;
    const model = options.model || providerConfig.primaryModel;
    const timeoutMs = options.timeoutMs || providerConfig.timeoutMs;
    const maxRetries = providerConfig.maxRetries;
    const backoffMs = providerConfig.backoffMs;

    const startTime = Date.now();
    let attempt = 1;
    const maxAttempts = 1 + maxRetries;
    let lastError = null;

    if (!aiConfig.keys.groq) {
        throw new Error("GROQ_API_KEY is not configured.");
    }

    while (attempt <= maxAttempts) {
        const attemptStart = Date.now();
        try {
            const body = {
                model: model,
                messages: [
                    { role: "user", content: payload.prompt }
                ],
                temperature: options.temperature !== undefined ? options.temperature : 0.2
            };

            if (options.jsonMode) {
                body.response_format = { type: "json_object" };
            }

            const response = await withTimeout(
                fetch(aiConfig.endpoints.groq, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${aiConfig.keys.groq}`
                    },
                    body: JSON.stringify(body)
                }),
                timeoutMs,
                `Groq request timed out after ${timeoutMs / 1000}s`
            );

            if (!response.ok) {
                let errMsg = `Groq API returned HTTP ${response.status}`;
                try {
                    const errData = await response.json();
                    errMsg = errData.error?.message || errData.message || errMsg;
                } catch (_) {}
                const error = new Error(errMsg);
                error.status = response.status;
                throw error;
            }

            const data = await response.json();
            const text = data.choices?.[0]?.message?.content || "";

            let parsedOutput = text;
            if (options.jsonMode) {
                try {
                    parsedOutput = JSON.parse(text);
                } catch (e) {
                    throw new Error("Failed to parse Groq output as JSON.");
                }
            }

            const duration = Date.now() - startTime;
            logger.debug("Groq text generation complete", { model: model, latencyMs: duration });

            return {
                success: true,
                provider: "groq",
                model: model,
                output: parsedOutput,
                usage: {
                    promptTokens: data.usage?.prompt_tokens || 0,
                    completionTokens: data.usage?.completion_tokens || 0,
                    totalTokens: data.usage?.total_tokens || 0
                },
                latency: duration,
                error: null
            };

        } catch (err) {
            lastError = err;
            const status = err.status || 500;
            const isTimeout = err.message?.toLowerCase().includes("timeout");
            const isRetryable = [429, 503, 500].includes(status) || isTimeout;

            if (isRetryable && attempt < maxAttempts) {
                const waitMs = backoffMs[attempt - 1] || 1000;
                await new Promise(r => setTimeout(r, waitMs));
                attempt++;
            } else {
                break;
            }
        }
    }

    const duration = Date.now() - startTime;
    logger.warn("Groq text generation failed", { model: model, error: lastError?.message });
    return {
        success: false,
        provider: "groq",
        model: model,
        output: null,
        usage: null,
        latency: duration,
        error: {
            message: lastError.message || "Failed to generate content from Groq",
            status: lastError.status || 500,
            code: "PROVIDER_ERROR",
            timestamp: new Date().toISOString()
        }
    };
}

module.exports = {
    execute
};
