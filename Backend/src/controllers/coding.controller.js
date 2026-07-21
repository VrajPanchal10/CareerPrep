const mongoose = require("mongoose");
const codingQuestionModel  = require("../models/codingQuestion.model");
const codingSubmissionModel = require("../models/codingSubmission.model");
const { generateAiCodingQuestion } = require("../services/ai.service");
const { defaultQuestions } = require("../services/seedQuestions");
const { evaluateSubmission, runCustomInput: runCustomInputInPiston } = require("../services/execution/codeExecution.service");
const { isSupported, getSupportedLanguages } = require("../services/execution/languageMap");
const { checkHealth } = require("../services/execution/judge0.provider");
const { getStats: getCacheStats } = require("../services/code/executionCache.service");
const { logger } = require("../utils/securityLogger");

/**
 * Helper to automatically seed default coding questions if database is empty.
 */
async function ensureQuestionsSeeded() {
    try {
        const count = await codingQuestionModel.countDocuments();
        if (count === 0) {
            logger.debug("[Seeder] No coding questions found. Seeding default questions...");
            await codingQuestionModel.insertMany(defaultQuestions);
            logger.debug("[Seeder] Successfully seeded default coding questions.");
        }
    } catch (err) {
        logger.error("[Seeder] Error checking/seeding coding questions:", err);
    }
}

// ─── Question Endpoints ────────────────────────────────────────────────────────

/**
 * GET /api/code/questions
 * Get all coding questions (optionally filtered by topic/difficulty).
 */
async function getQuestions(req, res, next) {
    try {
        await ensureQuestionsSeeded();

        const { topic, difficulty } = req.query;
        const query = {};
        if (topic)      query.topic      = new RegExp("^" + topic + "$", "i");
        if (difficulty) query.difficulty = new RegExp("^" + difficulty + "$", "i");

        const questions = await codingQuestionModel.find(query).sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            message: "Coding questions fetched successfully.",
            questions
        });
    } catch (error) {
        logger.error("Error in getQuestions:", error);
        next(error);
    }
}

/**
 * GET /api/code/questions/:id
 * Get details of a single coding question (no hidden test cases returned).
 */
async function getQuestionById(req, res, next) {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid coding question ID." });
        }

        const question = await codingQuestionModel.findById(id);

        if (!question) {
            return res.status(404).json({ success: false, message: "Coding question not found." });
        }

        // SECURITY: strip hidden test cases from the response
        const safeQuestion = question.toObject();
        safeQuestion.testCases = (safeQuestion.testCases || []).filter(tc => !tc.isHidden);

        return res.status(200).json({
            success: true,
            message: "Coding question fetched successfully.",
            question: safeQuestion
        });
    } catch (error) {
        logger.error("Error in getQuestionById:", error);
        next(error);
    }
}

/**
 * GET /api/code/questions/:id/testcases
 * Returns ONLY visible test cases (never hidden inputs/outputs).
 */
async function getTestCases(req, res, next) {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid question ID." });
        }

        const question = await codingQuestionModel.findById(id).select("testCases timeLimitMs memoryLimitKb");

        if (!question) {
            return res.status(404).json({ success: false, message: "Question not found." });
        }

        // SECURITY: Never expose hidden test cases
        const visibleTestCases = (question.testCases || [])
            .filter(tc => !tc.isHidden)
            .map(tc => ({
                label:          tc.label || "",
                input:          tc.input || "",
                expectedOutput: tc.expectedOutput || ""
            }));

        return res.status(200).json({
            success: true,
            testCases:    visibleTestCases,
            timeLimitMs:  question.timeLimitMs,
            memoryLimitKb: question.memoryLimitKb
        });
    } catch (error) {
        logger.error("Error in getTestCases:", error);
        next(error);
    }
}

/**
 * POST /api/code/questions/generate
 * Generate a new AI coding question (Gemini).
 */
async function generateCustomQuestion(req, res, next) {
    try {
        const { topic, difficulty } = req.body;

        if (!topic || !difficulty) {
            return res.status(400).json({
                success: false,
                message: "Topic and difficulty are required to generate a question."
            });
        }

        const allowedDifficulties = ["Easy", "Medium", "Hard"];
        if (!allowedDifficulties.includes(difficulty)) {
            return res.status(400).json({
                success: false,
                message: "Difficulty must be one of: Easy, Medium, Hard."
            });
        }

        logger.debug(`[AI Gen] Generating custom question: Topic=${topic}, Difficulty=${difficulty}`);
        const generatedData = await generateAiCodingQuestion({ topic, difficulty });

        const newQuestion = await codingQuestionModel.create({
            title:       `${generatedData.title} (AI Custom)`,
            description: generatedData.description,
            difficulty:  generatedData.difficulty,
            topic:       generatedData.topic,
            sampleInput:  generatedData.sampleInput || "",
            sampleOutput: generatedData.sampleOutput || "",
            constraints:  generatedData.constraints || [],
            hints:        generatedData.hints || [],
            testCases:    (generatedData.testCases || []).map(tc => ({
                input:          tc.input || "",
                expectedOutput: tc.expectedOutput || "",
                isHidden:       tc.isHidden || false,
                label:          tc.label || ""
            })),
            isCustom: true
        });

        return res.status(201).json({
            success: true,
            message: "Custom AI coding question generated and saved successfully.",
            question: newQuestion
        });
    } catch (error) {
        logger.error("Error in generateCustomQuestion:", error);

        if (error.model || error.status) {
            const isUnavailable = [503, "UNAVAILABLE"].includes(error.status);
            return res.status(isUnavailable ? 503 : 502).json({
                success: false,
                message: isUnavailable
                    ? "The AI service is currently busy. Please try again in a moment."
                    : "The AI service encountered an error while generating the coding question.",
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

// ─── Code Execution Endpoints ──────────────────────────────────────────────────

/**
 * POST /api/code/submit
 * Full evaluation: Judge0 execution + Gemini coaching.
 * Response schema is EXTENDED (not replaced) — all original fields preserved.
 */
async function submitCode(req, res, next) {
    try {
        const { questionId, language, code } = req.body;

        if (!questionId || !language || !code) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: questionId, language, code."
            });
        }

        if (!mongoose.Types.ObjectId.isValid(questionId)) {
            return res.status(400).json({ success: false, message: "Invalid question ID." });
        }

        if (!isSupported(language)) {
            return res.status(400).json({
                success: false,
                message: `Language "${language}" is not supported. Call GET /api/code/languages for supported options.`
            });
        }

        if (code.length > 100000) {
            return res.status(400).json({
                success: false,
                message: "Code payload exceeds maximum size limit of 100KB."
            });
        }

        logger.debug(`[Submission] User=${req.user.id}, Question=${questionId}, Language=${language}`);

        const ac = new AbortController();
        req.on('close', () => ac.abort());

        const result = await evaluateSubmission({
            questionId,
            language:   language.toLowerCase(),
            sourceCode: code,
            userId:     req.user.id,
            signal:     ac.signal
        });

        return res.status(201).json({
            success: true,
            message: "Code evaluated and submitted successfully.",
            cached: result.cached,
            // Backward-compatible submission object
            submission: result.submission,
            // New: Judge0 execution results
            executionResult: result.executionResult,
            // New: Gemini coaching
            aiMentor: result.aiMentor
        });
    } catch (error) {
        logger.error("Error in submitCode:", error);

        if (error.code === "EXECUTION_ENGINE_UNAVAILABLE") {
            return res.status(503).json({
                success: false,
                message: error.message,
                error: { code: "EXECUTION_ENGINE_UNAVAILABLE" }
            });
        }
        if (error.status === 400) {
            return res.status(400).json({ success: false, message: error.message, error: { code: error.code } });
        }
        if (error.model || error.status === 503) {
            return res.status(503).json({
                success: false,
                message: "The AI service is temporarily unavailable.",
                error: { code: "AI_SERVICE_UNAVAILABLE" }
            });
        }
        next(error);
    }
}

/**
 * POST /api/code/run
 * Custom input execution — runs user code with provided stdin.
 * Never persisted. Never AI-analyzed.
 */
async function runCode(req, res, next) {
    try {
        const { language, code, stdin = "" } = req.body;

        if (!language || !code) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: language, code."
            });
        }

        if (!await isSupported(language)) {
            return res.status(400).json({
                success: false,
                message: `Language "${language}" is not supported.`
            });
        }

        if (code.length > 100000) {
            return res.status(400).json({
                success: false,
                message: "Code payload exceeds maximum size limit of 100KB."
            });
        }

        const ac = new AbortController();
        req.on('close', () => ac.abort());

        const result = await runCustomInputInPiston({
            sourceCode:  code,
            language:    language.toLowerCase(),
            stdin:       String(stdin).slice(0, 10000), // limit stdin size
            signal:      ac.signal
        });

        return res.status(200).json({
            success: true,
            verdict:       result.verdict,
            statusLabel:   result.statusLabel,
            stdout:        result.stdout || "",
            stderr:        result.stderr || "",
            compileOutput: result.compileOutput || null,
            timeMs:        result.timeMs,
            memoryKb:      result.memoryKb
        });
    } catch (error) {
        logger.error("Error in runCode:", error);

        if (error.code === "SERVICE_UNAVAILABLE" || error.code === "UNREACHABLE" || error.code === "TIMEOUT"
            || error.code === "CIRCUIT_BREAKER_OPEN" || error.code === "NETWORK_ERROR"
            || error.code === "UNSUPPORTED_LANGUAGE" || error.name === "Judge0Error") {
            return res.status(503).json({
                success: false,
                message: "Code execution engine is temporarily unavailable.",
                error: { code: "EXECUTION_ENGINE_UNAVAILABLE" }
            });
        }
        next(error);
    }
}

// ─── Submission History ────────────────────────────────────────────────────────

/**
 * GET /api/code/submissions
 * Get user's submission history, optionally filtered by questionId.
 */
async function getSubmissions(req, res, next) {
    try {
        const { questionId } = req.query;
        const query = { userId: req.user.id };

        if (questionId) {
            if (!mongoose.Types.ObjectId.isValid(questionId)) {
                return res.status(400).json({ success: false, message: "Invalid question ID." });
            }
            query.questionId = questionId;
        }

        const submissions = await codingSubmissionModel.find(query)
            .populate("questionId", "title topic difficulty")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            message: "Submissions fetched successfully.",
            submissions
        });
    } catch (error) {
        logger.error("Error in getSubmissions:", error);
        next(error);
    }
}

// ─── Progress Analytics ────────────────────────────────────────────────────────

/**
 * GET /api/code/progress
 * Compute user coding progress statistics for the dashboard.
 * Uses executionScore where available, falls back to overallScore.
 */
async function getUserProgress(req, res, next) {
    try {
        const userId = req.user.id;

        const submissions = await codingSubmissionModel.find({ userId })
            .populate("questionId")
            .sort({ createdAt: 1 });

        if (submissions.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No submissions recorded yet.",
                stats: {
                    codingReadinessScore: 0,
                    averageCodingScore: 0,
                    strongTopics: [],
                    weakTopics: [],
                    difficultyDistribution: { Easy: 0, Medium: 0, Hard: 0 },
                    recentAttempts: [],
                    progressTracking: []
                }
            });
        }

        // Use executionScore (new) with fallback to overallScore (legacy)
        const getScore = (sub) => sub.executionScore > 0 ? sub.executionScore : sub.overallScore;

        let totalScore = 0;
        submissions.forEach(sub => totalScore += getScore(sub));
        const averageCodingScore = Math.round(totalScore / submissions.length);

        const questionBestScores = {};
        const submissionsByTopic = {};

        submissions.forEach(sub => {
            if (!sub.questionId) return;
            const qId   = sub.questionId._id.toString();
            const topic = sub.questionId.topic;
            const diff  = sub.questionId.difficulty;
            const score = getScore(sub);

            if (!questionBestScores[qId]) {
                questionBestScores[qId] = { score, topic, difficulty: diff };
            } else if (score > questionBestScores[qId].score) {
                questionBestScores[qId].score = score;
            }

            if (!submissionsByTopic[topic]) submissionsByTopic[topic] = [];
            submissionsByTopic[topic].push({ score, date: sub.createdAt });
        });

        const uniqueAttempts = Object.values(questionBestScores);
        const sumUniqueBest  = uniqueAttempts.reduce((acc, a) => acc + a.score, 0);
        const codingReadinessScore = uniqueAttempts.length > 0
            ? Math.round(sumUniqueBest / uniqueAttempts.length)
            : 0;

        const topicBestAggregate = {};
        uniqueAttempts.forEach(attempt => {
            const topic = attempt.topic;
            if (!topicBestAggregate[topic]) topicBestAggregate[topic] = { sum: 0, count: 0 };
            topicBestAggregate[topic].sum   += attempt.score;
            topicBestAggregate[topic].count += 1;
        });

        const strongTopics = [];
        const weakTopics   = [];
        Object.entries(topicBestAggregate).forEach(([topic, data]) => {
            const avg = Math.round(data.sum / data.count);
            if (avg >= 75) strongTopics.push({ topic, averageScore: avg });
            else           weakTopics.push({ topic, averageScore: avg });
        });

        const difficultyDistribution = { Easy: 0, Medium: 0, Hard: 0 };
        uniqueAttempts.forEach(attempt => {
            if (difficultyDistribution[attempt.difficulty] !== undefined) {
                difficultyDistribution[attempt.difficulty] += 1;
            }
        });

        const recentAttempts = [...submissions]
            .reverse()
            .slice(0, 6)
            .map(sub => ({
                id:           sub._id,
                title:        sub.questionId?.title || "Unknown Question",
                topic:        sub.questionId?.topic || "General",
                difficulty:   sub.questionId?.difficulty || "Medium",
                language:     sub.language,
                overallScore: getScore(sub),
                verdict:      sub.executionVerdict || null,
                avgRuntimeMs: sub.avgRuntimeMs || 0,
                createdAt:    sub.createdAt
            }));

        const progressTracking = Object.entries(submissionsByTopic).map(([topic, attempts]) => ({
            topic,
            attempts: attempts.map((att, idx) => ({
                attemptNumber: idx + 1,
                score: att.score,
                date:  att.date
            }))
        }));

        return res.status(200).json({
            success: true,
            message: "Progress tracking stats fetched successfully.",
            stats: {
                codingReadinessScore,
                averageCodingScore,
                strongTopics,
                weakTopics,
                difficultyDistribution,
                recentAttempts,
                progressTracking
            }
        });
    } catch (error) {
        logger.error("Error in getUserProgress:", error);
        next(error);
    }
}

// ─── System Endpoints ──────────────────────────────────────────────────────────

/**
 * GET /api/code/health
 * Judge0 engine health check. Lets the frontend detect unavailability.
 */
async function getEngineHealth(req, res) {
    const healthResult = await checkHealth();
    const cacheStats   = getCacheStats();

    return res.status(healthResult.healthy ? 200 : 503).json({
        success: healthResult.healthy,
        engine: {
            ...healthResult,
            provider: "Judge0 CE",
            apiUrl: process.env.JUDGE0_BASE_URL || "http://localhost:2358"
        },
        cache: cacheStats
    });
}

/**
 * GET /api/code/languages
 * Returns all supported languages (safe to expose — no sensitive info).
 */
async function getSupportedLanguagesList(req, res) {
    const languages = await getSupportedLanguages();
    return res.status(200).json({
        success: true,
        languages
    });
}

module.exports = {
    getQuestions,
    getQuestionById,
    getTestCases,
    generateCustomQuestion,
    submitCode,
    runCode,
    getSubmissions,
    getUserProgress,
    getEngineHealth,
    getSupportedLanguagesList
};
