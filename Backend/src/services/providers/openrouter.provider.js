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
 * Executes a text generation task via OpenRouter API.
 * Iterates through configured fallback models sequentially.
 */
async function execute(payload, options = {}) {
    const providerConfig = aiConfig.providers.openrouter;
    const models = options.fallbackModels || providerConfig.fallbackModels;
    const timeoutMs = options.timeoutMs || providerConfig.timeoutMs;

    const startTime = Date.now();
    let lastError = null;

    if (!aiConfig.keys.openrouter) {
        throw new Error("OPENROUTER_API_KEY is not configured.");
    }

    for (const model of models) {
        const modelStart = Date.now();
        logger.debug(`[OpenRouter Fallback] Attempting fallback model: '${model}'`);
        try {
            const body = {
                model: model,
                messages: [
                    { role: "user", content: payload.prompt }
                ],
                temperature: options.temperature !== undefined ? options.temperature : 0.3
            };

            if (options.jsonMode) {
                body.response_format = { type: "json_object" };
            }

            const response = await withTimeout(
                fetch(aiConfig.endpoints.openrouter, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${aiConfig.keys.openrouter}`,
                        "HTTP-Referer": "http://localhost:3000",
                        "X-Title": "CareerPrep"
                    },
                    body: JSON.stringify(body)
                }),
                timeoutMs,
                `OpenRouter timed out for model ${model} after ${timeoutMs / 1000}s`
            );

            if (!response.ok) {
                let errMsg = `OpenRouter API returned HTTP ${response.status} for model ${model}`;
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
                    throw new Error(`Failed to parse OpenRouter output for model ${model} as JSON.`);
                }
            }

            const duration = Date.now() - startTime;
            logger.debug(`[OpenRouter Fallback] Succeeded using model '${model}' in ${Date.now() - modelStart}ms.`);
            return {
                success: true,
                provider: "openrouter",
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
            logger.error(`[OpenRouter Fallback] Model '${model}' failed: ${err.message}`, err);
            lastError = err;
            // Continue to the next fallback model in the list
        }
    }

    const duration = Date.now() - startTime;
    return {
        success: false,
        provider: "openrouter",
        model: models.join(" -> "),
        output: null,
        usage: null,
        latency: duration,
        error: {
            message: lastError ? lastError.message : "All OpenRouter fallback models failed",
            status: lastError?.status || 500,
            code: "PROVIDER_ERROR",
            timestamp: new Date().toISOString()
        }
    };
}

module.exports = {
    execute
};
