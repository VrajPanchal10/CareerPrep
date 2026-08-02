import { useState, useEffect, useMemo, useRef } from 'react';
import { requestOnDemandTranslation } from '../services/voice.api';

// In-Memory Client-side Translation Cache
const clientTranslationCache = new Map();

/**
 * Hook to instantly derive translations from session state with fallback on-demand fetching.
 * Eliminates all network delay when switching languages.
 */
export function useTranslation(session, currentQIndex, voiceLanguage) {
    const [dynamicTranslations, setDynamicTranslations] = useState({});
    const [isTranslating, setIsTranslating] = useState(false);
    const activeFetchingRef = useRef(new Set());

    const currentQ = session?.questions?.[currentQIndex];
    const currentQText = currentQ?.questionText;
    const sessionId = session?._id;

    // Fetch translation dynamically if missing from session payload
    useEffect(() => {
        if (!currentQText || voiceLanguage === "en-IN") {
            setIsTranslating(false);
            return;
        }

        const cacheKey = `${voiceLanguage}:${currentQText}`;
        const hasSessionTrans = currentQ?.translations?.[voiceLanguage]?.status === "completed";
        const hasLocalTrans = !!dynamicTranslations[cacheKey] || clientTranslationCache.has(cacheKey);

        if (hasSessionTrans || hasLocalTrans) {
            setIsTranslating(false);
            return;
        }

        if (activeFetchingRef.current.has(cacheKey)) {
            return;
        }

        activeFetchingRef.current.add(cacheKey);
        setIsTranslating(true);

        requestOnDemandTranslation({
            text: currentQText,
            targetLanguage: voiceLanguage,
            sessionId,
            questionIndex: currentQIndex
        }).then((data) => {
            if (data.success && data.translatedText) {
                clientTranslationCache.set(cacheKey, data.translatedText);
                setDynamicTranslations(prev => ({ ...prev, [cacheKey]: data.translatedText }));
            }
        }).catch((err) => {
            console.error("[useTranslation] On-demand translation failed:", err);
        }).finally(() => {
            setIsTranslating(false);
            activeFetchingRef.current.delete(cacheKey);
        });

    }, [currentQText, voiceLanguage, sessionId, currentQIndex, currentQ, dynamicTranslations]);

    const { displayQuestion, displayEvaluation, displayFollowUpNotification } = useMemo(() => {
        if (!session || !session.questions || !session.questions[currentQIndex]) {
            return { displayQuestion: "", displayEvaluation: null, displayFollowUpNotification: "" };
        }

        const q = session.questions[currentQIndex];
        const currentE = session.evaluations?.find(e => e.questionIndex === currentQIndex);

        // 1. Derive Question Translation
        let displayQuestion = q.questionText;
        if (voiceLanguage !== "en-IN") {
            const cacheKey = `${voiceLanguage}:${q.questionText}`;
            const langData = q.translations?.[voiceLanguage];

            if (langData && langData.status === "completed" && langData.text) {
                displayQuestion = langData.text;
            } else if (dynamicTranslations[cacheKey]) {
                displayQuestion = dynamicTranslations[cacheKey];
            } else if (clientTranslationCache.has(cacheKey)) {
                displayQuestion = clientTranslationCache.get(cacheKey);
            }
        }

        // 2. Derive Evaluation Translation
        let displayEvaluation = null;
        if (currentE) {
            displayEvaluation = { ...currentE };
            if (voiceLanguage !== "en-IN" && currentE.translations) {
                const langData = currentE.translations[voiceLanguage];
                if (langData && langData.status === "completed") {
                    displayEvaluation.strengths = (langData.strengths && langData.strengths.length > 0) 
                        ? langData.strengths 
                        : displayEvaluation.strengths;
                    displayEvaluation.weaknesses = (langData.weaknesses && langData.weaknesses.length > 0) 
                        ? langData.weaknesses 
                        : displayEvaluation.weaknesses;
                    displayEvaluation.suggestions = (langData.suggestions && langData.suggestions.length > 0) 
                        ? langData.suggestions 
                        : displayEvaluation.suggestions;
                }
            }
        }

        // 3. Follow Up Notification
        let displayFollowUpNotification = "";
        if (q.isFollowUp) {
            if (voiceLanguage === "hi-IN") {
                displayFollowUpNotification = "💡 अनुवर्ती: एआई साक्षात्कारकर्ता ने एक प्रासंगिक अनुवर्ती प्रश्न उत्पन्न किया है!";
            } else if (voiceLanguage === "gu-IN") {
                displayFollowUpNotification = "💡 ફોલો-અપ: એઆઈ ઇન્ટરવ્યુઅરએ સંબંધિત ફોલો-અપ પ્રશ્ન બનાવ્યો છે!";
            } else {
                displayFollowUpNotification = "💡 Follow-up: The AI interviewer has generated a contextual follow-up question!";
            }
        }

        return { displayQuestion, displayEvaluation, displayFollowUpNotification };
    }, [session, currentQIndex, voiceLanguage, dynamicTranslations]);

    return { displayQuestion, displayEvaluation, displayFollowUpNotification, isTranslating };
}

