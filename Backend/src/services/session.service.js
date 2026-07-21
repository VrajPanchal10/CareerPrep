const voiceSessionModel = require("../models/voiceSession.model");
const interviewReportModel = require("../models/interviewReport.model");
const mongoose = require("mongoose");
const { logger } = require("../utils/securityLogger");

/**
 * Fetch a session and populate its report.
 */
async function getSessionById(sessionId, userId) {
    return await voiceSessionModel.findOne({ _id: sessionId, user: userId })
        .populate("interviewReport");
}

/**
 * Fetch the associated interview plan/report.
 */
async function getInterviewReport(reportId, userId) {
    return await interviewReportModel.findOne({ _id: reportId, user: userId });
}

/**
 * Create base voice mock session.
 */
async function createSession({ userId, reportId, difficulty, enableFollowUps, questions }) {
    const baseQuestions = questions.map(q => ({
        ...q,
        translations: {
            "en-IN": { status: "completed", text: q.questionText }
        }
    }));

    return await voiceSessionModel.create({
        user: userId,
        interviewReport: reportId,
        difficulty,
        enableFollowUps: !!enableFollowUps,
        questions: baseQuestions,
        transcripts: [],
        evaluations: [],
        status: "started"
    });
}

/**
 * Compile averages, trends, competency metrics and complete the session.
 */
async function completeSessionDetails(session, topRecommendation) {
    let sumOverall = 0, sumComm = 0, sumClar = 0, sumTech = 0, sumExpl = 0;
    let sumFluency = 0, sumGrammar = 0;
    const topicScores = {};
    const speedTrend = [];

    session.evaluations.forEach(evalu => {
        sumOverall += evalu.overallScore;
        sumComm += evalu.communicationScore;
        sumClar += evalu.clarityScore;
        sumTech += evalu.technicalScore;
        sumExpl += evalu.explanationScore;
        sumFluency += evalu.fluencyScore || 70;
        sumGrammar += evalu.grammarScore || 70;

        const q = session.questions[evalu.questionIndex];
        if (q) {
            const topic = q.topic;
            if (!topicScores[topic]) {
                topicScores[topic] = { sum: 0, count: 0 };
            }
            topicScores[topic].sum += evalu.overallScore;
            topicScores[topic].count += 1;
        }

        // Gather speed if transcribed previously
        const t = session.transcripts.find(tr => tr.questionIndex === evalu.questionIndex);
        if (t && t.responseTime) {
            // Speed indicator (words per minute approximation or raw responseTime)
            speedTrend.push(t.responseTime);
        }
    });

    const numEvaluations = session.evaluations.length;
    if (numEvaluations > 0) {
        session.overallScore = Math.round(sumOverall / numEvaluations);
        session.communicationScore = Math.round(sumComm / numEvaluations);
        session.clarityScore = Math.round(sumClar / numEvaluations);
        session.technicalScore = Math.round(sumTech / numEvaluations);
        session.explanationScore = Math.round(sumExpl / numEvaluations);
        session.averageFluency = Math.round(sumFluency / numEvaluations);
        
        // Confidence trend average
        let sumConfidence = 0;
        session.evaluations.forEach(e => {
            if (e.confidenceIndicator === "Confident") sumConfidence += 100;
            else if (e.confidenceIndicator === "Neutral") sumConfidence += 70;
            else sumConfidence += 40;
        });
        session.overallConfidence = Math.round(sumConfidence / numEvaluations);
    } else {
        session.overallScore = 0;
        session.communicationScore = 0;
        session.clarityScore = 0;
        session.technicalScore = 0;
        session.explanationScore = 0;
        session.averageFluency = 0;
        session.overallConfidence = 0;
    }
    session.speakingSpeedTrend = speedTrend;

    // Response time statistics
    let totalTime = 0;
    session.transcripts.forEach(trans => {
        totalTime += trans.responseTime || 0;
    });
    session.totalDuration = totalTime;
    session.averageResponseTime = session.transcripts.length > 0 
        ? Math.round(totalTime / session.transcripts.length) 
        : 0;

    // Strengths and Weaknesses
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
    session.topRecommendation = topRecommendation;

    session.status = "completed";
    session.completedAt = new Date();

    await session.save();
    return session;
}

module.exports = {
    getSessionById,
    getInterviewReport,
    createSession,
    completeSessionDetails
};
