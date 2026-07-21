const interviewSessionModel = require("../models/interviewSession.model");
const interviewReportModel = require("../models/interviewReport.model");
const { evaluateUserAnswer } = require("../services/ai.service");
const { logger } = require("../utils/securityLogger");

/**
 * @description Start a new interview session.
 */
async function startSessionController(req, res, next) {
    try {
        const { interviewReportId } = req.body;
        if (!interviewReportId) {
            return res.status(400).json({
                success: false,
                message: "Interview Report ID is required."
            });
        }

        const report = await interviewReportModel.findOne({ _id: interviewReportId, user: req.user.id });
        if (!report) {
            return res.status(404).json({
                success: false,
                message: "Interview plan report not found."
            });
        }

        const session = await interviewSessionModel.create({
            user: req.user.id,
            interviewReport: interviewReportId,
            status: "started",
            answers: []
        });

        return res.status(201).json({
            success: true,
            message: "Mock interview session started successfully.",
            session
        });
    } catch (error) {
        logger.error("Error in startSessionController:", error);
        next(error);
    }
}

/**
 * @description Evaluate an answer submitted by the candidate.
 */
async function evaluateAnswerController(req, res, next) {
    try {
        const { sessionId, questionType, questionIndex, userAnswer } = req.body;

        if (!sessionId || !questionType || questionIndex === undefined || userAnswer === undefined) {
            return res.status(400).json({
                success: false,
                message: "Session ID, questionType, questionIndex, and userAnswer are required."
            });
        }

        const session = await interviewSessionModel.findOne({ _id: sessionId, user: req.user.id });
        if (!session) {
            return res.status(404).json({
                success: false,
                message: "Interview session not found."
            });
        }

        const report = await interviewReportModel.findById(session.interviewReport);
        if (!report) {
            return res.status(404).json({
                success: false,
                message: "Associated Interview Report template not found."
            });
        }

        // Retrieve specific question
        let question;
        if (questionType === "technical") {
            question = report.technicalQuestions[questionIndex];
        } else if (questionType === "behavioral") {
            question = report.behavioralQuestions[questionIndex];
        } else {
            return res.status(400).json({
                success: false,
                message: "Invalid question type. Must be 'technical' or 'behavioral'."
            });
        }

        if (!question) {
            return res.status(404).json({
                success: false,
                message: "Question not found at index."
            });
        }

        // Backward compatibility fallback for topic
        const topic = question.topic || (questionType === "technical" ? "General Technical" : "Behavioral");

        // Trigger AI evaluation
        let evaluation;
        try {
            evaluation = await evaluateUserAnswer({
                question: question.question,
                intention: question.intention,
                modelAnswer: question.answer,
                userAnswer
            });
        } catch (aiErr) {
            logger.error("Error evaluating answer with Gemini:", aiErr);
            return res.status(502).json({
                success: false,
                message: "AI service failed to evaluate answer. Please try again."
            });
        }

        // Update answers array in session
        // Check if question has already been answered in this session
        const existingAnswerIndex = session.answers.findIndex(
            ans => ans.questionType === questionType && ans.questionIndex === questionIndex
        );

        const newAnswerObj = {
            questionType,
            questionIndex,
            questionText: question.question,
            topic,
            userAnswer,
            evaluation
        };

        if (existingAnswerIndex > -1) {
            session.answers[existingAnswerIndex] = newAnswerObj;
        } else {
            session.answers.push(newAnswerObj);
        }

        await session.save();

        return res.status(200).json({
            success: true,
            message: "Answer evaluated successfully.",
            evaluation,
            session
        });
    } catch (error) {
        logger.error("Error in evaluateAnswerController:", error);
        next(error);
    }
}

/**
 * @description Complete session and calculate score aggregates.
 */
async function completeSessionController(req, res, next) {
    try {
        const { sessionId } = req.params;
        const session = await interviewSessionModel.findOne({ _id: sessionId, user: req.user.id });

        if (!session) {
            return res.status(404).json({
                success: false,
                message: "Interview session not found."
            });
        }

        if (session.answers.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Cannot complete an interview session with 0 answers."
            });
        }

        // Topic Aggregation
        const topicSums = {};
        const topicCounts = {};

        let overallScoreSum = 0;

        session.answers.forEach(ans => {
            const topic = ans.topic;
            const score = ans.evaluation.overall || 0;

            topicSums[topic] = (topicSums[topic] || 0) + score;
            topicCounts[topic] = (topicCounts[topic] || 0) + 1;

            overallScoreSum += score;
        });

        const overallScore = Math.round(overallScoreSum / session.answers.length);
        session.overallScore = overallScore;
        session.interviewReadinessScore = overallScore;

        const topicScores = {};
        const topicBreakdown = [];
        const heatmapData = [];
        const strongAreas = [];
        const weakAreas = [];
        const recommendedTopics = [];
        const improvementRoadmap = [];

        Object.keys(topicSums).forEach(topic => {
            const avgScore = Math.round(topicSums[topic] / topicCounts[topic]);
            topicScores[topic] = avgScore;

            topicBreakdown.push({
                topic,
                questionsAttempted: topicCounts[topic],
                averageScore: avgScore
            });

            let status = "critical";
            if (avgScore >= 80) {
                status = "strong";
                strongAreas.push(topic);
            } else if (avgScore >= 60) {
                status = "moderate";
                strongAreas.push(topic); // include in acceptable strength
            } else if (avgScore >= 40) {
                status = "weak";
                weakAreas.push(topic);
                recommendedTopics.push(topic);
            } else {
                status = "critical";
                weakAreas.push(topic);
                recommendedTopics.push(topic);
            }

            heatmapData.push({
                topic,
                score: avgScore,
                status
            });

            // If topic needs improvement, add roadmap
            if (avgScore < 80) {
                improvementRoadmap.push({
                    topic,
                    currentScore: avgScore,
                    targetScore: 85,
                    steps: [
                        `Review foundational definitions and concepts of ${topic}`,
                        `Practice writing code and working with realistic scenarios in ${topic}`,
                        `Read model answers and intention patterns to refine explanations`
                    ]
                });
            }
        });

        session.topicScores = topicScores;
        session.topicBreakdown = topicBreakdown;
        session.heatmapData = heatmapData;
        session.strongAreas = strongAreas;
        session.weakAreas = weakAreas;
        session.status = "completed";

        session.studyPlan = {
            recommendedTopics,
            improvementRoadmap
        };

        await session.save();

        return res.status(200).json({
            success: true,
            message: "Mock interview session completed successfully.",
            session
        });
    } catch (error) {
        logger.error("Error in completeSessionController:", error);
        next(error);
    }
}

/**
 * @description Get session heatmap data.
 */
async function getHeatmapController(req, res, next) {
    try {
        const { id } = req.params;
        const session = await interviewSessionModel.findOne({ _id: id, user: req.user.id });

        if (!session) {
            return res.status(404).json({
                success: false,
                message: "Interview session not found."
            });
        }

        return res.status(200).json({
            success: true,
            heatmapData: session.heatmapData || []
        });
    } catch (error) {
        logger.error("Error in getHeatmapController:", error);
        next(error);
    }
}

/**
 * @description Get topic breakdown details.
 */
async function getTopicBreakdownController(req, res, next) {
    try {
        const { id } = req.params;
        const session = await interviewSessionModel.findOne({ _id: id, user: req.user.id });

        if (!session) {
            return res.status(404).json({
                success: false,
                message: "Interview session not found."
            });
        }

        return res.status(200).json({
            success: true,
            topicBreakdown: session.topicBreakdown || [],
            overallScore: session.overallScore || 0
        });
    } catch (error) {
        logger.error("Error in getTopicBreakdownController:", error);
        next(error);
    }
}

/**
 * @description Get study recommendation details.
 */
async function getStudyPlanController(req, res, next) {
    try {
        const { id } = req.params;
        const session = await interviewSessionModel.findOne({ _id: id, user: req.user.id });

        if (!session) {
            return res.status(404).json({
                success: false,
                message: "Interview session not found."
            });
        }

        return res.status(200).json({
            success: true,
            studyPlan: session.studyPlan || {}
        });
    } catch (error) {
        logger.error("Error in getStudyPlanController:", error);
        next(error);
    }
}

/**
 * @description Get progress history snapshots.
 */
async function getProgressController(req, res, next) {
    try {
        const { id } = req.params; // Expecting the InterviewReport ID to show progress over sessions under this template
        const sessions = await interviewSessionModel.find({ 
            interviewReport: id, 
            user: req.user.id,
            status: "completed"
        }).sort({ createdAt: 1 });

        const progress = sessions.map(session => ({
            interviewId: session._id,
            date: session.createdAt,
            overallScore: session.overallScore,
            topicScores: session.topicScores
        }));

        return res.status(200).json({
            success: true,
            progress
        });
    } catch (error) {
        logger.error("Error in getProgressController:", error);
        next(error);
    }
}

/**
 * @description Fetch a specific session by ID.
 */
async function getSessionByIdController(req, res, next) {
    try {
        const { sessionId } = req.params;
        const session = await interviewSessionModel.findOne({ _id: sessionId, user: req.user.id });

        if (!session) {
            return res.status(404).json({
                success: false,
                message: "Session not found."
            });
        }

        return res.status(200).json({
            success: true,
            session
        });
    } catch (error) {
        logger.error("Error in getSessionByIdController:", error);
        next(error);
    }
}

/**
 * @description Fetch all sessions of the logged-in user.
 */
async function getAllSessionsController(req, res, next) {
    try {
        const sessions = await interviewSessionModel.find({ user: req.user.id })
            .sort({ createdAt: -1 })
            .select("-answers");

        return res.status(200).json({
            success: true,
            sessions
        });
    } catch (error) {
        logger.error("Error in getAllSessionsController:", error);
        next(error);
    }
}

module.exports = {
    startSessionController,
    evaluateAnswerController,
    completeSessionController,
    getHeatmapController,
    getTopicBreakdownController,
    getStudyPlanController,
    getProgressController,
    getSessionByIdController,
    getAllSessionsController
};
