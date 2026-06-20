const { GoogleGenAI } = require("@google/genai")
const { z } = require("zod")

const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_GENAI_API_KEY
})

// Model configurations
const PRIMARY_MODEL = process.env.GEMINI_PRIMARY_MODEL || "gemini-2.5-flash"
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-2.5-flash-lite"
const REQUEST_TIMEOUT_MS = parseInt(process.env.GEMINI_REQUEST_TIMEOUT_MS || "30000", 10)

// Helper to wrap a promise in a timeout
function withTimeout(promise, ms, errorMessage = "Request timed out") {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(errorMessage));
        }, ms);
    });
    return Promise.race([
        promise.then((res) => {
            clearTimeout(timeoutId);
            return res;
        }),
        timeoutPromise
    ]);
}

// Helper to wait for a given duration
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Call Gemini with retry logic, token count, timing, and fallback model
async function callGeminiWithRetryAndFallback({ contents, config, primaryModel = PRIMARY_MODEL, fallbackModel = FALLBACK_MODEL }) {
    const timestamp = new Date().toISOString();
    let promptSize = 0;
    let tokenCount = 0;

    try {
        if (typeof contents === "string") {
            promptSize = contents.length;
        } else if (Array.isArray(contents)) {
            promptSize = contents.map(c => typeof c === "string" ? c : JSON.stringify(c)).join("").length;
        } else {
            promptSize = JSON.stringify(contents).length;
        }

        const tokenResponse = await ai.models.countTokens({
            model: primaryModel,
            contents: contents
        });
        tokenCount = tokenResponse.totalTokens;
    } catch (err) {
        console.error(`[Repository AI] [${timestamp}] Failed to calculate tokens:`, err.message);
    }

    const backoffs = [2000, 5000, 10000];
    let currentModel = primaryModel;
    let attempt = 1;
    const maxAttempts = 4;

    while (attempt <= maxAttempts) {
        const startTime = Date.now();
        const attemptTimestamp = new Date().toISOString();
        console.log(`[Repository AI] [${attemptTimestamp}] Attempt ${attempt}/${maxAttempts} using model '${currentModel}' (Prompt size: ${promptSize} chars, ${tokenCount} tokens)`);

        try {
            const response = await withTimeout(
                ai.models.generateContent({
                    model: currentModel,
                    contents: contents,
                    config: config
                }),
                REQUEST_TIMEOUT_MS,
                `Gemini API request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`
            );

            const duration = Date.now() - startTime;
            console.log(`[Repository AI] [${new Date().toISOString()}] Success. Model: ${currentModel}, Time taken: ${duration}ms`);
            return response;
        } catch (error) {
            const duration = Date.now() - startTime;
            const status = error.status || error.code || (error.message && error.message.includes("timed out") ? "TIMEOUT" : "UNKNOWN");
            
            console.error(`[Repository AI] [${new Date().toISOString()}] Attempt ${attempt} failed. Model: currentModel, Status: ${status}, Duration: ${duration}ms. Error:`, error.message || error);

            const isTimeout = status === "TIMEOUT" || error.message?.toLowerCase().includes("timeout");
            const isRetryableStatus = [429, 503, 500, "UNAVAILABLE", "RESOURCE_EXHAUSTED", "INTERNAL"].includes(status) || isTimeout;

            if (isRetryableStatus && attempt < maxAttempts) {
                const backoffMs = backoffs[attempt - 1] || 2000;
                console.warn(`[Repository AI] Retryable error. Waiting ${backoffMs / 1000}s before next attempt...`);
                await delay(backoffMs);
                attempt++;
            } else {
                if (currentModel === primaryModel && fallbackModel && currentModel !== fallbackModel) {
                    console.warn(`[Repository AI] Primary failed. Switching to fallback '${fallbackModel}'...`);
                    currentModel = fallbackModel;
                    attempt = 1;
                    try {
                        const tokenResponse = await ai.models.countTokens({
                            model: currentModel,
                            contents: contents
                        });
                        tokenCount = tokenResponse.totalTokens;
                    } catch (err) {
                        // ignore
                    }
                } else {
                    const structuredError = new Error(error.message || "Failed to generate content from Gemini");
                    structuredError.status = status;
                    structuredError.model = currentModel;
                    structuredError.duration = duration;
                    structuredError.timestamp = new Date().toISOString();
                    throw structuredError;
                }
            }
        }
    }
}

// Zod schema definitions
const repoAnalysisSchema = z.object({
    summary: z.string().describe("High-level summary of the repository purpose, architecture, and overall tech stack."),
    knowledgeGraph: z.object({
        projectName: z.string().describe("Name of the project"),
        frontendStack: z.array(z.string()).describe("Frontend stack tools and frameworks"),
        backendStack: z.array(z.string()).describe("Backend languages and frameworks"),
        database: z.array(z.string()).describe("Databases and ORMs/ODMs used"),
        authentication: z.array(z.string()).describe("Auth tools like JWT, OAuth, or None"),
        majorFeatures: z.array(z.string()).describe("Main features of this project"),
        folderStructure: z.string().describe("Summary or layout description of directory folder structure"),
        keyComponents: z.array(z.string()).describe("Main UI components or structure modules"),
        services: z.array(z.string()).describe("Service layers, helper utilities"),
        routes: z.array(z.string()).describe("Routing paths, page/endpoint lists"),
        models: z.array(z.string()).describe("Data schemas/models used"),
        externalApis: z.array(z.string()).describe("Integrated third-party APIs"),
        deploymentApproach: z.array(z.string()).describe("Deployment settings e.g. Vercel, Docker, AWS")
    }).describe("Technical structure representation"),
    healthReport: z.object({
        architectureStrengths: z.array(z.string()).describe("3-4 strengths of the project structure"),
        architectureWeaknesses: z.array(z.string()).describe("3-4 architecture weaknesses"),
        securityConcerns: z.array(z.string()).describe("Security gaps or exposure issues"),
        scalabilityConcerns: z.array(z.string()).describe("Scaling constraints or performance bottlenecks"),
        missingEngineeringPractices: z.array(z.string()).describe("Missing industry practices like test coverage, CI/CD, logging"),
        improvementRecommendations: z.array(z.string()).describe("Recommendations to refine code structure")
    }).describe("Code review health parameters"),
    projectSnapshot: z.object({
        projectSummary: z.string().describe("Short 1-2 sentence description of the project"),
        techStack: z.array(z.string()).describe("Selected stack technologies"),
        architectureOverview: z.string().describe("Explanation of codebase pattern (e.g. MVC, Clean Architecture)"),
        mainFeatures: z.array(z.string()).describe("Top features of the project"),
        securityOverview: z.string().describe("Description of how security is handled"),
        deploymentOverview: z.string().describe("Description of deployment configuration"),
        improvementOpportunities: z.array(z.string()).describe("Areas of refactoring or enhancement")
    }).describe("Pre-interview audit snapshot details")
});

const repoQuestionsSchema = z.object({
    questions: z.array(z.object({
        questionText: z.string().describe("A professional question challenging the project setup or decision"),
        intention: z.string().describe("Interviewer intention behind asking the question"),
        topic: z.enum(["Architecture", "Database", "Security", "API Design", "Deployment"]).describe("The category this question targets"),
        referenceAnswer: z.string().describe("Detailed guide answer key points required to answer like a senior dev")
    })).describe("Tailored interview questions")
});

const repoEvaluationSchema = z.object({
    accuracy: z.number().min(0).max(100).describe("Factual accuracy score (0-100)"),
    depth: z.number().min(0).max(100).describe("Technical depth score (0-100)"),
    clarity: z.number().min(0).max(100).describe("Verbal explanation clarity score (0-100)"),
    explanationQuality: z.number().min(0).max(100).describe("Architectural justification quality score (0-100)"),
    overall: z.number().min(0).max(100).describe("Overall weighted score (0-100)"),
    feedback: z.object({
        strengths: z.array(z.string()).describe("Key strengths in user answer"),
        weaknesses: z.array(z.string()).describe("Key gaps in user answer")
    })
});

const repoFollowUpSchema = z.object({
    hasFollowUp: z.boolean().describe("Whether to ask a contextual follow-up question"),
    questionText: z.string().describe("The contextual follow-up question text"),
    intention: z.string().describe("Interviewer intention for the follow-up"),
    answer: z.string().describe("Ideal guide answer details for the follow-up")
});

// Service implementation
async function generateRepoAnalysis({ repoUrl, repoName, owner, filesContext, folderStructure }) {
    const prompt = `You are a Senior Software Architect and GitHub Analysis Expert.
Analyze the following public GitHub repository details, including README, package configurations, entry scripts, and selective source code directories.
Construct a high-level summary, knowledge graph, health report, and project snapshot.

Repository Details:
- URL: ${repoUrl}
- Name: ${repoName}
- Owner: ${owner}

Folder Structure Layout:
${folderStructure}

Scraped Code and Manifest Files Context:
${filesContext}

Make sure to evaluate:
1. Architecture Patterns: Folder structures, design models, code separation.
2. Health Report: Security concerns, scalability bottlenecks, missing practices (lack of unit tests, logging, Docker configurations, environment validation).
3. Project Snapshot: Bulleted overviews of security, deployment, features, and tech stack.

Format the output as JSON according to the schema.
`;

    const response = await callGeminiWithRetryAndFallback({
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: repoAnalysisSchema.toJSONSchema()
        }
    });

    try {
        return JSON.parse(response.text);
    } catch (err) {
        throw new Error("Failed to parse Gemini response as valid Repository Analysis JSON");
    }
}

async function generateRepoQuestions({ knowledgeGraph, limit = 5 }) {
    const prompt = `You are a Technical Interview Designer and Staff Software Engineer.
Generate exactly ${limit} customized, challenging "Project Defense" interview questions based on this Project Knowledge Graph.

Knowledge Graph Details:
${JSON.stringify(knowledgeGraph, null, 2)}

Requirements:
- Target these 5 core topics in rotation: "Architecture", "Database", "Security", "API Design", "Deployment".
- Create questions that challenge decisions (e.g. "Why did you select MongoDB over PostgreSQL?", "How would you handle token invalidation in your JWT setup?").
- Adjust questions to feel like a real technical defense.
- Provide a detailed referenceAnswer for each question, tailored specifically to this project's stack.

Output format must be JSON according to the schema.
`;

    const response = await callGeminiWithRetryAndFallback({
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: repoQuestionsSchema.toJSONSchema()
        }
    });

    try {
        const parsed = JSON.parse(response.text);
        // Ensure we respect the required count limit
        parsed.questions = parsed.questions.slice(0, limit);
        return parsed.questions;
    } catch (err) {
        throw new Error("Failed to parse Gemini response as valid Repository Questions JSON");
    }
}

async function evaluateRepoAnswer({ question, referenceAnswer, userAnswer }) {
    const prompt = `You are a Technical Interviewer conducting a project defense interview.
Evaluate the candidate's answer for the following question, checking accuracy, depth, clarity, and justification quality.

Question: ${question}
Ideal Reference Guide Answer: ${referenceAnswer}
Candidate's Answer: ${userAnswer}

Provide scores from 0 to 100 for accuracy, depth, clarity, explanationQuality, and overall score. Write constructive strengths and weaknesses feedback.

Output format must be JSON according to the schema.
`;

    const response = await callGeminiWithRetryAndFallback({
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: repoEvaluationSchema.toJSONSchema()
        }
    });

    try {
        return JSON.parse(response.text);
    } catch (err) {
        throw new Error("Failed to parse Gemini response as valid Answer Evaluation JSON");
    }
}

async function generateRepoFollowUp({ question, userAnswer }) {
    const prompt = `You are a mock interviewer.
Based on the question asked: "${question.questionText}"
And the candidate's response: "${userAnswer}"

Determine if it is appropriate to ask a brief, contextual follow-up question to probe deeper, challenge their decision-making logic, or address gaps in their explanation.
If yes, set hasFollowUp to true and populate the follow-up question text, intention, and reference answer.
If their answer was fully complete, or too brief to build upon, set hasFollowUp to false.

Output format must be JSON according to the schema.
`;

    const response = await callGeminiWithRetryAndFallback({
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: repoFollowUpSchema.toJSONSchema()
        }
    });

    try {
        return JSON.parse(response.text);
    } catch (err) {
        throw new Error("Failed to parse Gemini response as valid Follow-up JSON");
    }
}

async function generateRepoOverallFeedback({ evaluations }) {
    const feedbackSchema = z.object({
        strengths: z.array(z.string()).describe("Top 3-4 overall strengths demonstrated in the defense"),
        weaknesses: z.array(z.string()).describe("Top 3-4 architectural or security knowledge gaps identified"),
        recommendations: z.array(z.string()).describe("Actionable studies or improvements to better prepare for placement interviews")
    });

    const prompt = `You are a Senior Engineering Mentor.
Review the evaluations of a candidate's project defense session:
${JSON.stringify(evaluations, null, 2)}

Provide overall strengths, weaknesses, and optimization recommendations.
Output format must be JSON.
`;

    const response = await callGeminiWithRetryAndFallback({
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: feedbackSchema.toJSONSchema()
        }
    });

    try {
        return JSON.parse(response.text);
    } catch (err) {
        return {
            strengths: ["Exhibits clear overview of their tech stack choices."],
            weaknesses: ["Could expand further on security countermeasures and Token lifecycle management."],
            recommendations: ["Study database indexes and trade-offs of relational databases compared to Document stores."]
        };
    }
}

module.exports = {
    generateRepoAnalysis,
    generateRepoQuestions,
    evaluateRepoAnswer,
    generateRepoFollowUp,
    generateRepoOverallFeedback
}
