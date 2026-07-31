const mongoose = require("mongoose");
const userModel = require("../models/user.model");
const repositoryAnalysisModel = require("../models/repositoryAnalysis.model");
const repositoryInterviewModel = require("../models/repositoryInterview.model");
const repositoryInterviewResultModel = require("../models/repositoryInterviewResult.model");
const { 
    generateRepoAnalysis, 
    generateRepoQuestions, 
    evaluateRepoAnswer, 
    generateRepoFollowUp, 
    generateRepoOverallFeedback 
} = require("../services/repositoryAi.service");

// New modular GitHub service layer
const oauthService = require("../services/github/githubOAuth.service");
const githubRepositoryService = require("../services/github/githubRepository.service");
const githubApiService = require("../services/github/githubApi.service");
const { GITHUB_ERROR_CODES } = require("../services/github/githubApi.service");

const { logger } = require("../utils/securityLogger");

/**
 * Resolves the plaintext GitHub access token from the User document.
 * Returns null if no GitHub account is connected.
 * @param {string} userId
 * @returns {Promise<string|null>}
 */
/**
 * Resolves the plaintext GitHub access token from the User document.
 * Returns GITHUB_SYSTEM_TOKEN as fallback, or null for anonymous.
 * Throws GITHUB_DECRYPTION_FAILED if user token is corrupted.
 * @param {string} userId
 * @returns {Promise<{token: string|null, source: string, scopes: string[]}>}
 */
async function resolveUserToken(userId) {
    const user = await userModel.findById(userId).select("githubOAuth");
    const gh = user?.githubOAuth;
    
    if (!gh || !gh.encryptedAccessToken || !gh.tokenIv || !gh.tokenAuthTag) {
        return {
            token: process.env.GITHUB_SYSTEM_TOKEN || null,
            source: process.env.GITHUB_SYSTEM_TOKEN ? "system" : "anonymous",
            scopes: []
        };
    }

    try {
        const decrypted = oauthService.decryptToken({
            encrypted: gh.encryptedAccessToken,
            iv: gh.tokenIv,
            authTag: gh.tokenAuthTag
        });
        return {
            token: decrypted,
            source: "user",
            scopes: gh.scopes || []
        };
    } catch (err) {
        logger.error(`[repositoryInterview] Token decryption failed for user ${userId}:`, err.message);
        throw new Error("GITHUB_DECRYPTION_FAILED");
    }
}

/**
 * Parses GitHub repository URL to extract owner and repo name.
 * Retained for public-repo URL input fallback path.
 */
function parseGithubUrl(repoUrl) {
    const cleaned = repoUrl.trim().replace(/\.git$/, "").replace(/\/$/, "");
    const match = cleaned.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
        throw new Error("Invalid GitHub repository URL. Format should be: https://github.com/owner/repo");
    }
    return { owner: match[1], repo: match[2] };
}

/**
 * Maps GitHubApiError codes to user-friendly HTTP responses.
 */
function handleGithubError(err, res) {
    const userMessages = {
        [GITHUB_ERROR_CODES.UNAUTHORIZED]: { status: 401, message: err.message || "GitHub token is invalid or expired. Please reconnect your GitHub account in Settings." },
        [GITHUB_ERROR_CODES.FORBIDDEN]:    { status: 403, message: err.message || "Access denied. You do not have permission to access this repository." },
        [GITHUB_ERROR_CODES.NOT_FOUND]:    { status: 404, message: err.message || "Repository not found. Please check the URL or your access permissions." },
        [GITHUB_ERROR_CODES.RATE_LIMITED]: { status: 429, message: err.message || "GitHub API rate limit reached. Please wait a few minutes before retrying." },
        [GITHUB_ERROR_CODES.NETWORK_ERROR]:{ status: 503, message: "Could not reach GitHub. Please check your internet connection and try again." },
        "REPO_TOO_LARGE":                  { status: 413, message: err.message },
        "EMPTY_REPOSITORY":                { status: 400, message: err.message || "Repository contains no analyzable source files." },
        "ANALYSIS_CANCELLED":              { status: 409, message: "Repository analysis was cancelled." }
    };
    const mapped = userMessages[err.code] || { status: err.httpStatus || 500, message: err.message || "An unexpected error occurred during repository analysis." };
    return res.status(mapped.status).json({ success: false, message: mapped.message });
}

/**
 * @description Phase 1: Analyze repository (public or private via OAuth).
 *
 * Request body:
 *   repoUrl     {string}  — GitHub URL (used for public repos or as fallback)
 *   owner       {string}  — Optional; if provided alongside repo, URL is not needed
 *   repo        {string}  — Optional; same as above
 *   forceAnalysis {boolean} — Skip large-repo confirmation prompt
 *
 * Token is NEVER accepted from the request body. It is resolved server-side
 * from the authenticated user's encrypted OAuth credentials.
 */
async function analyzeRepositoryController(req, res, next) {
    try {
        const { repoUrl, owner: bodyOwner, repo: bodyRepo, forceAnalysis = false } = req.body;

        // Resolve owner/repo — either from explicit params or by parsing the URL
        let owner, repo;
        try {
            if (bodyOwner && bodyRepo) {
                owner = bodyOwner;
                repo = bodyRepo;
            } else if (repoUrl) {
                const parsed = parseGithubUrl(repoUrl);
                owner = parsed.owner;
                repo = parsed.repo;
            } else {
                return res.status(400).json({
                    success: false,
                    message: "Provide either a GitHub repository URL or owner + repo fields."
                });
            }
        } catch (parseErr) {
            return res.status(400).json({ success: false, message: parseErr.message });
        }

        // Resolve token from the User document
        let tokenInfo;
        try {
            tokenInfo = await resolveUserToken(req.user.id);
        } catch (err) {
            if (err.message === "GITHUB_DECRYPTION_FAILED") {
                return res.status(401).json({
                    success: false,
                    message: "Your GitHub credentials could not be decrypted. Please reconnect your GitHub account in Settings."
                });
            }
            throw err;
        }

        const { token, source, scopes } = tokenInfo;

        logger.debug(`[Repo Analyzer] Starting analysis for ${owner}/${repo} (auth source: ${source})`);

        // Delegate to the repository analysis service pipeline
        const result = await githubRepositoryService.analyzeRepository({
            owner,
            repo,
            token,
            source,
            scopes,
            userId: req.user.id,
            forceAnalysis: Boolean(forceAnalysis)
        });

        // Large repo — needs user confirmation before proceeding
        if (result.requiresConfirmation) {
            return res.status(200).json({
                success: true,
                requiresConfirmation: true,
                sizeMb: result.sizeMb,
                sizeTier: result.sizeTier,
                message: `This repository is ${result.sizeMb} MB. Analysis may take longer and use more resources. Set forceAnalysis: true to proceed.`
            });
        }

        return res.status(result.cached ? 200 : 201).json({
            success: true,
            cached: result.cached,
            message: result.cached
                ? "Returning cached repository analysis."
                : "Repository analyzed successfully.",
            analysis: result.analysis
        });

    } catch (err) {
        logger.error("Error in analyzeRepositoryController:", err);
        return handleGithubError(err, res);
    }
}


/**
 * @description Phase 3 & 4: Start a new mock Project Defense Interview session.
 */
async function startRepositoryInterviewController(req, res, next) {
    try {
        const { repositoryAnalysisId, interviewLength } = req.body;
        if (!repositoryAnalysisId) {
            return res.status(400).json({
                success: false,
                message: "Repository Analysis ID is required."
            });
        }

        const analysis = await repositoryAnalysisModel.findOne({
            _id: repositoryAnalysisId,
            user: req.user.id
        });

        if (!analysis) {
            return res.status(404).json({
                success: false,
                message: "Repository analysis report not found."
            });
        }

        // Configurable Interview Lengths
        let limit = 5; // Default: Quick
        if (interviewLength === "Standard") {
            limit = 10;
        } else if (interviewLength === "Deep") {
            limit = 15;
        }

        // Generate tailored questions using Gemini
        logger.debug(`[Repo Interview] Generating ${limit} questions for ${analysis.repoName}...`);
        const rawQuestions = await generateRepoQuestions({
            knowledgeGraph: analysis.knowledgeGraph,
            limit
        });

        const formattedQuestions = rawQuestions.map(q => ({
            questionText: q.questionText,
            intention: q.intention,
            topic: q.topic,
            referenceAnswer: q.referenceAnswer,
            isFollowUp: false
        }));

        const session = await repositoryInterviewModel.create({
            user: req.user.id,
            repositoryAnalysis: analysis._id,
            repoName: analysis.repoName,
            repoUrl: analysis.repoUrl,
            interviewLength: interviewLength || "Quick",
            targetQuestionCount: limit,
            questions: formattedQuestions,
            answers: [],
            status: "active"
        });

        return res.status(201).json({
            success: true,
            message: "Project Defense interview session started successfully.",
            session
        });

    } catch (error) {
        logger.error("Error in startRepositoryInterviewController:", error);
        next(error);
    }
}

/**
 * @description Phase 5 & 6: Submit answer, evaluate, and check for follow-up question.
 */
async function submitRepositoryAnswerController(req, res, next) {
    try {
        const { sessionId, questionIndex, userAnswer } = req.body;

        if (!sessionId || questionIndex === undefined || userAnswer === undefined) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: sessionId, questionIndex, userAnswer."
            });
        }

        const session = await repositoryInterviewModel.findOne({
            _id: sessionId,
            user: req.user.id
        });

        if (!session) {
            return res.status(404).json({
                success: false,
                message: "Interview session not found."
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

        // Evaluate user answer
        logger.debug(`[Repo Interview] Evaluating question index ${questionIndex}...`);
        const evaluation = await evaluateRepoAnswer({
            question: question.questionText,
            referenceAnswer: question.referenceAnswer,
            userAnswer
        });

        // Save candidate's answer and evaluation details
        const answerObj = {
            questionIndex,
            questionText: question.questionText,
            userAnswer,
            evaluation
        };

        const existingAnsIdx = session.answers.findIndex(a => a.questionIndex === questionIndex);
        if (existingAnsIdx > -1) {
            session.answers[existingAnsIdx] = answerObj;
        } else {
            session.answers.push(answerObj);
        }

        // Handle Contextual Follow-Up question (strictly cap session.questions.length at targetQuestionCount)
        let followUpQuestion = null;
        const targetLimit = session.targetQuestionCount || 5;

        if (!question.isFollowUp && session.questions.length < targetLimit) {
            const alreadyHasFollowUp = session.questions.some(
                q => q.isFollowUp && q.parentQuestionIndex === questionIndex
            );

            if (!alreadyHasFollowUp) {
                logger.debug(`[Repo Interview] Generating follow-up check...`);
                const followUpResult = await generateRepoFollowUp({
                    question,
                    userAnswer
                });

                if (followUpResult.hasFollowUp) {
                    followUpQuestion = {
                        questionText: followUpResult.questionText,
                        intention: followUpResult.intention,
                        topic: question.topic,
                        referenceAnswer: followUpResult.answer,
                        isFollowUp: true,
                        parentQuestionIndex: questionIndex
                    };

                    // Inject follow-up immediately below answered question index
                    session.questions.splice(questionIndex + 1, 0, followUpQuestion);
                    
                    // Strictly trim questions array to targetLimit so total count never exceeds 5 / 10 / 15
                    if (session.questions.length > targetLimit) {
                        session.questions = session.questions.slice(0, targetLimit);
                    }
                    logger.debug(`[Repo Interview] Follow-up question injected at index ${questionIndex + 1}. Questions count capped at ${session.questions.length}`);
                }
            }
        }

        await session.save();

        return res.status(200).json({
            success: true,
            message: "Answer evaluated successfully.",
            evaluation,
            followUpQuestion,
            session
        });

    } catch (error) {
        logger.error("Error in submitRepositoryAnswerController:", error);
        next(error);
    }
}

/**
 * @description Phase 7: Complete Mock session, compile scores, create Result details.
 */
async function completeRepositoryInterviewController(req, res, next) {
    try {
        const { sessionId } = req.params;

        const session = await repositoryInterviewModel.findOne({
            _id: sessionId,
            user: req.user.id
        });

        if (!session) {
            return res.status(404).json({
                success: false,
                message: "Interview session not found."
            });
        }

        if (session.answers.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Cannot complete an interview session with 0 responses."
            });
        }

        // Calculate score aggregates across categories
        const categories = {
            Architecture: { sum: 0, count: 0 },
            Security: { sum: 0, count: 0 },
            Database: { sum: 0, count: 0 },
            "API Design": { sum: 0, count: 0 },
            Deployment: { sum: 0, count: 0 }
        };

        let totalSum = 0;
        session.answers.forEach(ans => {
            const questionNode = session.questions[ans.questionIndex];
            const topic = questionNode ? questionNode.topic : "Architecture";
            const score = ans.evaluation.overall || 0;

            if (categories[topic]) {
                categories[topic].sum += score;
                categories[topic].count += 1;
            } else {
                categories["Architecture"].sum += score;
                categories["Architecture"].count += 1;
            }
            totalSum += score;
        });

        const overallMasteryScore = Math.round(totalSum / session.answers.length);

        const getCategoryScore = (topicName) => {
            const node = categories[topicName];
            return node && node.count > 0 ? Math.round(node.sum / node.count) : 75; // Default score if no question asked
        };

        const scoresObj = {
            architectureScore: getCategoryScore("Architecture"),
            securityScore: getCategoryScore("Security"),
            databaseScore: getCategoryScore("Database"),
            apiDesignScore: getCategoryScore("API Design"),
            deploymentScore: getCategoryScore("Deployment"),
            overallMasteryScore
        };

        // Call Gemini to review evaluations and write strengths/recommendations
        const finalFeedback = await generateRepoOverallFeedback({
            evaluations: session.answers.map(a => ({
                questionText: a.questionText,
                score: a.evaluation.overall,
                strengths: a.evaluation.feedback.strengths,
                weaknesses: a.evaluation.feedback.weaknesses
            }))
        });

        // Save Results
        const savedResult = await repositoryInterviewResultModel.create({
            user: req.user.id,
            repositoryInterview: session._id,
            repoName: session.repoName,
            repoUrl: session.repoUrl,
            scores: scoresObj,
            feedback: finalFeedback
        });

        session.status = "completed";
        await session.save();

        return res.status(200).json({
            success: true,
            message: "Project Defense mock interview completed.",
            result: savedResult,
            session
        });

    } catch (error) {
        logger.error("Error in completeRepositoryInterviewController:", error);
        next(error);
    }
}

/**
 * @description Phase 8: Fetch Repository Mock dashboard aggregation.
 */
async function getRepositoryDashboardDataController(req, res, next) {
    try {
        const userId = req.user.id;

        // Fetch analyzed repos list
        const analyses = await repositoryAnalysisModel.find({ user: userId }).sort({ createdAt: -1 });

        // Fetch completed interview results
        const results = await repositoryInterviewResultModel.find({ user: userId }).sort({ createdAt: -1 });

        if (results.length === 0) {
            return res.status(200).json({
                success: true,
                analyses,
                dashboard: null
            });
        }

        const latestResult = results[0];

        // Format recent sessions history (max 6)
        const recentInterviews = results.slice(0, 6).map(r => ({
            id: r._id,
            repoName: r.repoName,
            overallScore: r.scores.overallMasteryScore,
            date: r.createdAt
        }));

        // Gathers strong/weak areas based on latest result score breakdown
        const strongAreas = [];
        const weakAreas = [];
        const scoreEntries = [
            { name: "Architecture", val: latestResult.scores.architectureScore },
            { name: "Security", val: latestResult.scores.securityScore },
            { name: "Database", val: latestResult.scores.databaseScore },
            { name: "API Design", val: latestResult.scores.apiDesignScore },
            { name: "Deployment", val: latestResult.scores.deploymentScore }
        ];

        scoreEntries.forEach(entry => {
            if (entry.val >= 75) {
                strongAreas.push(`${entry.name} (${entry.val}%)`);
            } else {
                weakAreas.push(`${entry.name} (${entry.val}%)`);
            }
        });

        const dashboardData = {
            repoName: latestResult.repoName,
            repoUrl: latestResult.repoUrl,
            projectMasteryScore: latestResult.scores.overallMasteryScore,
            architectureScore: latestResult.scores.architectureScore,
            securityScore: latestResult.scores.securityScore,
            databaseScore: latestResult.scores.databaseScore,
            apiDesignScore: latestResult.scores.apiDesignScore,
            deploymentScore: latestResult.scores.deploymentScore,
            recentInterviews,
            strongAreas,
            weakAreas,
            feedback: latestResult.feedback
        };

        return res.status(200).json({
            success: true,
            analyses,
            dashboard: dashboardData
        });

    } catch (error) {
        logger.error("Error in getRepositoryDashboardDataController:", error);
        next(error);
    }
}

/**
 * @description Fetch a specific repository interview session detail.
 */
async function getRepositoryInterviewByIdController(req, res, next) {
    try {
        const { sessionId } = req.params;
        const session = await repositoryInterviewModel.findOne({
            _id: sessionId,
            user: req.user.id
        });

        if (!session) {
            return res.status(404).json({
                success: false,
                message: "Repository interview session not found."
            });
        }

        return res.status(200).json({
            success: true,
            session
        });

    } catch (error) {
        logger.error("Error in getRepositoryInterviewByIdController:", error);
        next(error);
    }
}

/**
 * @description Fetch aggregated historical progress for GitHub Defense.
 * Strictly uses MongoDB data (NO AI calls).
 */
async function getRepositoryProgressStatsController(req, res, next) {
    try {
        const userId = req.user.id;
        const limit = 50; // Pagination/limit for analytics

        // Fetch recent historical records only
        const results = await repositoryInterviewResultModel.find({ user: userId })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

        if (results.length === 0) {
            return res.status(200).json({
                success: true,
                stats: {
                    totalAttempts: 0,
                    averageScore: 0,
                    bestScore: 0,
                    latestScore: 0,
                    recentAttempts: []
                }
            });
        }

        let totalScore = 0;
        let bestScore = 0;
        let latestScore = results[0].scores?.overallMasteryScore || 0;

        const recentAttempts = results.map(r => {
            const score = r.scores?.overallMasteryScore || 0;
            totalScore += score;
            if (score > bestScore) bestScore = score;
            
            // Reconstruct strong and weak areas for the dashboard
            const strongAreas = [];
            const weakAreas = [];
            
            if (r.scores) {
                if (r.scores.architectureScore >= 75) strongAreas.push("Architecture"); else weakAreas.push("Architecture");
                if (r.scores.securityScore >= 75) strongAreas.push("Security"); else weakAreas.push("Security");
                if (r.scores.databaseScore >= 75) strongAreas.push("Database"); else weakAreas.push("Database");
            }

            return {
                id: r._id,
                repoName: r.repoName,
                score: score,
                strongAreas,
                weakAreas,
                createdAt: r.createdAt
            };
        });

        const averageScore = Math.round(totalScore / results.length);

        return res.status(200).json({
            success: true,
            stats: {
                totalAttempts: results.length,
                averageScore,
                bestScore,
                latestScore,
                recentAttempts
            }
        });

    } catch (error) {
        logger.error("Error in getRepositoryProgressStatsController:", error);
        next(error);
    }
}

module.exports = {
    analyzeRepositoryController,
    startRepositoryInterviewController,
    submitRepositoryAnswerController,
    completeRepositoryInterviewController,
    getRepositoryDashboardDataController,
    getRepositoryInterviewByIdController,
    getRepositoryProgressStatsController
};
