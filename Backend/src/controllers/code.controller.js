const mongoose = require("mongoose");
const codingQuestionModel = require("../models/codingQuestion.model");
const codingSubmissionModel = require("../models/codingSubmission.model");
const { generateAiCodingQuestion, evaluateCodeSubmission } = require("../services/ai.service");
const { defaultQuestions } = require("../services/seedQuestions");

/**
 * Helper to automatically seed default coding questions if database is empty.
 */
async function ensureQuestionsSeeded() {
    try {
        const count = await codingQuestionModel.countDocuments();
        if (count === 0) {
            console.log("[Seeder] No coding questions found. Seeding 15 default questions...");
            await codingQuestionModel.insertMany(defaultQuestions);
            console.log("[Seeder] Successfully seeded default coding questions.");
        }
    } catch (err) {
        console.error("[Seeder] Error checking/seeding coding questions:", err);
    }
}

/**
 * @description Get all coding questions. Automatically seeds defaults on empty check.
 */
async function getQuestions(req, res, next) {
    try {
        await ensureQuestionsSeeded();

        const { topic, difficulty } = req.query;
        const query = {};

        if (topic) {
            query.topic = new RegExp("^" + topic + "$", "i");
        }
        if (difficulty) {
            query.difficulty = new RegExp("^" + difficulty + "$", "i");
        }

        const questions = await codingQuestionModel.find(query).sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            message: "Coding questions fetched successfully.",
            questions
        });
    } catch (error) {
        console.error("Error in getQuestions:", error);
        next(error);
    }
}

/**
 * @description Get details of a single coding question.
 */
async function getQuestionById(req, res, next) {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid coding question ID."
            });
        }

        const question = await codingQuestionModel.findById(id);

        if (!question) {
            return res.status(404).json({
                success: false,
                message: "Coding question not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Coding question fetched successfully.",
            question
        });
    } catch (error) {
        console.error("Error in getQuestionById:", error);
        next(error);
    }
}

/**
 * @description Generate a new coding question using Gemini based on selected topic and difficulty.
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

        console.log(`[AI Gen] Generating custom AI question: Topic = ${topic}, Difficulty = ${difficulty}`);
        const generatedData = await generateAiCodingQuestion({ topic, difficulty });

        // Save generated question to DB as a custom/user-generated question
        const newQuestion = await codingQuestionModel.create({
            title: `${generatedData.title} (AI Custom)`,
            description: generatedData.description,
            difficulty: generatedData.difficulty,
            topic: generatedData.topic,
            sampleInput: generatedData.sampleInput || "",
            sampleOutput: generatedData.sampleOutput || "",
            constraints: generatedData.constraints || [],
            hints: generatedData.hints || [],
            isCustom: true
        });

        return res.status(201).json({
            success: true,
            message: "Custom AI coding question generated and saved successfully.",
            question: newQuestion
        });
    } catch (error) {
        console.error("Error in generateCustomQuestion:", error);
        
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

/**
 * @description Submit code for evaluation. Evaluated by Gemini AI without code execution.
 */
async function submitCode(req, res, next) {
    try {
        const { questionId, language, code } = req.body;

        // 1. Input Validation
        if (!questionId || !language || !code) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: questionId, language, code."
            });
        }

        if (!mongoose.Types.ObjectId.isValid(questionId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid question ID."
            });
        }

        const allowedLanguages = ["javascript", "typescript", "python", "java", "cpp", "c"];
        if (!allowedLanguages.includes(language.toLowerCase())) {
            return res.status(400).json({
                success: false,
                message: "Unsupported language. Supported languages: JavaScript, TypeScript, Python, Java, C++, C."
            });
        }

        // 2. Payload size limits (Max 100KB to prevent memory exhaustion / long processing times)
        if (code.length > 100000) {
            return res.status(400).json({
                success: false,
                message: "Code payload exceeds maximum size limit of 100KB."
            });
        }

        // 3. Fetch target question
        const question = await codingQuestionModel.findById(questionId);
        if (!question) {
            return res.status(404).json({
                success: false,
                message: "Question not found."
            });
        }

        console.log(`[Submission] Evaluating submission for user ${req.user.id} on question '${question.title}' (${language})...`);

        // 4. Trigger Gemini evaluation
        const evaluation = await evaluateCodeSubmission({
            question,
            language,
            code
        });

        // 5. Store submission in DB
        const submission = await codingSubmissionModel.create({
            userId: req.user.id,
            questionId: question._id,
            language: language.toLowerCase(),
            submittedCode: code,
            overallScore: evaluation.overallScore,
            correctnessScore: evaluation.correctnessScore,
            readabilityScore: evaluation.readabilityScore,
            complexityScore: evaluation.complexityScore,
            strengths: evaluation.strengths || [],
            weaknesses: evaluation.weaknesses || [],
            suggestions: evaluation.suggestions || []
        });

        return res.status(201).json({
            success: true,
            message: "Code evaluated and submitted successfully.",
            submission
        });
    } catch (error) {
        console.error("Error in submitCode:", error);

        if (error.model || error.status) {
            const isUnavailable = [503, "UNAVAILABLE"].includes(error.status);
            return res.status(isUnavailable ? 503 : 502).json({
                success: false,
                message: isUnavailable 
                    ? "The AI service is currently busy. Please try again in a moment." 
                    : "The AI service encountered an error while evaluating your code.",
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
 * @description Get user's submissions.
 */
async function getSubmissions(req, res, next) {
    try {
        const { questionId } = req.query;
        const query = { userId: req.user.id };

        if (questionId) {
            if (!mongoose.Types.ObjectId.isValid(questionId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid question ID."
                });
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
        console.error("Error in getSubmissions:", error);
        next(error);
    }
}

/**
 * @description Compute user coding progress statistics for dashboard.
 */
async function getUserProgress(req, res, next) {
    try {
        const userId = req.user.id;

        // Fetch all submissions of the user, pre-populated with question details
        const submissions = await codingSubmissionModel.find({ userId })
            .populate("questionId")
            .sort({ createdAt: 1 }); // chronological order

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

        // 1. Calculate Average Coding Score
        let totalScore = 0;
        submissions.forEach(sub => totalScore += sub.overallScore);
        const averageCodingScore = Math.round(totalScore / submissions.length);

        // 2. Group by Question to find the user's best attempt score per question
        const questionBestScores = {};
        const topicScores = {}; // Map of topic -> list of best scores on unique questions
        const submissionsByTopic = {}; // Map of topic -> chronological list of scores

        submissions.forEach(sub => {
            if (!sub.questionId) return; // skip deleted questions
            
            const qId = sub.questionId._id.toString();
            const topic = sub.questionId.topic;
            const diff = sub.questionId.difficulty;

            // Track best score for this question ID
            if (!questionBestScores[qId]) {
                questionBestScores[qId] = {
                    score: sub.overallScore,
                    topic,
                    difficulty: diff
                };
            } else if (sub.overallScore > questionBestScores[qId].score) {
                questionBestScores[qId].score = sub.overallScore;
            }

            // Track chronological scores for topic progress tracking
            if (!submissionsByTopic[topic]) {
                submissionsByTopic[topic] = [];
            }
            submissionsByTopic[topic].push({
                score: sub.overallScore,
                date: sub.createdAt
            });
        });

        // 3. Compute Coding Readiness Score (average of maximum scores on unique questions)
        const uniqueAttempts = Object.values(questionBestScores);
        let sumUniqueBest = 0;
        uniqueAttempts.forEach(attempt => sumUniqueBest += attempt.score);
        const codingReadinessScore = uniqueAttempts.length > 0
            ? Math.round(sumUniqueBest / uniqueAttempts.length)
            : 0;

        // 4. Group by Topic to determine strengths and weaknesses
        // We aggregate the best score achieved for each question in a given topic, and find the average.
        const topicBestAggregate = {}; // topic -> { sum: 0, count: 0 }
        uniqueAttempts.forEach(attempt => {
            const topic = attempt.topic;
            if (!topicBestAggregate[topic]) {
                topicBestAggregate[topic] = { sum: 0, count: 0 };
            }
            topicBestAggregate[topic].sum += attempt.score;
            topicBestAggregate[topic].count += 1;
        });

        const strongTopics = [];
        const weakTopics = [];
        Object.entries(topicBestAggregate).forEach(([topic, data]) => {
            const avg = Math.round(data.sum / data.count);
            if (avg >= 75) {
                strongTopics.push({ topic, averageScore: avg });
            } else {
                weakTopics.push({ topic, averageScore: avg });
            }
        });

        // 5. Difficulty Distribution
        // Count total attempts or count solved (overallScore >= 60) per difficulty. Let's count solved / attempted.
        const difficultyDistribution = { Easy: 0, Medium: 0, Hard: 0 };
        uniqueAttempts.forEach(attempt => {
            const diff = attempt.difficulty; // 'Easy', 'Medium', 'Hard'
            if (difficultyDistribution[diff] !== undefined) {
                difficultyDistribution[diff] += 1;
            }
        });

        // 6. Recent Attempts (latest 6, sorted descending)
        const recentAttempts = [...submissions]
            .reverse()
            .slice(0, 6)
            .map(sub => ({
                id: sub._id,
                title: sub.questionId?.title || "Unknown Question",
                topic: sub.questionId?.topic || "General",
                difficulty: sub.questionId?.difficulty || "Medium",
                language: sub.language,
                overallScore: sub.overallScore,
                createdAt: sub.createdAt
            }));

        // 7. Topic Progress Tracking (chronological lists of attempts per topic)
        const progressTracking = Object.entries(submissionsByTopic).map(([topic, attempts]) => ({
            topic,
            attempts: attempts.map((att, idx) => ({
                attemptNumber: idx + 1,
                score: att.score,
                date: att.date
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
        console.error("Error in getUserProgress:", error);
        next(error);
    }
}

module.exports = {
    getQuestions,
    getQuestionById,
    generateCustomQuestion,
    submitCode,
    getSubmissions,
    getUserProgress
};
