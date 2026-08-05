const sessionService = require("./session.service");
const translationService = require("./translation.service");
const transcriptService = require("./transcript.service");
const evaluationService = require("./evaluation.service");
const analyticsService = require("./analytics.service");
const aiMemory = require("./aiMemory.service");
const { logger } = require("../utils/securityLogger");

/**
 * Voice orchestrator to process candidate verbal response answer submissions,
 * run multi-stage AI tasks, dynamic translations, context caching, and persistence.
 */
async function processVoiceAnswer({ sessionId, userId, questionIndex, userAnswer, responseTime, languageCode }) {
    // 1. Fetch Session and linked Interview Plan Report
    const session = await sessionService.getSessionById(sessionId, userId);
    if (!session) {
        throw new Error("Voice session not found or unauthorized.");
    }
    if (session.status === "completed") {
        throw new Error("Cannot submit answers to a completed session.");
    }

    const report = session.interviewReport;
    if (!report) {
        throw new Error("Linked interview report plan not found.");
    }

    const question = session.questions[questionIndex];
    if (!question) {
        throw new Error("Question not found at index.");
    }

    // 2. Transcript Normalization
    const normalizedUserAnswer = transcriptService.normalizeTranscript(userAnswer);

    // 3. Language Script Mismatch Check
    const languageMismatchWarning = transcriptService.checkLanguageMismatch(normalizedUserAnswer, languageCode);

    // 4. Translation to English if required
    let englishUserAnswer = normalizedUserAnswer;
    if (languageCode !== "en-IN") {
        logger.debug(`[Voice Orchestrator] Translating transcript to English...`);
        englishUserAnswer = await translationService.translateToEnglish(normalizedUserAnswer, languageCode);
    }

    // 5. Gather prior history and conversationMemory
    const previousAnswers = session.transcripts.map(t => {
        const matchingEval = session.evaluations.find(e => e.questionIndex === t.questionIndex);
        return {
            questionIndex: t.questionIndex,
            transcriptText: t.transcriptText,
            score: matchingEval ? matchingEval.overallScore : null
        };
    });

    const conversationMemory = session.conversationMemory || [];
    const userContext = await aiMemory.getUserContext(userId);

    // 6. Execute Advanced Answer Evaluation via Sub-Service
    logger.debug(`[Voice Orchestrator] Evaluating voice response for question index ${questionIndex}...`);
    const evalResult = await evaluationService.evaluateVoiceResponse({
        resume: report.resumeText || report.resume || "",
        jobRole: report.title || "Software Engineer",
        difficulty: session.difficulty,
        question: question.questionText,
        intention: question.intention,
        modelAnswer: question.answer,
        userAnswer: englishUserAnswer,
        topic: question.topic,
        previousAnswers,
        conversationMemory,
        userContext,
        responseTime,
        languageCode
    });

    if (!evalResult || typeof evalResult.overallScore !== "number") {
        throw new Error("Evaluation failed: AI could not evaluate the voice response.");
    }

    const overallScore = evalResult.overallScore;
    const communicationScore = evalResult.communicationScore;
    const clarityScore = evalResult.clarityScore;
    const technicalScore = evalResult.technicalScore;
    const explanationScore = evalResult.explanationScore;
    const technicalDepth = evalResult.technicalDepth;
    const completeness = evalResult.completeness;
    const relevance = evalResult.relevance;
    const communicationFlow = evalResult.communicationFlow;
    const grammarScore = evalResult.grammarScore;
    const fluencyScore = evalResult.fluencyScore;
    const responseStructure = evalResult.responseStructure || "STAR";
    const timeUtilization = evalResult.timeUtilization ?? 1.0;
    const fillerWords = evalResult.fillerWords || [];
    const confidenceIndicator = evalResult.confidenceIndicator || "Neutral";
    const strengths = evalResult.strengths || [];
    const weaknesses = evalResult.weaknesses || [];
    const suggestions = evalResult.suggestions || [];

    // 7. Update active Conversation Memory based on evaluated weaknesses
    weaknesses.forEach(w => {
        if (session.conversationMemory.length >= 10) {
            session.conversationMemory.shift(); // keep sliding memory limit
        }
        session.conversationMemory.push(w);
    });

    // 8. Pre-translate feedback details for zero-latency switches
    const evalTranslations = {
        "en-IN": { status: "completed", strengths, weaknesses, suggestions }
    };
    await Promise.all(["hi-IN", "gu-IN"].map(async (langCode) => {
        const translateLang = langCode.split("-")[0];
        try {
            const transStrengths = await Promise.all(strengths.map(s => translationService.translateText(s, translateLang)));
            const transWeaknesses = await Promise.all(weaknesses.map(w => translationService.translateText(w, translateLang)));
            const transSuggestions = await Promise.all(suggestions.map(s => translationService.translateText(s, translateLang)));
            evalTranslations[langCode] = { 
                status: "completed", 
                strengths: transStrengths, 
                weaknesses: transWeaknesses, 
                suggestions: transSuggestions 
            };
        } catch (err) {
            logger.error(`[Voice Orchestrator] Failed to translate evaluation to ${langCode}:`, err);
            evalTranslations[langCode] = { status: "failed", strengths: [], weaknesses: [], suggestions: [] };
        }
    }));

    // 9. Persist Transcript and Response Time
    const existingTransIdx = session.transcripts.findIndex(t => t.questionIndex === questionIndex);
    const transcriptObj = {
        questionIndex,
        transcriptText: normalizedUserAnswer,
        responseTime: Number(responseTime)
    };
    if (existingTransIdx > -1) {
        session.transcripts[existingTransIdx] = transcriptObj;
    } else {
        session.transcripts.push(transcriptObj);
    }

    // Persist Evaluation Results
    const existingEvalIdx = session.evaluations.findIndex(e => e.questionIndex === questionIndex);
    const evaluationObj = {
        questionIndex,
        overallScore,
        communicationScore,
        clarityScore,
        technicalScore,
        explanationScore,
        technicalDepth,
        completeness,
        relevance,
        communicationFlow,
        grammarScore,
        fluencyScore,
        responseStructure,
        timeUtilization,
        fillerWords,
        confidenceIndicator,
        strengths,
        weaknesses,
        suggestions,
        translations: evalTranslations
    };
    if (existingEvalIdx > -1) {
        session.evaluations[existingEvalIdx] = evaluationObj;
    } else {
        session.evaluations.push(evaluationObj);
    }

    // 10. Handle Contextual Follow-Up Generation (depth limit of 1 per question)
    let followUpQuestion = null;
    if (session.enableFollowUps && !question.isFollowUp) {
        const alreadyHasFollowUp = session.questions.some(q => q.isFollowUp && q.parentQuestionIndex === questionIndex);
        
        if (!alreadyHasFollowUp) {
            logger.debug("[Voice Orchestrator] Generating contextual follow-up...");
            const followUpCheck = await evaluationService.generateContextualFollowUp({
                question,
                userAnswer: englishUserAnswer
            });

            if (followUpCheck.hasFollowUp) {
                const qText = followUpCheck.questionText;
                
                const qTranslations = {
                    "en-IN": { status: "completed", text: qText }
                };
                await Promise.all(["hi-IN", "gu-IN"].map(async (langCode) => {
                    const translateLang = langCode.split("-")[0];
                    try {
                        const translated = await translationService.translateText(qText, translateLang);
                        qTranslations[langCode] = { status: "completed", text: translated };
                    } catch (err) {
                        logger.error(`[Voice Orchestrator] Failed to translate follow-up to ${langCode}:`, err);
                        qTranslations[langCode] = { status: "failed", text: "" };
                    }
                }));

                followUpQuestion = {
                    questionText: qText,
                    intention: followUpCheck.intention || "Probing the candidate further on their response.",
                    answer: followUpCheck.answer || "No specific model answer expected.",
                    topic: question.topic,
                    type: question.type,
                    isFollowUp: true,
                    parentQuestionIndex: questionIndex,
                    translations: qTranslations
                };

                // Inject follow-up immediately after the current question index
                session.questions.splice(questionIndex + 1, 0, followUpQuestion);
            }
        }
    }

    // Save MongoDB session
    await session.save();

    // Fire & Forget: Background pre-translation for next questions in session
    if (session.questions && questionIndex < session.questions.length - 1) {
        const remainingQuestions = session.questions.slice(questionIndex + 1);
        translationService.preGenerateTranslationsAsync(session._id, remainingQuestions).catch(err => {
            logger.warn(`[Voice Orchestrator] Background pre-translation for next questions failed: ${err.message}`);
        });
    }

    return {
        evaluation: evaluationObj,
        followUpQuestion,
        session,
        languageMismatchWarning
    };
}

module.exports = {
    processVoiceAnswer
};
