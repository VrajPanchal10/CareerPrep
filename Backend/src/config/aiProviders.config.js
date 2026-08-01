/**
 * CareerPrep AI Gateway & Providers Configuration
 */

module.exports = {
    // API Keys mapped from process.env
    keys: {
        gemini: process.env.GOOGLE_GENAI_API_KEY,
        // Support both casings for GROQ API Key
        groq: process.env.GROQ_API_KEY || process.env.Groq_API_KEY,
        openrouter: process.env.OPENROUTER_API_KEY,
        sarvam: process.env.SARVAM_API_KEY
    },

    // Endpoints for REST calls
    endpoints: {
        groq: "https://api.groq.com/openai/v1/chat/completions",
        openrouter: "https://openrouter.ai/api/v1/chat/completions",
        sarvamStt: "https://api.sarvam.ai/speech-to-text",
        sarvamTts: "https://api.sarvam.ai/text-to-speech"
    },

    // Provider settings
    providers: {
        gemini: {
            primaryModel: process.env.GEMINI_PRIMARY_MODEL || "gemini-2.5-flash",
            fallbackModel: process.env.GEMINI_FALLBACK_MODEL || "gemini-2.5-flash-lite",
            timeoutMs: parseInt(process.env.GEMINI_REQUEST_TIMEOUT_MS || "30000", 10),
            maxRetries: 2,
            backoffMs: [2000, 5000]
        },
        groq: {
            primaryModel: process.env.GROQ_PRIMARY_MODEL || "llama-3.3-70b-versatile",
            timeoutMs: parseInt(process.env.GROQ_REQUEST_TIMEOUT_MS || "20000", 10),
            maxRetries: 1,
            backoffMs: [1000]
        },
        sarvam: {
            sttModel: "saaras:v3",
            ttsModel: "bulbul:v3",
            timeoutMs: parseInt(process.env.SARVAM_REQUEST_TIMEOUT_MS || "20000", 10),
            maxRetries: 1,
            backoffMs: [1000]
        },
        openrouter: {
            // Ordered fallback list
            fallbackModels: [
                "anthropic/claude-3.5-sonnet:beta",
                "deepseek/deepseek-chat",
                "qwen/qwen-2.5-72b-instruct",
                "meta-llama/llama-3.3-70b-instruct"
            ],
            timeoutMs: parseInt(process.env.OPENROUTER_REQUEST_TIMEOUT_MS || "35000", 10),
            maxRetries: 0,
            backoffMs: []
        }
    },

    // Task to primary provider mapping
    routingTable: {
        atsResumeAnalysis: "gemini",
        resumeSuggestions: "gemini",
        weaknessHeatmap: "gemini",
        skillBreakdown: "gemini",
        githubRepositoryAnalysis: "gemini",
        projectDefense: "gemini",
        pdfReportGeneration: "gemini",
        liveVoiceInterview: "groq",
        voiceFollowup: "groq",
        speechToText: "sarvam",
        textToSpeech: "sarvam"
    },

    // Optional Response Cache settings
    cache: {
        enabled: true,
        // Cache lifetime in milliseconds (e.g. 1 hour)
        ttlMs: 60 * 60 * 1000
    },

    // Circuit Breaker settings
    circuitBreaker: {
        // Number of consecutive failures before opening the circuit for Gemini
        failureThreshold: 3,
        // Time in milliseconds to wait before attempting to restore Gemini (e.g. 60 seconds)
        recoveryTimeoutMs: 60 * 1000
    }
};
