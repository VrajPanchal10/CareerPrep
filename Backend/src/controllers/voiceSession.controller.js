const mongoose = require("mongoose");
const voiceSessionModel = require("../models/voiceSession.model");
const interviewReportModel = require("../models/interviewReport.model");
const { 
    evaluateVoiceAnswer, 
    generateAiFollowUpQuestion, 
    generateVoiceSessionSummaryRecommendation 
} = require("../services/ai.service");

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
        const report = await interviewReportModel.findOne({ _id: interviewReportId, user: req.user.id });
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

        // In V1, we take the top slices. In harder difficulties we can describe it or select specific indexes.
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

        // 4. Create Voice session
        const session = await voiceSessionModel.create({
            user: req.user.id,
            interviewReport: report._id,
            difficulty,
            enableFollowUps: !!enableFollowUps,
            questions: selectedQuestions,
            transcripts: [],
            evaluations: [],
            status: "started"
        });

        return res.status(201).json({
            success: true,
            message: "Voice interview session started successfully.",
            session
        });

    } catch (error) {
        console.error("Error in startSession:", error);
        next(error);
    }
}

/**
 * @description Submit verbal response transcript for evaluation.
 */
async function submitAnswer(req, res, next) {
    try {
        const { sessionId, questionIndex, userAnswer, responseTime } = req.body;

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

        const session = await voiceSessionModel.findOne({ _id: sessionId, user: req.user.id });
        if (!session) {
            return res.status(404).json({
                success: false,
                message: "Voice session not found."
            });
        }

        if (session.status === "completed") {
            return res.status(400).json({
                success: false,
                message: "Cannot submit answers to a completed session."
            });
        }

        const question = session.questions[questionIndex];
        if (!question) {
            return res.status(404).json({
                success: false,
                message: "Question not found at index."
            });
        }

        console.log(`[Voice Simulator] Evaluating question ${questionIndex} for session ${sessionId}...`);

        // 2. Evaluate verbal answer transcript using Gemini AI
        const evaluationResult = await evaluateVoiceAnswer({
            question: question.questionText,
            intention: question.intention,
            modelAnswer: question.answer,
            userAnswer,
            topic: question.topic
        });

        // 3. Store transcript response time
        // Check if transcript already exists for this index
        const existingTransIdx = session.transcripts.findIndex(t => t.questionIndex === questionIndex);
        const transcriptObj = {
            questionIndex,
            transcriptText: userAnswer,
            responseTime: Number(responseTime)
        };
        if (existingTransIdx > -1) {
            session.transcripts[existingTransIdx] = transcriptObj;
        } else {
            session.transcripts.push(transcriptObj);
        }

        // Store evaluation results
        const existingEvalIdx = session.evaluations.findIndex(e => e.questionIndex === questionIndex);
        const evaluationObj = {
            questionIndex,
            overallScore: evaluationResult.overallScore,
            communicationScore: evaluationResult.communicationScore,
            clarityScore: evaluationResult.clarityScore,
            technicalScore: evaluationResult.technicalScore,
            explanationScore: evaluationResult.explanationScore,
            strengths: evaluationResult.strengths || [],
            weaknesses: evaluationResult.weaknesses || [],
            suggestions: evaluationResult.suggestions || []
        };
        if (existingEvalIdx > -1) {
            session.evaluations[existingEvalIdx] = evaluationObj;
        } else {
            session.evaluations.push(evaluationObj);
        }

        // 4. Handle Contextual Follow-Up Generation (depth limit of 1)
        let followUpQuestion = null;
        if (session.enableFollowUps && !question.isFollowUp) {
            // Check if a follow-up for this parent question was already generated to prevent duplication
            const alreadyHasFollowUp = session.questions.some(q => q.isFollowUp && q.parentQuestionIndex === questionIndex);
            
            if (!alreadyHasFollowUp) {
                console.log("[Voice Simulator] Generating contextual follow-up...");
                const followUpCheck = await generateAiFollowUpQuestion({
                    question,
                    userAnswer
                });

                if (followUpCheck.hasFollowUp) {
                    followUpQuestion = {
                        questionText: followUpCheck.questionText,
                        intention: followUpCheck.intention,
                        answer: followUpCheck.answer,
                        topic: question.topic,
                        type: question.type,
                        isFollowUp: true,
                        parentQuestionIndex: questionIndex
                    };

                    // Inject follow-up immediately after the current question index
                    session.questions.splice(questionIndex + 1, 0, followUpQuestion);
                    console.log(`[Voice Simulator] Follow-up question injected at index ${questionIndex + 1}`);
                }
            }
        }

        await session.save();

        return res.status(200).json({
            success: true,
            message: "Answer evaluated successfully.",
            evaluation: evaluationObj,
            followUpQuestion,
            session
        });

    } catch (error) {
        console.error("Error in submitAnswer:", error);

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

        // 1. Calculate Score Averages
        let sumOverall = 0, sumComm = 0, sumClar = 0, sumTech = 0, sumExpl = 0;
        const topicScores = {}; // topic -> sum overall score, count
        
        session.evaluations.forEach(evalu => {
            sumOverall += evalu.overallScore;
            sumComm += evalu.communicationScore;
            sumClar += evalu.clarityScore;
            sumTech += evalu.technicalScore;
            sumExpl += evalu.explanationScore;

            // Find question topic matching the index
            const q = session.questions[evalu.questionIndex];
            if (q) {
                const topic = q.topic;
                if (!topicScores[topic]) {
                    topicScores[topic] = { sum: 0, count: 0 };
                }
                topicScores[topic].sum += evalu.overallScore;
                topicScores[topic].count += 1;
            }
        });

        const numEvaluations = session.evaluations.length;
        session.overallScore = Math.round(sumOverall / numEvaluations);
        session.communicationScore = Math.round(sumComm / numEvaluations);
        session.clarityScore = Math.round(sumClar / numEvaluations);
        session.technicalScore = Math.round(sumTech / numEvaluations);
        session.explanationScore = Math.round(sumExpl / numEvaluations);

        // 2. Response Time Statistics
        let totalTime = 0;
        session.transcripts.forEach(trans => {
            totalTime += trans.responseTime || 0;
        });
        session.totalDuration = totalTime;
        session.averageResponseTime = session.transcripts.length > 0 
            ? Math.round(totalTime / session.transcripts.length) 
            : 0;

        // 3. Competency Strengths & Weaknesses Areas
        const strongAreas = [];
        const weakAreas = [];
        Object.entries(topicScores).forEach(([topic, data]) => {
            const avg = Math.round(data.sum / data.count);
            if (avg >= 75) {
                strongAreas.push(topic);
            } else {
                weakAreas.push(topic);
            }
        });
        session.strongAreas = strongAreas;
        session.weakAreas = weakAreas;

        // 4. Generate AI Career Coach strategic advice summary
        console.log(`[Voice Simulator] Generating summary recommendation advice for session ${session._id}...`);
        try {
            session.topRecommendation = await generateVoiceSessionSummaryRecommendation({
                evaluations: session.evaluations
            });
        } catch (recErr) {
            console.error("Failed to generate career coach advice:", recErr);
            session.topRecommendation = "Structure responses with the STAR framework (Situation, Task, Action, Result) to state clear deliverables, and expand technical concepts using domain keywords.";
        }

        session.status = "completed";
        session.completedAt = new Date();

        await session.save();

        return res.status(200).json({
            success: true,
            message: "Voice mock interview session completed successfully.",
            session
        });

    } catch (error) {
        console.error("Error in completeSession:", error);
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
        console.error("Error in getProgressStats:", error);
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
        console.error("Error in getSessionById:", error);
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
        console.error("Error in getSessions:", error);
        next(error);
    }
}

module.exports = {
    startSession,
    submitAnswer,
    completeSession,
    getProgressStats,
    getSessionById,
    getSessions
};
