const translationModel = require("../models/translation.model");
const voiceSessionModel = require("../models/voiceSession.model");
const gateway = require("./aiGateway.service");
const { logger } = require("../utils/securityLogger");

const translationCache = new Map();

/**
 * Translate text to target language (Hindi or Gujarati)
 */
async function translateText(text, targetLanguage) {
    if (!text || !targetLanguage || targetLanguage.startsWith("en")) {
        return text;
    }
    const cacheKey = `${targetLanguage}:${text}`;
    if (translationCache.has(cacheKey)) {
        return translationCache.get(cacheKey);
    }

    try {
        const dbCached = await translationModel.findOne({ sourceText: text, targetLanguage });
        if (dbCached) {
            translationCache.set(cacheKey, dbCached.translatedText);
            return dbCached.translatedText;
        }

        const langName = targetLanguage.startsWith("hi") ? "Hindi" : "Gujarati";
        const prompt = `Translate the following professional interview text into natural, highly professional, grammatically correct, and contextually accurate ${langName}.
Translate ONLY the text itself. Do not include any introduction, explanations, notes, or surrounding quotes.
Original Text:
"${text}"`;

        const response = await gateway.routeTask("liveVoiceInterview", { prompt }, {
            temperature: 0.1
        });
        const translated = (response && response.output) ? response.output.trim().replace(/^"|"$/g, "") : text;
        
        if (translated !== text) {
            translationModel.create({
                sourceText: text,
                targetLanguage,
                translatedText: translated
            }).catch(e => logger.warn(`[Translation Persistent Cache] Save failed: ${e.message}`));
        }

        translationCache.set(cacheKey, translated);
        return translated;
    } catch (err) {
        logger.error(`[Translation] Failed to translate to target:`, err);
        return text;
    }
}

/**
 * Translate text to English from Hindi or Gujarati
 */
async function translateToEnglish(text, sourceLanguage) {
    if (!text || !sourceLanguage || sourceLanguage.startsWith("en")) {
        return text;
    }
    const cacheKey = `en:${text}`;
    if (translationCache.has(cacheKey)) {
        return translationCache.get(cacheKey);
    }

    try {
        const dbCached = await translationModel.findOne({ sourceText: text, targetLanguage: "en" });
        if (dbCached) {
            translationCache.set(cacheKey, dbCached.translatedText);
            return dbCached.translatedText;
        }

        const langName = sourceLanguage.startsWith("hi") ? "Hindi" : "Gujarati";
        const prompt = `Translate the following professional candidate interview response from ${langName} into English.
Translate ONLY the text itself. Do not include any introduction, explanations, notes, or surrounding quotes.
Original Text:
"${text}"`;

        const response = await gateway.routeTask("liveVoiceInterview", { prompt }, {
            temperature: 0.1
        });
        const translated = (response && response.output) ? response.output.trim().replace(/^"|"$/g, "") : text;
        
        if (translated !== text) {
            translationModel.create({
                sourceText: text,
                targetLanguage: "en",
                translatedText: translated
            }).catch(e => logger.warn(`[Translation Persistent Cache] Save failed: ${e.message}`));
        }

        translationCache.set(cacheKey, translated);
        return translated;
    } catch (err) {
        logger.error(`[Translation] Failed to translate to English:`, err);
        return text;
    }
}

/**
 * Background worker to asynchronously pre-generate and save translations to the DB.
 */
async function preGenerateTranslationsAsync(sessionId, questions) {
    try {
        const questionsWithTranslations = await Promise.all(questions.map(async (q) => {
            const translations = {
                "en-IN": { status: "completed", text: q.questionText }
            };
            
            await Promise.all(["hi-IN", "gu-IN"].map(async (langCode) => {
                const translateLang = langCode.split("-")[0];
                try {
                    const translatedText = await translateText(q.questionText, translateLang);
                    translations[langCode] = { status: "completed", text: translatedText };
                } catch (err) {
                    logger.error(`Failed to translate to ${langCode}:`, err);
                    translations[langCode] = { status: "failed", text: "" };
                }
            }));
            
            return {
                ...q,
                translations
            };
        }));

        await voiceSessionModel.findByIdAndUpdate(sessionId, {
            $set: { questions: questionsWithTranslations }
        });
        logger.info(`[TranslationEngine] Successfully pre-generated translations for session ${sessionId}`);
    } catch (error) {
        logger.error(`[TranslationEngine] Background translation failed for session ${sessionId}:`, error);
    }
}

module.exports = {
    translateText,
    translateToEnglish,
    preGenerateTranslationsAsync
};
