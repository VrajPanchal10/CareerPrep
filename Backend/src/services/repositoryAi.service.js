const { z } = require("zod");
const gateway = require("./aiGateway.service");
const repoPrompts = require("../prompts/repository.prompt");

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
async function generateRepoAnalysis({ repoUrl, repoName, owner, filesContext, folderStructure }) {
    const prompt = repoPrompts.generateRepoAnalysisPrompt({ repoUrl, repoName, owner, filesContext, folderStructure });
    const response = await gateway.routeTask("githubRepositoryAnalysis", { prompt }, {
        jsonMode: true,
        responseSchema: repoAnalysisSchema.toJSONSchema()
    });
    return response.output;
}

/**
 * Generate project defense questions.
 */
async function generateRepoQuestions({ knowledgeGraph, limit = 5 }) {
    const prompt = repoPrompts.generateRepoQuestionsPrompt({ knowledgeGraph, limit });
    const response = await gateway.routeTask("projectDefense", { prompt }, {
        jsonMode: true,
        responseSchema: repoQuestionsSchema.toJSONSchema()
    });

    try {
        const parsed = response.output;
        parsed.questions = parsed.questions.slice(0, limit);
        return parsed.questions;
    } catch (err) {
        throw new Error("Failed to parse response as valid repository questions JSON structure.");
    }
}

/**
 * Evaluate project defense answer.
 */
async function evaluateRepoAnswer({ question, referenceAnswer, userAnswer }) {
    const prompt = repoPrompts.evaluateRepoAnswerPrompt({ question, referenceAnswer, userAnswer });
    const response = await gateway.routeTask("projectDefense", { prompt }, {
        jsonMode: true,
        responseSchema: repoEvaluationSchema.toJSONSchema()
    });
    return response.output;
}

/**
 * Generate follow-up project defense question.
 */
async function generateRepoFollowUp({ question, userAnswer }) {
    const prompt = repoPrompts.generateRepoFollowUpPrompt({ question, userAnswer });
    const response = await gateway.routeTask("projectDefense", { prompt }, {
        jsonMode: true,
        responseSchema: repoFollowUpSchema.toJSONSchema()
    });
    return response.output;
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
        return response.output;
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
};
