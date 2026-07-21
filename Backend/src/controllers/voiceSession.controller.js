const mongoose = require("mongoose");
const voiceSessionModel = require("../models/voiceSession.model");
const { generateVoiceSessionSummaryRecommendation } = require("../services/ai.service");
const { logger } = require("../utils/securityLogger");
const translationService = require("../services/translation.service");
const sessionService = require("../services/session.service");
const voiceOrchestrator = require("../services/voiceOrchestrator.service");
const gateway = require("../services/aiGateway.service");

/**
 * @description Start a new voice interview session.
 */
async function startSession(req, res, next) {
    try {
        const { interviewReportId, difficulty, enableFollowUps } = req.body;

        // 1. Input Validation
        if (!interviewReportId || !difficulty) {
            return res.status(400).json({
                success: false,
                message: "Interview Report ID and difficulty are required to start a voice session."
            });
        }

        if (!mongoose.Types.ObjectId.isValid(interviewReportId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid Interview Report ID."
            });
        }

        const allowedDifficulties = ["Easy", "Medium", "Hard"];
        if (!allowedDifficulties.includes(difficulty)) {
            return res.status(400).json({
                success: false,
                message: "Difficulty must be one of: Easy, Medium, Hard."
            });
        }

        // 2. Fetch linked Interview Report Plan
        const report = await sessionService.getInterviewReport(interviewReportId, req.user.id);
        if (!report) {
            return res.status(404).json({
                success: false,
                message: "Associated Interview Plan report not found."
            });
        }

        // 3. Assemble question list (up to 3 technical, 2 behavioral questions)
        const selectedQuestions = [];
        const reportTech = report.technicalQuestions || [];
        const reportBehav = report.behavioralQuestions || [];

        const techSlice = reportTech.slice(0, 3);
        const behavSlice = reportBehav.slice(0, 2);

        techSlice.forEach(q => {
            selectedQuestions.push({
                questionText: q.question,
                intention: q.intention,
                answer: q.answer,
                topic: q.topic || "General Technical",
                type: "technical",
                isFollowUp: false
            });
        });

        behavSlice.forEach(q => {
            selectedQuestions.push({
                questionText: q.question,
                intention: q.intention,
                answer: q.answer,
                topic: q.topic || "Behavioral",
                type: "behavioral",
                isFollowUp: false
            });
        });

        if (selectedQuestions.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Linked interview plan contains no questions."
            });
        }

        // 4. Create base session
        const session = await sessionService.createSession({
            userId: req.user.id,
            reportId: report._id,
            difficulty,
            enableFollowUps,
            questions: selectedQuestions
        });

        // 5. Fire and forget: Translation Engine pre-generates in background
        translationService.preGenerateTranslationsAsync(session._id, selectedQuestions);

        return res.status(201).json({
            success: true,
            message: "Voice interview session started successfully.",
            session
        });

    } catch (error) {
        logger.error("Error in startSession:", error);
        next(error);
    }
}

/**
 * @description Submit verbal response transcript for evaluation.
 */
async function submitAnswer(req, res, next) {
    try {
        const { sessionId, questionIndex, userAnswer, responseTime, languageCode } = req.body;

        // 1. Input Validation
        if (!sessionId || questionIndex === undefined || userAnswer === undefined || responseTime === undefined) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: sessionId, questionIndex, userAnswer, responseTime."
            });
        }

        if (!mongoose.Types.ObjectId.isValid(sessionId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid session ID."
            });
        }

        const result = await voiceOrchestrator.processVoiceAnswer({
            sessionId,
            userId: req.user.id,
            questionIndex,
            userAnswer,
            responseTime,
            languageCode
        });

        return res.status(200).json({
            success: true,
            message: "Answer evaluated successfully.",
            evaluation: result.evaluation,
            followUpQuestion: result.followUpQuestion,
            session: result.session,
            languageMismatchWarning: result.languageMismatchWarning
        });

    } catch (error) {
        logger.error("Error in submitAnswer:", error);

        if (error.name === "ValidationError") {
            const errors = Object.keys(error.errors).map(key => ({
                field: key,
                message: error.errors[key].message
            }));
            return res.status(400).json({
                success: false,
                message: "Validation failed: " + error.message,
                errors
            });
        }

        if (error.model || error.status) {
            const isUnavailable = [503, "UNAVAILABLE"].includes(error.status);
            return res.status(isUnavailable ? 503 : 502).json({
                success: false,
                message: isUnavailable 
                    ? "The AI service is currently busy. Please try again in a moment." 
                    : "The AI service encountered an error while evaluating your answer.",
                error: {
                    code: isUnavailable ? "AI_SERVICE_UNAVAILABLE" : "AI_SERVICE_ERROR",
                    status: error.status,
                    model: error.model,
                    timestamp: error.timestamp
                }
            });
        }

        next(error);
    }
}

/**
 * @description Complete the voice mock session and compile averages, strengths, weaknesses, and strategic advice.
 */
async function completeSession(req, res, next) {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid session ID."
            });
        }

        const session = await voiceSessionModel.findOne({ _id: id, user: req.user.id });
        if (!session) {
            return res.status(404).json({
                success: false,
                message: "Voice session not found."
            });
        }

        if (session.status === "completed") {
            return res.status(200).json({
                success: true,
                message: "Voice session is already completed.",
                session
            });
        }

        if (session.evaluations.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Cannot complete an interview session without submitting at least 1 answer."
            });
        }

        logger.debug(`[Voice Simulator] Generating summary recommendation advice for session ${session._id}...`);
        let topRecommendation = "";
        try {
            topRecommendation = await generateVoiceSessionSummaryRecommendation({
                evaluations: session.evaluations
            });
        } catch (recErr) {
            logger.error("Failed to generate career coach advice:", recErr);
            topRecommendation = "Structure responses with the STAR framework (Situation, Task, Action, Result) to state clear deliverables, and expand technical concepts using domain keywords.";
        }

        const completedSession = await sessionService.completeSessionDetails(session, topRecommendation);

        return res.status(200).json({
            success: true,
            message: "Voice mock interview session completed successfully.",
            session: completedSession
        });

    } catch (error) {
        logger.error("Error in completeSession:", error);
        next(error);
    }
}

/**
 * @description Get stats for the voice dashboard progress widgets and trends charts.
 */
async function getProgressStats(req, res, next) {
    try {
        const userId = req.user.id;

        // Fetch user completed voice sessions sorted chronologically
        const sessions = await voiceSessionModel.find({ user: userId, status: "completed" })
            .populate("interviewReport", "title")
            .sort({ createdAt: 1 });

        if (sessions.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No voice session records found.",
                stats: {
                    voiceReadinessScore: 0,
                    averageVoiceScore: 0,
                    averageCommunicationScore: 0,
                    averageTechnicalScore: 0,
                    recentSessions: [],
                    trends: []
                }
            });
        }

        // Calculate Averages
        let totalOverall = 0, totalComm = 0, totalTech = 0;
        sessions.forEach(s => {
            totalOverall += s.overallScore;
            totalComm += s.communicationScore;
            totalTech += s.technicalScore;
        });

        const numSessions = sessions.length;
        const averageVoiceScore = Math.round(totalOverall / numSessions);
        const averageCommunicationScore = Math.round(totalComm / numSessions);
        const averageTechnicalScore = Math.round(totalTech / numSessions);
        
        // Voice Readiness Score is the overallScore of the latest completed session
        const voiceReadinessScore = sessions[numSessions - 1].overallScore;

        // Recent Sessions (max 6, latest first)
        const recentSessions = [...sessions]
            .reverse()
            .slice(0, 6)
            .map(s => ({
                id: s._id,
                reportTitle: s.interviewReport?.title || "Target Position Plan",
                difficulty: s.difficulty,
                overallScore: s.overallScore,
                communicationScore: s.communicationScore,
                technicalScore: s.technicalScore,
                averageResponseTime: s.averageResponseTime,
                completedAt: s.completedAt || s.updatedAt
            }));

        // Improvement Trends (Session 1 -> Session 2 -> Session 3...)
        const trends = sessions.map((s, index) => ({
            sessionNumber: index + 1,
            overallScore: s.overallScore,
            communicationScore: s.communicationScore,
            technicalScore: s.technicalScore,
            date: s.completedAt || s.updatedAt
        }));

        return res.status(200).json({
            success: true,
            stats: {
                voiceReadinessScore,
                averageVoiceScore,
                averageCommunicationScore,
                averageTechnicalScore,
                recentSessions,
                trends
            }
        });

    } catch (error) {
        logger.error("Error in getProgressStats:", error);
        next(error);
    }
}

/**
 * @description Get detail of a specific session.
 */
async function getSessionById(req, res, next) {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid session ID."
            });
        }

        const session = await voiceSessionModel.findOne({ _id: id, user: req.user.id })
            .populate("interviewReport", "title");

        if (!session) {
            return res.status(404).json({
                success: false,
                message: "Voice session not found."
            });
        }

        return res.status(200).json({
            success: true,
            session
        });
    } catch (error) {
        logger.error("Error in getSessionById:", error);
        next(error);
    }
}

/**
 * @description Get all sessions of logged in user.
 */
async function getSessions(req, res, next) {
    try {
        const sessions = await voiceSessionModel.find({ user: req.user.id })
            .populate("interviewReport", "title")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            sessions
        });
    } catch (error) {
        logger.error("Error in getSessions:", error);
        next(error);
    }
}



/**
 * @description Transcribe user's audio file using Sarvam STT.
 */
async function transcribeAudio(req, res, next) {
    logger.debug(`[Voice Controller] [Route reached] POST /api/voice-session/transcribe`);
    try {
        if (!req.file) {
            logger.warn(`[Voice Controller] No audio file uploaded in request`);
            return res.status(400).json({
                success: false,
                message: "No audio file uploaded for transcription."
            });
        }

        const duration = req.body.duration ? parseFloat(req.body.duration) : 0;
        if (req.file.size < 500 && duration < 0.5) {
            logger.warn(`[Voice Controller] Audio file too small (${req.file.size} bytes) and duration too short (${duration}s). Rejected as empty recording.`);
            return res.status(400).json({
                success: false,
                message: "Audio recording is empty or too short."
            });
        }

        const languageCode = req.body.languageCode || "en-IN";
        logger.debug(`[Voice Controller] [STT Stage] Received audio file: name='${req.file.originalname}', size=${req.file.size} bytes, mimetype='${req.file.mimetype}', languageCode='${languageCode}'`);

        const response = await gateway.routeTask("speechToText", {
            fileBuffer: req.file.buffer,
            filename: req.file.originalname,
            mimetype: req.file.mimetype,
            languageCode
        });

        if (!response.success || !response.output) {
            logger.error(`[Voice Controller] [STT Stage] Provider failed or returned empty output:`, JSON.stringify(response.error, null, 2));
            return res.status(response.error?.status || 502).json({
                success: false,
                message: response.error?.message || "Transcription provider failed."
            });
        }

        logger.debug(`[Voice Controller] [STT Stage] Transcription result: '${response.output.transcript || ""}'`);

        return res.status(200).json({
            success: true,
            transcript: response.output.transcript || ""
        });
    } catch (error) {
        logger.error("[Voice Controller] [STT Stage] Error in transcribeAudio with full stack trace:", error.stack || error);
        // Prevent generic 500 errors by returning a controlled 502/503 status when gateway or provider fails
        const statusCode = error.status || 502;
        return res.status(statusCode).json({
            success: false,
            message: error.message || "Speech-to-Text transcription service is currently unavailable."
        });
    }
}

/**
 * @description Synthesize audio file from text using Sarvam TTS.
 */
async function textToSpeech(req, res, next) {
    logger.debug(`[Voice Controller] [Route reached] POST /api/voice-session/speak`);
    try {
        const { text, languageCode, speaker, gender, speed } = req.body;
        logger.debug(`[Voice Controller] [TTS Stage] Request body:`, JSON.stringify(req.body, null, 2));

        if (!text) {
            logger.warn(`[Voice Controller] Text parameter missing for TTS synthesis`);
            return res.status(400).json({
                success: false,
                message: "Text parameter is required for speech synthesis."
            });
        }

        const response = await gateway.routeTask("textToSpeech", {
            text,
            languageCode: languageCode || "en-IN",
            speaker: speaker || "shreya", // default to shreya since meera is not supported
            gender: gender || (speaker === "shubh" ? "male" : "female"),
            speed: speed || 1.0
        });

        if (!response.success || !response.output) {
            logger.error(`[Voice Controller] [TTS Stage] Provider failed or returned empty output:`, JSON.stringify(response.error, null, 2));
            return res.status(response.error?.status || 502).json({
                success: false,
                message: response.error?.message || "Speech synthesis provider failed."
            });
        }

        logger.debug(`[Voice Controller] [TTS Stage] Success! Base64 Audio tracks length: ${response.output.audios ? response.output.audios.length : 0}`);

        return res.status(200).json({
            success: true,
            audios: response.output.audios || []
        });
    } catch (error) {
        logger.error("[Voice Controller] [TTS Stage] Error in textToSpeech with full stack trace:", error.stack || error);
        // Prevent generic 500 errors by returning a controlled 502/503 status
        const statusCode = error.status || 502;
        return res.status(statusCode).json({
            success: false,
            message: error.message || "Text-to-Speech synthesis service is currently unavailable."
        });
    }
}


module.exports = {
    startSession,
    submitAnswer,
    completeSession,
    getProgressStats,
    getSessionById,
    getSessions,
    transcribeAudio,
    textToSpeech
};
