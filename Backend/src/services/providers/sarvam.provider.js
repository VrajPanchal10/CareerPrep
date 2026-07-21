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
 * Handles STT/TTS routing.
 */
async function execute(payload, options = {}) {
    const task = options.task || payload.task;
    if (task === "speechToText") {
        return executeSTT(payload, options);
    } else if (task === "textToSpeech") {
        return executeTTS(payload, options);
    } else {
        throw new Error(`Unsupported Sarvam task type: ${task}`);
    }
}

/**
 * Speech to Text REST invocation.
 */
async function executeSTT(payload, options) {
    const providerConfig = aiConfig.providers.sarvam;
    const timeoutMs = options.timeoutMs || providerConfig.timeoutMs;
    const maxRetries = providerConfig.maxRetries;
    const backoffMs = providerConfig.backoffMs;

    const startTime = Date.now();
    let attempt = 1;
    const maxAttempts = 1 + maxRetries;
    let lastError = null;

    if (!aiConfig.keys.sarvam) {
        throw new Error("SARVAM_API_KEY is not configured.");
    }

    while (attempt <= maxAttempts) {
        try {
            const formData = new globalThis.FormData();
            
            const buffer = payload.fileBuffer || payload.file?.buffer;
            const filename = payload.filename || "audio.wav";
            const mimeType = payload.mimetype || "audio/wav";

            if (!buffer) {
                throw new Error("Audio buffer is missing in payload for speechToText.");
            }

            const blob = new globalThis.Blob([buffer], { type: mimeType });
            formData.append("file", blob, filename);
            formData.append("model", providerConfig.sttModel);
            formData.append("language_code", payload.languageCode || "en-IN");
            formData.append("mode", "transcribe");

            const response = await withTimeout(
                fetch(aiConfig.endpoints.sarvamStt, {
                    method: "POST",
                    headers: {
                        "api-subscription-key": aiConfig.keys.sarvam
                    },
                    body: formData
                }),
                timeoutMs,
                `Sarvam STT timed out after ${timeoutMs / 1000}s`
            );

            if (!response.ok) {
                let errMsg = `Sarvam STT returned HTTP ${response.status}`;
                try {
                    const errText = await response.text();
                    logger.error("[Sarvam Provider] [STT Stage] Error details:", { errorDetails: errText });
                    const errData = JSON.parse(errText);
                    errMsg = errData.message || (errData.error && errData.error.message) || errMsg;
                } catch (_) {}
                const error = new Error(errMsg);
                error.status = response.status;
                throw error;
            }

            const data = await response.json();
            const duration = Date.now() - startTime;

            return {
                success: true,
                provider: "sarvam",
                model: providerConfig.sttModel,
                output: {
                    transcript: data.transcript || ""
                },
                usage: null,
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
    return {
        success: false,
        provider: "sarvam",
        model: providerConfig.sttModel,
        output: null,
        usage: null,
        latency: duration,
        error: {
            message: lastError.message || "Failed to transcribe audio via Sarvam",
            status: lastError.status || 500,
            code: "PROVIDER_ERROR",
            timestamp: new Date().toISOString()
        }
    };
}

/**
 * Text to Speech REST invocation.
 */
async function executeTTS(payload, options) {
    const providerConfig = aiConfig.providers.sarvam;
    const timeoutMs = options.timeoutMs || providerConfig.timeoutMs;
    const maxRetries = providerConfig.maxRetries;
    const backoffMs = providerConfig.backoffMs;

    const startTime = Date.now();
    let attempt = 1;
    const maxAttempts = 1 + maxRetries;
    let lastError = null;

    if (!aiConfig.keys.sarvam) {
        throw new Error("SARVAM_API_KEY is not configured.");
    }

    const supportedSpeakers = [
        "anushka", "abhilash", "manisha", "vidya", "arya", "karun", "hitesh", 
        "aditya", "ritu", "priya", "neha", "rahul", "pooja", "rohan", "simran", 
        "kavya", "amit", "dev", "ishita", "shreya", "ratan", "varun", "manan", 
        "sumit", "roopa", "kabir", "aayan", "shubh", "ashutosh", "advait", 
        "anand", "tanya", "tarun", "sunny", "mani", "gokul", "vijay", "shruti", 
        "suhani", "mohit", "kavitha", "rehan", "soham", "rupali"
    ];

    while (attempt <= maxAttempts) {
        try {
            let speaker = payload.speaker ? payload.speaker.toLowerCase() : "";
            if (!speaker) {
                speaker = payload.gender === "male" ? "shubh" : "shreya";
            }
            
            // If the selected speaker is not supported by Sarvam, map it dynamically to a working one of same gender
            if (!supportedSpeakers.includes(speaker)) {
                logger.debug(`[Sarvam Provider] Speaker '${speaker}' is not supported. Mapping dynamic fallback based on gender: ${payload.gender || "female"}`);
                speaker = payload.gender === "male" ? "shubh" : "shreya";
            }

            const body = {
                text: payload.text,
                target_language_code: payload.languageCode || "en-IN",
                speaker: speaker,
                model: providerConfig.ttsModel,
                pace: payload.speed || 1.0
            };

            logger.debug(`[Sarvam Provider] [TTS Stage] Sending REST request to endpoint: ${aiConfig.endpoints.sarvamTts}`);
            logger.debug(`[Sarvam Provider] [TTS Stage] Request Body: ${JSON.stringify(body)}`);

            const response = await withTimeout(
                fetch(aiConfig.endpoints.sarvamTts, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "api-subscription-key": aiConfig.keys.sarvam
                    },
                    body: JSON.stringify(body)
                }),
                timeoutMs,
                `Sarvam TTS timed out after ${timeoutMs / 1000}s`
            );

            logger.debug(`[Sarvam Provider] [TTS Stage] Response Status: ${response.status}`);

            if (!response.ok) {
                let errMsg = `Sarvam TTS returned HTTP ${response.status}`;
                try {
                    const errText = await response.text();
                    logger.error("[Sarvam Provider] [TTS Stage] Error details:", { errorDetails: errText });
                    const errData = JSON.parse(errText);
                    errMsg = errData.message || (errData.error && errData.error.message) || errMsg;
                } catch (_) {}
                const error = new Error(errMsg);
                error.status = response.status;
                throw error;
            }

            const data = await response.json();
            logger.debug(`[Sarvam Provider] [TTS Stage] Success! Number of audio tracks returned: ${data.audios ? data.audios.length : 0}`);
            const duration = Date.now() - startTime;

            return {
                success: true,
                provider: "sarvam",
                model: providerConfig.ttsModel,
                output: {
                    audios: data.audios || []
                },
                usage: null,
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
    return {
        success: false,
        provider: "sarvam",
        model: providerConfig.ttsModel,
        output: null,
        usage: null,
        latency: duration,
        error: {
            message: lastError.message || "Failed to generate speech via Sarvam",
            status: lastError.status || 500,
            code: "PROVIDER_ERROR",
            timestamp: new Date().toISOString()
        }
    };
}

module.exports = {
    execute
};
