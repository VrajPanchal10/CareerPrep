const translationModel = require("../models/translation.model");
const voiceSessionModel = require("../models/voiceSession.model");
const gateway = require("./aiGateway.service");
const { logger } = require("../utils/securityLogger");

// In-Memory Translation Cache: Map<cacheKey, translatedText>
const translationCache = new Map();

/**
 * Maps language codes/prefixes to human-readable names
 */
function resolveLanguageName(langCode) {
    if (!langCode) return "English";
    const code = langCode.toLowerCase();
    if (code.startsWith("hi")) return "Hindi";
    if (code.startsWith("gu")) return "Gujarati";
    if (code.startsWith("mr")) return "Marathi";
    if (code.startsWith("ta")) return "Tamil";
    if (code.startsWith("te")) return "Telugu";
    if (code.startsWith("kn")) return "Kannada";
    if (code.startsWith("bn")) return "Bengali";
    return "English";
}

/**
 * Translate text to target language with double-layer caching & single execution guarantee
 */
async function translateText(text, targetLanguage) {
    if (!text || typeof text !== "string" || text.trim() === "") {
        return text || "";
    }

    const langName = resolveLanguageName(targetLanguage);
    if (langName === "English" || targetLanguage?.startsWith("en")) {
        return text;
    }

    const normalizedSource = text.trim();
    const cacheKey = `${targetLanguage}:${normalizedSource}`;

    // 1. Layer 1: In-Memory Cache Lookup (<1ms)
    if (translationCache.has(cacheKey)) {
        return translationCache.get(cacheKey);
    }

    try {
        // 2. Layer 2: MongoDB Persistent Cache Lookup (<10ms)
        const dbCached = await translationModel.findOne({ sourceText: normalizedSource, targetLanguage });
        if (dbCached && dbCached.translatedText) {
            translationCache.set(cacheKey, dbCached.translatedText);
            return dbCached.translatedText;
        }

        // 3. Layer 3: AI Gateway Route Task for Translation
        const prompt = `Translate the following professional interview text into natural, highly professional, grammatically correct, and contextually accurate ${langName}.
Keep technical terms (such as REST API, React, Node.js, JWT, MongoDB, SQL, AWS, Docker) in standard Roman technical form if standard in ${langName}.
Translate ONLY the text itself. Do not include any intro, notes, explanations, or quotes.

Original Text:
"${normalizedSource}"`;

        let translated = null;

        // Attempt 1
        try {
            const response = await gateway.routeTask("liveVoiceInterview", { prompt }, { temperature: 0.1 });
            if (response && response.output && typeof response.output === "string") {
                translated = response.output.trim().replace(/^"|"$/g, "");
            }
        } catch (attempt1Err) {
            logger.warn(`[Translation] Attempt 1 failed for target ${langName}: ${attempt1Err.message}`);
        }

        // Attempt 2 Retry Fallback if Attempt 1 returned empty/failed
        if (!translated || translated === normalizedSource) {
            try {
                const fallbackPrompt = `Translate to ${langName} exactly: "${normalizedSource}"`;
                const retryRes = await gateway.routeTask("liveVoiceInterview", { prompt: fallbackPrompt }, { temperature: 0.0 });
                if (retryRes && retryRes.output) {
                    translated = retryRes.output.trim().replace(/^"|"$/g, "");
                }
            } catch (retryErr) {
                logger.error(`[Translation] Attempt 2 Retry failed: ${retryErr.message}`);
            }
        }

        const finalTranslated = (translated && translated !== normalizedSource) 
            ? translated 
            : normalizedSource;

        // Save to Persistent MongoDB Cache
        if (finalTranslated && finalTranslated !== normalizedSource) {
            translationModel.create({
                sourceText: normalizedSource,
                targetLanguage,
                translatedText: finalTranslated
            }).catch(e => logger.warn(`[Translation Cache] Save failed: ${e.message}`));
        }

        // Save to In-Memory Cache
        translationCache.set(cacheKey, finalTranslated);
        return finalTranslated;

    } catch (err) {
        logger.error(`[Translation] Hard failure translating to ${langName}:`, err);
        return normalizedSource;
    }
}

/**
 * Translate candidate response to English
 */
async function translateToEnglish(text, sourceLanguage) {
    if (!text || typeof text !== "string" || text.trim() === "") {
        return text || "";
    }
    const sourceLangName = resolveLanguageName(sourceLanguage);
    if (sourceLangName === "English" || sourceLanguage?.startsWith("en")) {
        return text;
    }

    const normalizedSource = text.trim();
    const cacheKey = `en:${normalizedSource}`;

    if (translationCache.has(cacheKey)) {
        return translationCache.get(cacheKey);
    }

    try {
        const dbCached = await translationModel.findOne({ sourceText: normalizedSource, targetLanguage: "en" });
        if (dbCached && dbCached.translatedText) {
            translationCache.set(cacheKey, dbCached.translatedText);
            return dbCached.translatedText;
        }

        const prompt = `Translate the following candidate interview response from ${sourceLangName} into fluent professional English.
Translate ONLY the text itself. Do not include any introduction, explanations, notes, or surrounding quotes.

Original Text:
"${normalizedSource}"`;

        const response = await gateway.routeTask("liveVoiceInterview", { prompt }, { temperature: 0.1 });
        const translated = (response && response.output) ? response.output.trim().replace(/^"|"$/g, "") : normalizedSource;

        if (translated && translated !== normalizedSource) {
            translationModel.create({
                sourceText: normalizedSource,
                targetLanguage: "en",
                translatedText: translated
            }).catch(e => logger.warn(`[Translation Cache] Save failed: ${e.message}`));
        }

        translationCache.set(cacheKey, translated);
        return translated;

    } catch (err) {
        logger.error(`[Translation] Failed to translate from ${sourceLangName} to English:`, err);
        return normalizedSource;
    }
}

/**
 * Background worker to pre-generate and cache translations for questions
 */
async function preGenerateTranslationsAsync(sessionId, questions) {
    try {
        const questionsWithTranslations = await Promise.all(questions.map(async (q) => {
            const existingTranslations = q.translations || new Map();
            const translationsObj = existingTranslations instanceof Map 
                ? Object.fromEntries(existingTranslations) 
                : (existingTranslations || {});

            translationsObj["en-IN"] = { status: "completed", text: q.questionText };

            await Promise.all(["hi-IN", "gu-IN"].map(async (langCode) => {
                try {
                    const translatedText = await translateText(q.questionText, langCode);
                    translationsObj[langCode] = { status: "completed", text: translatedText };
                } catch (err) {
                    logger.error(`[Translation Engine] Failed to pre-translate to ${langCode}:`, err);
                    translationsObj[langCode] = { status: "failed", text: q.questionText };
                }
            }));

            return {
                ...q,
                translations: translationsObj
            };
        }));

        await voiceSessionModel.findByIdAndUpdate(sessionId, {
            $set: { questions: questionsWithTranslations }
        });
        logger.info(`[TranslationEngine] Pre-generated translations for session ${sessionId}`);
    } catch (error) {
        logger.error(`[TranslationEngine] Background translation failed for session ${sessionId}:`, error);
    }
}

module.exports = {
    translateText,
    translateToEnglish,
    preGenerateTranslationsAsync,
    resolveLanguageName
};

