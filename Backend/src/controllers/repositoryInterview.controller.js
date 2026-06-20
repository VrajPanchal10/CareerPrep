const mongoose = require("mongoose");
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

// Helper to fetch from GitHub API
async function fetchGithub(url, token) {
    const headers = {
        "User-Agent": "AI-Resume-Analyzer-App",
        "Accept": "application/json"
    };
    if (token) {
        headers["Authorization"] = `token ${token}`;
    }
    const res = await fetch(url, { headers });
    if (!res.ok) {
        throw new Error(`GitHub request failed: ${res.status} ${res.statusText}`);
    }
    return res.json();
}

// Helper to fetch raw content of a file from GitHub
async function fetchGithubRaw(owner, repo, path, branch, token) {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
    const headers = {
        "User-Agent": "AI-Resume-Analyzer-App",
        "Accept": "application/vnd.github.v3.raw"
    };
    if (token) {
        headers["Authorization"] = `token ${token}`;
    }
    const res = await fetch(url, { headers });
    if (!res.ok) {
        throw new Error(`Failed to fetch file content: ${path}`);
    }
    return res.text();
}

/**
 * @description Parses GitHub repository URL to extract owner and repo name.
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
 * @description Phase 1: Fetch and Analyze public/private repository.
 */
async function analyzeRepositoryController(req, res, next) {
    try {
        const { repoUrl, githubToken } = req.body;
        if (!repoUrl) {
            return res.status(400).json({
                success: false,
                message: "GitHub repository URL is required."
            });
        }

        let owner, repo;
        try {
            const parsed = parseGithubUrl(repoUrl);
            owner = parsed.owner;
            repo = parsed.repo;
        } catch (urlErr) {
            return res.status(400).json({
                success: false,
                message: urlErr.message
            });
        }

        console.log(`[Repo Analyzer] Starting analysis for repository: ${owner}/${repo}...`);

        // 1. Fetch Repository Metadata
        let metadata;
        try {
            metadata = await fetchGithub(`https://api.github.com/repos/${owner}/${repo}`, githubToken);
        } catch (metaErr) {
            return res.status(404).json({
                success: false,
                message: "Repository not found or inaccessible. Make sure it is public."
            });
        }

        const sizeKb = metadata.size || 0;
        const defaultBranch = metadata.default_branch || "main";
        const isPrivate = metadata.private || false;

        // Safeguard Limit: Max Repository Size (50MB = 51200 KB)
        const isLargeRepo = sizeKb > 51200;

        // 2. Fetch file tree recursively
        let tree = [];
        let fallbackMode = isLargeRepo;
        
        if (!fallbackMode) {
            try {
                const treeData = await fetchGithub(`https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`, githubToken);
                tree = treeData.tree || [];
            } catch (treeErr) {
                console.warn(`[Repo Analyzer] Failed to fetch recursive tree. Falling back to basic mode.`, treeErr.message);
                fallbackMode = true; // Fallback gracefully if tree API fails
            }
        }

        // Exclusion pattern matching
        const excludePatterns = [
            /node_modules/i, /dist/i, /build/i, /coverage/i, /\.git/i, /\.github/i,
            /bower_components/i, /vendor/i, /assets/i, /public/i, /generated/i, /tmp/i,
            /\.(png|jpg|jpeg|gif|svg|ico|webp|pdf|zip|gz|tar|woff|woff2|eot|ttf|mp4|mp3)$/i
        ];

        const isExcluded = (path) => {
            return excludePatterns.some(regex => regex.test(path));
        };

        // Filter and compile folder structure layout text
        let folderStructureLines = [];
        const filteredTree = tree.filter(node => !isExcluded(node.path));

        // Create directory structure preview (max 100 lines)
        filteredTree.slice(0, 100).forEach(node => {
            folderStructureLines.push(node.path + (node.type === "tree" ? "/" : ""));
        });
        const folderStructureText = folderStructureLines.join("\n") || "Tree unavailable";

        // 3. Prioritize key source/manifest/config files for deep analysis
        const prioritizedFiles = [];
        
        // Find README
        const readmeNode = filteredTree.find(n => n.type === "blob" && /readme\.md$/i.test(n.path));
        if (readmeNode) prioritizedFiles.push(readmeNode.path);

        // Find dependency manifests
        const manifestNode = filteredTree.find(n => n.type === "blob" && /(package\.json|requirements\.txt|go\.mod|pom\.xml|cargo\.toml)$/i.test(n.path));
        if (manifestNode) prioritizedFiles.push(manifestNode.path);

        // Find docker/deployment configs
        const deployNodes = filteredTree.filter(n => n.type === "blob" && /(Dockerfile|docker-compose\.yml|vercel\.json|netlify\.toml)$/i.test(n.path));
        deployNodes.forEach(n => prioritizedFiles.push(n.path));

        // Find env files
        const envNodes = filteredTree.filter(n => n.type === "blob" && /\.env\.(example|sample|dev)$/i.test(n.path));
        envNodes.forEach(n => prioritizedFiles.push(n.path));

        // Find controller, route, model, services, app entry files
        const codeNodes = filteredTree.filter(n => 
            n.type === "blob" && 
            /\.(js|jsx|ts|tsx|py|go|java|rs|cpp|h)$/i.test(n.path) &&
            (/(controller|route|service|model)/i.test(n.path) || 
             /(app|server|index|main)\.[a-z]+$/i.test(n.path))
        );
        codeNodes.slice(0, 8).forEach(n => {
            if (!prioritizedFiles.includes(n.path)) {
                prioritizedFiles.push(n.path);
            }
        });

        // 4. Fetch content of selected files within limits
        let filesContextText = "";
        let filesAnalyzedCount = 0;
        const maxFilesLimit = 15;
        const maxCharBudget = 60000; // Character limit sent to AI

        // Fallback check: if large or fallback is active, only fetch README and package.json
        const filesToFetch = fallbackMode 
            ? prioritizedFiles.filter(p => /readme\.md|package\.json/i.test(p))
            : prioritizedFiles;

        for (const filepath of filesToFetch) {
            if (filesAnalyzedCount >= maxFilesLimit) break;
            if (filesContextText.length >= maxCharBudget) break;

            try {
                const rawText = await fetchGithubRaw(owner, repo, filepath, defaultBranch, githubToken);
                // Add header details for the AI
                filesContextText += `\n\n--- FILE: ${filepath} ---\n`;
                // Slice code if single file is too large to fit budget
                filesContextText += rawText.slice(0, 10000);
                filesAnalyzedCount++;
            } catch (fetchErr) {
                console.warn(`[Repo Analyzer] Failed to fetch content for file ${filepath}`, fetchErr.message);
            }
        }

        if (filesContextText.trim() === "") {
            filesContextText = "No codebase files could be retrieved.";
        }

        // 5. Invoke Gemini service to compile Project Audit and Knowledge Graph
        const aiAnalysis = await generateRepoAnalysis({
            repoUrl,
            repoName: repo,
            owner,
            filesContext: filesContextText.slice(0, maxCharBudget),
            folderStructure: folderStructureText
        });

        // 6. Save in DB
        const savedAnalysis = await repositoryAnalysisModel.create({
            user: req.user.id,
            repoUrl,
            repoName: repo,
            owner,
            isPrivate,
            authMethod: githubToken ? "token" : "none",
            summary: aiAnalysis.summary,
            knowledgeGraph: aiAnalysis.knowledgeGraph,
            healthReport: aiAnalysis.healthReport,
            projectSnapshot: aiAnalysis.projectSnapshot
        });

        return res.status(201).json({
            success: true,
            message: "Repository analyzed successfully.",
            analysis: savedAnalysis
        });

    } catch (error) {
        console.error("Error in analyzeRepositoryController:", error);
        next(error);
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
        console.log(`[Repo Interview] Generating ${limit} questions for ${analysis.repoName}...`);
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
        console.error("Error in startRepositoryInterviewController:", error);
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
        console.log(`[Repo Interview] Evaluating question index ${questionIndex}...`);
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

        // Handle Contextual Follow-Up question (max limit 1 follow-up level)
        let followUpQuestion = null;
        if (!question.isFollowUp) {
            const alreadyHasFollowUp = session.questions.some(
                q => q.isFollowUp && q.parentQuestionIndex === questionIndex
            );

            if (!alreadyHasFollowUp) {
                console.log(`[Repo Interview] Generating follow-up check...`);
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

                    // Inject follow-up immediately below the answered question index
                    session.questions.splice(questionIndex + 1, 0, followUpQuestion);
                    console.log(`[Repo Interview] Follow-up question injected at index ${questionIndex + 1}`);
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
        console.error("Error in submitRepositoryAnswerController:", error);
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
        console.error("Error in completeRepositoryInterviewController:", error);
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
        console.error("Error in getRepositoryDashboardDataController:", error);
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
        console.error("Error in getRepositoryInterviewByIdController:", error);
        next(error);
    }
}

module.exports = {
    analyzeRepositoryController,
    startRepositoryInterviewController,
    submitRepositoryAnswerController,
    completeRepositoryInterviewController,
    getRepositoryDashboardDataController,
    getRepositoryInterviewByIdController
};
