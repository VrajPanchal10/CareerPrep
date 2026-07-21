import { useMemo } from 'react';

/**
 * Hook to instantly derive translations from the loaded session state.
 * Eliminates all network delay when switching languages.
 */
export function useTranslation(session, currentQIndex, voiceLanguage) {
    const { displayQuestion, displayEvaluation, displayFollowUpNotification } = useMemo(() => {
        if (!session || !session.questions || !session.questions[currentQIndex]) {
            return { displayQuestion: "", displayEvaluation: null, displayFollowUpNotification: "" };
        }

        const currentQ = session.questions[currentQIndex];
        const currentE = session.evaluations?.find(e => e.questionIndex === currentQIndex);

        // 1. Derive Question Translation
        let displayQuestion = currentQ.questionText;
        if (voiceLanguage !== "en-IN" && currentQ.translations) {
            // Mongoose maps come across as objects in the JSON payload
            const langData = currentQ.translations[voiceLanguage];
            if (langData && langData.status === "completed" && langData.text) {
                displayQuestion = langData.text;
            }
        }

        // 2. Derive Evaluation Translation
        let displayEvaluation = null;
        if (currentE) {
            displayEvaluation = { ...currentE };
            if (voiceLanguage !== "en-IN" && currentE.translations) {
                const langData = currentE.translations[voiceLanguage];
                if (langData && langData.status === "completed") {
                    displayEvaluation.strengths = langData.strengths || displayEvaluation.strengths;
                    displayEvaluation.weaknesses = langData.weaknesses || displayEvaluation.weaknesses;
                    displayEvaluation.suggestions = langData.suggestions || displayEvaluation.suggestions;
                }
            }
        }

        // 3. Follow Up Notification
        let displayFollowUpNotification = "";
        if (currentQ.isFollowUp) {
            if (voiceLanguage === "hi-IN") {
                displayFollowUpNotification = "💡 अनुवर्ती: एआई साक्षात्कारकर्ता ने एक प्रासंगिक अनुवर्ती प्रश्न उत्पन्न किया है!";
            } else if (voiceLanguage === "gu-IN") {
                displayFollowUpNotification = "💡 ફોલો-અપ: એઆઈ ઇન્ટરવ્યુઅરએ સંબંધિત ફોલો-અપ પ્રશ્ન બનાવ્યો છે!";
            } else {
                displayFollowUpNotification = "💡 Follow-up: The AI interviewer has generated a contextual follow-up question!";
            }
        }

        return { displayQuestion, displayEvaluation, displayFollowUpNotification };
    }, [session, currentQIndex, voiceLanguage]);

    return { displayQuestion, displayEvaluation, displayFollowUpNotification };
}
