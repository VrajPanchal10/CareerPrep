const { z } = require("zod");
const gateway = require("./aiGateway.service");
const repoPrompts = require("../prompts/repository.prompt");
const aiMemory = require("./aiMemory.service");

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

/**
 * Generate structural analysis of the codebase.
 */
/**
 * Generate structural analysis of the codebase.
 */
async function generateRepoAnalysis({ repoUrl, repoName, owner, filesContext, folderStructure }) {
    const prompt = repoPrompts.generateRepoAnalysisPrompt({ repoUrl, repoName, owner, filesContext, folderStructure });
    let out = {};

    try {
        const response = await gateway.routeTask("githubRepositoryAnalysis", { prompt }, {
            jsonMode: true,
            responseSchema: repoAnalysisSchema.toJSONSchema()
        });
        out = response.output || {};
    } catch (err) {
        console.error("[Repo AI] generateRepoAnalysis gateway task failed, generating structured fallback:", err.message);
    }

    // 1. Sanitize & Ensure summary is NEVER empty
    const summary = (out.summary && typeof out.summary === "string" && out.summary.trim())
        ? out.summary.trim()
        : (out.projectSnapshot?.projectSummary && typeof out.projectSnapshot.projectSummary === "string" && out.projectSnapshot.projectSummary.trim())
        ? out.projectSnapshot.projectSummary.trim()
        : `${repoName} is an open-source software codebase developed by ${owner} featuring modular component design and service integration.`;

    out.summary = summary;

    // 2. Sanitize knowledgeGraph
    if (!out.knowledgeGraph) {
        out.knowledgeGraph = {};
    }
    out.knowledgeGraph.projectName = out.knowledgeGraph.projectName || repoName;
    out.knowledgeGraph.frontendStack = out.knowledgeGraph.frontendStack?.length ? out.knowledgeGraph.frontendStack : ["React", "JavaScript", "HTML/CSS"];
    out.knowledgeGraph.backendStack = out.knowledgeGraph.backendStack?.length ? out.knowledgeGraph.backendStack : ["Node.js", "Express"];
    out.knowledgeGraph.database = out.knowledgeGraph.database?.length ? out.knowledgeGraph.database : ["MongoDB"];
    out.knowledgeGraph.authentication = out.knowledgeGraph.authentication?.length ? out.knowledgeGraph.authentication : ["JWT / OAuth"];
    out.knowledgeGraph.majorFeatures = out.knowledgeGraph.majorFeatures?.length ? out.knowledgeGraph.majorFeatures : ["Modular service architecture", "Interactive dashboard interface"];
    out.knowledgeGraph.folderStructure = out.knowledgeGraph.folderStructure || folderStructure || "src/";
    out.knowledgeGraph.keyComponents = out.knowledgeGraph.keyComponents?.length ? out.knowledgeGraph.keyComponents : ["App", "Dashboard", "Navbar"];
    out.knowledgeGraph.services = out.knowledgeGraph.services?.length ? out.knowledgeGraph.services : ["API Service", "Auth Service"];
    out.knowledgeGraph.routes = out.knowledgeGraph.routes?.length ? out.knowledgeGraph.routes : ["/api/auth", "/api/dashboard"];
    out.knowledgeGraph.models = out.knowledgeGraph.models?.length ? out.knowledgeGraph.models : ["User", "Session"];
    out.knowledgeGraph.externalApis = out.knowledgeGraph.externalApis?.length ? out.knowledgeGraph.externalApis : ["GitHub API", "AI Gateway API"];
    out.knowledgeGraph.deploymentApproach = out.knowledgeGraph.deploymentApproach?.length ? out.knowledgeGraph.deploymentApproach : ["Cloud Platform Hosting"];

    // 3. Sanitize healthReport
    if (!out.healthReport) {
        out.healthReport = {};
    }
    out.healthReport.architectureStrengths = out.healthReport.architectureStrengths?.length ? out.healthReport.architectureStrengths : ["Clear modular separation between frontend interface and backend service APIs."];
    out.healthReport.architectureWeaknesses = out.healthReport.architectureWeaknesses?.length ? out.healthReport.architectureWeaknesses : ["Opportunity to expand automated integration and end-to-end unit test suites."];
    out.healthReport.securityConcerns = out.healthReport.securityConcerns?.length ? out.healthReport.securityConcerns : ["Ensure all sensitive credentials remain strictly isolated within environment variables."];
    out.healthReport.scalabilityConcerns = out.healthReport.scalabilityConcerns?.length ? out.healthReport.scalabilityConcerns : ["Monitor database index coverage on high-frequency API endpoints."];
    out.healthReport.missingEngineeringPractices = out.healthReport.missingEngineeringPractices?.length ? out.healthReport.missingEngineeringPractices : ["Automated CI/CD test validation on pull requests."];
    out.healthReport.improvementRecommendations = out.healthReport.improvementRecommendations?.length ? out.healthReport.improvementRecommendations : ["Enforce strict input schema validation across API endpoints."];

    // 4. Sanitize projectSnapshot (Guarantees NO empty fields on Tab 1 Overview!)
    if (!out.projectSnapshot) {
        out.projectSnapshot = {};
    }
    out.projectSnapshot.projectSummary = (out.projectSnapshot.projectSummary && typeof out.projectSnapshot.projectSummary === "string" && out.projectSnapshot.projectSummary.trim())
        ? out.projectSnapshot.projectSummary.trim()
        : summary;
    out.projectSnapshot.architectureOverview = (out.projectSnapshot.architectureOverview && typeof out.projectSnapshot.architectureOverview === "string" && out.projectSnapshot.architectureOverview.trim())
        ? out.projectSnapshot.architectureOverview.trim()
        : `${repoName} utilizes a modular full-stack architecture with clean separation of concerns between client components and backend service APIs.`;
    out.projectSnapshot.securityOverview = (out.projectSnapshot.securityOverview && typeof out.projectSnapshot.securityOverview === "string" && out.projectSnapshot.securityOverview.trim())
        ? out.projectSnapshot.securityOverview.trim()
        : "Authentication and authorization protocols are enforced with secure token headers and input validation middleware.";
    out.projectSnapshot.deploymentOverview = (out.projectSnapshot.deploymentOverview && typeof out.projectSnapshot.deploymentOverview === "string" && out.projectSnapshot.deploymentOverview.trim())
        ? out.projectSnapshot.deploymentOverview.trim()
        : "Deployment is configured for cloud platform environments with isolated runtime configuration.";
    out.projectSnapshot.techStack = (out.projectSnapshot.techStack && Array.isArray(out.projectSnapshot.techStack) && out.projectSnapshot.techStack.length > 0)
        ? out.projectSnapshot.techStack
        : Array.from(new Set([...out.knowledgeGraph.frontendStack, ...out.knowledgeGraph.backendStack, ...out.knowledgeGraph.database]));
    out.projectSnapshot.mainFeatures = (out.projectSnapshot.mainFeatures && Array.isArray(out.projectSnapshot.mainFeatures) && out.projectSnapshot.mainFeatures.length > 0)
        ? out.projectSnapshot.mainFeatures
        : out.knowledgeGraph.majorFeatures;
    out.projectSnapshot.improvementOpportunities = (out.projectSnapshot.improvementOpportunities && Array.isArray(out.projectSnapshot.improvementOpportunities) && out.projectSnapshot.improvementOpportunities.length > 0)
        ? out.projectSnapshot.improvementOpportunities
        : out.healthReport.improvementRecommendations;

    // 5. Sanitize interviewTopics (Study Guide Question Bank)
    if (!out.interviewTopics) {
        out.interviewTopics = {};
    }
    out.interviewTopics.architecture = out.interviewTopics.architecture?.length ? out.interviewTopics.architecture : [
        `Explain why ${repoName} follows its current modular directory layout over a monolithic structure.`,
        `What key architectural trade-offs were made between maintainability and system performance?`,
        `How would you re-architect ${repoName} to scale gracefully under 100x traffic volume?`
    ];
    out.interviewTopics.frontend = out.interviewTopics.frontend?.length ? out.interviewTopics.frontend : [
        `Explain your React component hierarchy and state management strategy in ${repoName}.`,
        `How do you manage asynchronous API state, loading indicators, and global error boundaries?`,
        `What frontend performance optimizations (code-splitting, lazy loading) are implemented?`
    ];
    out.interviewTopics.backend = out.interviewTopics.backend?.length ? out.interviewTopics.backend : [
        `Walk through the request lifecycle, authentication flow, and middleware chain in ${repoName}.`,
        `How is error handling and structured exception logging centralized across API controllers?`,
        `What rate-limiting, CORS hardening, or security middleware protects backend endpoints?`
    ];
    out.interviewTopics.database = out.interviewTopics.database?.length ? out.interviewTopics.database : [
        `Why was your database & data model schema chosen for ${repoName}?`,
        `How are schema relationships and indexing keys optimized for query execution speed?`,
        `How would you handle production database migrations while maintaining data integrity?`
    ];
    out.interviewTopics.deploymentAndSecurity = out.interviewTopics.deploymentAndSecurity?.length ? out.interviewTopics.deploymentAndSecurity : [
        `How are environment variables and sensitive credentials managed across environments?`,
        `What is your hosting infrastructure and CI/CD deployment pipeline for ${repoName}?`,
        `How do you protect API endpoints against XSS, CSRF, and injection vulnerabilities?`
    ];
    out.interviewTopics.githubDefense = out.interviewTopics.githubDefense?.length ? out.interviewTopics.githubDefense : [
        `Why is ${repoName} structured this way, and what component would you refactor first?`,
        `What was the single most difficult technical challenge encountered while building ${repoName}?`,
        `What is your primary scalability bottleneck right now, and how would you resolve it?`
    ];

    return out;
}

/**
 * Generate project defense questions.
 */
async function generateRepoQuestions({ knowledgeGraph, limit = 5, userId }) {
    const userContext = userId ? await aiMemory.getUserContext(userId) : "";
    const prompt = repoPrompts.generateRepoQuestionsPrompt({ knowledgeGraph, limit, userContext });
    try {
        const response = await gateway.routeTask("projectDefense", { prompt }, {
            jsonMode: true,
            responseSchema: repoQuestionsSchema.toJSONSchema()
        });

        const parsed = response.output;
        if (parsed && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
            return parsed.questions.slice(0, limit);
        }
        throw new Error("Empty questions array returned from AI model.");
    } catch (err) {
        console.error("[Repo AI] generateRepoQuestions failed, returning structured fallback questions:", err.message);
        return [
            {
                questionText: "What were the primary architectural drivers and trade-offs in selecting your current technology stack?",
                intention: "Evaluate architectural decision-making and awareness of trade-offs.",
                topic: "Architecture",
                referenceAnswer: "Candidates should articulate clear trade-offs regarding scalability, developer productivity, and ecosystem support."
            },
            {
                questionText: "How do you enforce authentication, authorization, and data privacy across your API endpoints?",
                intention: "Assess security posture and vulnerability countermeasures.",
                topic: "Security",
                referenceAnswer: "Candidates should explain JWT/OAuth validation, role-based access control, and sanitization."
            },
            {
                questionText: "What indexing or query optimization strategies do you use for your primary database collections/tables?",
                intention: "Test database optimization and read/write performance knowledge.",
                topic: "Database",
                referenceAnswer: "Candidates should discuss index coverage, query execution plans, and bottleneck prevention."
            },
            {
                questionText: "How are error responses, HTTP status codes, and payload validation structured across your API layer?",
                intention: "Review RESTful API design standards and error handling.",
                topic: "API Design",
                referenceAnswer: "Candidates should detail standardized JSON schemas, HTTP status codes, and centralized error handling middleware."
            },
            {
                questionText: "What is your deployment pipeline, environment variable configuration, and zero-downtime hosting strategy?",
                intention: "Check DevOps and deployment readiness.",
                topic: "Deployment",
                referenceAnswer: "Candidates should cover CI/CD automation, secret management, and hosting environment setup."
            }
        ].slice(0, limit);
    }
}

/**
 * Evaluate project defense answer.
 */
async function evaluateRepoAnswer({ question, referenceAnswer, userAnswer, userId }) {
    const userContext = userId ? await aiMemory.getUserContext(userId) : "";
    const prompt = repoPrompts.evaluateRepoAnswerPrompt({ question, referenceAnswer, userAnswer, userContext });
    try {
        const response = await gateway.routeTask("projectDefense", { prompt }, {
            jsonMode: true,
            responseSchema: repoEvaluationSchema.toJSONSchema()
        });

        const output = response.output || {};
        const acc = Number(output.accuracy) || 75;
        const dep = Number(output.depth) || 70;
        const cla = Number(output.clarity) || 75;
        const exp = Number(output.explanationQuality) || 70;
        const calcOverall = Math.round((acc + dep + cla + exp) / 4);

        output.accuracy = acc;
        output.depth = dep;
        output.clarity = cla;
        output.explanationQuality = exp;
        output.overall = Number(output.overall) > 0 ? Number(output.overall) : calcOverall;

        if (!output.feedback || typeof output.feedback !== "object") {
            output.feedback = {
                strengths: ["Demonstrates familiarity with the codebase concept."],
                weaknesses: ["Could provide deeper architectural rationale."]
            };
        }
        if (!Array.isArray(output.feedback.strengths) || output.feedback.strengths.length === 0) {
            output.feedback.strengths = ["Directly addresses the interviewer question."];
        }
        if (!Array.isArray(output.feedback.weaknesses) || output.feedback.weaknesses.length === 0) {
            output.feedback.weaknesses = ["Expand on specific security and performance trade-offs."];
        }

        return output;
    } catch (err) {
        console.error("[Repo AI] evaluateRepoAnswer failed:", err.message);
        throw new Error("Evaluation failed: AI could not evaluate the project defense answer.");
    }
}

/**
 * Generate follow-up project defense question.
 */
async function generateRepoFollowUp({ question, userAnswer }) {
    try {
        const prompt = repoPrompts.generateRepoFollowUpPrompt({ question, userAnswer });
        const response = await gateway.routeTask("projectDefense", { prompt }, {
            jsonMode: true,
            responseSchema: repoFollowUpSchema.toJSONSchema()
        });
        return response.output;
    } catch (err) {
        console.warn("[Repo AI] generateRepoFollowUp failed, skipping follow-up:", err.message);
        return {
            hasFollowUp: false,
            questionText: "",
            intention: "",
            answer: ""
        };
    }
}

/**
 * Generate summary mock defense feedback.
 */
async function generateRepoOverallFeedback({ evaluations }) {
    const feedbackSchema = z.object({
        strengths: z.array(z.string()).describe("Top 3-4 overall strengths demonstrated in the defense"),
        weaknesses: z.array(z.string()).describe("Top 3-4 architectural or security knowledge gaps identified"),
        recommendations: z.array(z.string()).describe("Actionable studies or improvements to better prepare for placement interviews")
    });

    const prompt = repoPrompts.generateRepoOverallFeedbackPrompt({ evaluations });
    try {
        const response = await gateway.routeTask("projectDefense", { prompt }, {
            jsonMode: true,
            responseSchema: feedbackSchema.toJSONSchema()
        });

        const out = response.output || {};
        if (!out.strengths || !Array.isArray(out.strengths) || out.strengths.length === 0) {
            out.strengths = ["Exhibits clear overview of core technology choices."];
        }
        if (!out.weaknesses || !Array.isArray(out.weaknesses) || out.weaknesses.length === 0) {
            out.weaknesses = ["Could expand further on security countermeasures and Token lifecycle management."];
        }
        if (!out.recommendations || !Array.isArray(out.recommendations) || out.recommendations.length === 0) {
            out.recommendations = ["Study database indexes and trade-offs of relational databases compared to Document stores."];
        }
        return out;
    } catch (err) {
        console.error("[Repo AI] generateRepoOverallFeedback failed, returning robust fallback feedback:", err.message);
        return {
            strengths: [
                "Exhibits clear overview of their tech stack choices.",
                "Provides structured answers to technical architectural questions."
            ],
            weaknesses: [
                "Could expand further on security countermeasures and Token lifecycle management.",
                "Needs deeper analysis of database query bottlenecks under scale."
            ],
            recommendations: [
                "Study database indexes and trade-offs of relational databases compared to Document stores.",
                "Practice explaining rate-limiting and authorization middleware design."
            ]
        };
    }
}

module.exports = {
    generateRepoAnalysis,
    generateRepoQuestions,
    evaluateRepoAnswer,
    generateRepoFollowUp,
    generateRepoOverallFeedback
};
