const { z } = require("zod");

const gateway = require("./aiGateway.service");

// Import centralized prompt templates
const atsPrompts = require("../prompts/ats.prompt");
const interviewPrompts = require("../prompts/interview.prompt");

const atsDeterministic = require("./atsDeterministic.service");
const aiMemory = require("./aiMemory.service");

// Zod schema definitions
const interviewReportSchema = z.object({
    matchScore: z.number().describe("A score between 0 and 100 indicating how well the candidate's profile matches the job describe"),
    technicalQuestions: z.array(z.object({
        question: z.string().describe("The technical question can be asked in the interview"),
        intention: z.string().describe("The intention of interviewer behind asking this question"),
        answer: z.string().describe("How to answer this question, what points to cover, what approach to take etc."),
        topic: z.string().describe("The specific topic this question relates to, e.g. React, JavaScript, Node.js, MongoDB, SQL, OOP, System Design, DSA, HTML, CSS, DBMS, Computer Networks, Behavioral, Communication, Problem Solving")
    })).describe("Technical questions that can be asked in the interview along with their intention and how to answer them"),
    behavioralQuestions: z.array(z.object({
        question: z.string().describe("The technical question can be asked in the interview"),
        intention: z.string().describe("The intention of interviewer behind asking this question"),
        answer: z.string().describe("How to answer this question, what points to cover, what approach to take etc."),
        topic: z.string().describe("The specific topic this question relates to, e.g. React, JavaScript, Node.js, MongoDB, SQL, OOP, System Design, DSA, HTML, CSS, DBMS, Computer Networks, Behavioral, Communication, Problem Solving")
    })).describe("Behavioral questions that can be asked in the interview along with their intention and how to answer them"),
    skillGaps: z.array(z.object({
        skill: z.string().describe("The skill which the candidate is lacking"),
        severity: z.enum([ "low", "medium", "high" ]).describe("The severity of this skill gap, i.e. how important is this skill for the job and how much it can impact the candidate's chances")
    })).describe("List of skill gaps in the candidate's profile along with their severity"),
    preparationPlan: z.array(z.object({
        day: z.number().describe("The day number in the preparation plan, starting from 1"),
        focus: z.string().describe("The main focus of this day in the preparation plan, e.g. data structures, system design, mock interviews etc."),
        tasks: z.array(z.string()).describe("List of tasks to be done on this day to follow the preparation plan, e.g. read a specific book or article, solve a set of problems, watch a video etc.")
    })).describe("A day-wise preparation plan for the candidate to follow in order to prepare for the interview effectively"),
    title: z.string().describe("The title of the job for which the interview report is generated"),
});

const atsReportSchema = z.object({
    atsScore: z.number().describe("Overall ATS Match Score (0 to 100) indicating how well the resume matches the job description"),
    breakdown: z.object({
        technicalSkillsMatch: z.number().describe("Score between 0 and 100 for technical skills alignment"),
        experienceMatch: z.number().describe("Score between 0 and 100 for experience level alignment"),
        educationMatch: z.number().describe("Score between 0 and 100 for education requirements alignment"),
        projectsMatch: z.number().describe("Score between 0 and 100 for project relevance"),
        keywordMatch: z.number().describe("Score between 0 and 100 for keyword density and occurrence")
    }).describe("Breakdown of the matching criteria"),
    matchedKeywords: z.array(z.string()).describe("List of keywords from the job description that were found in the resume"),
    missingKeywords: z.array(z.string()).describe("List of critical keywords from the job description that were missing in the resume"),
    extraKeywords: z.array(z.string()).describe("List of keywords present in the resume that are irrelevant or extra for this job description"),
    heatmap: z.array(z.object({
        keyword: z.string().describe("The keyword analyzed"),
        status: z.enum(["matched", "missing", "extra"]).describe("Analysis status"),
        score: z.number().describe("Relevance score between 0 and 100 for this keyword")
    })).describe("Detailed heatmap data mapping keywords from both JD and resume"),
    comparisons: z.object({
        skillComparisons: z.array(z.object({
            skill: z.string().describe("Name of the skill"),
            resumeStatus: z.string().describe("State in candidate resume (e.g. Intermediate, Proficient, Not mentioned)"),
            jdRequirement: z.string().describe("Requirement mentioned in JD (e.g. Required, Preferred, Not specified)"),
            gap: z.string().describe("Description of the gap between resume and JD")
        })),
        projectComparisons: z.array(z.object({
            project: z.string().describe("Relevant project topic or candidate project"),
            relevance: z.string().describe("How relevant it is to the job description"),
            improvement: z.string().describe("How to describe or build a project to better fit the JD requirements")
        })),
        experienceComparisons: z.array(z.object({
            role: z.string().describe("Role or position held"),
            relevance: z.string().describe("Relevance rating/comment"),
            improvement: z.string().describe("How to highlight accomplishments in this role to align with JD")
        }))
    }).describe("Resume vs Job Description side-by-side comparison arrays"),
    recommendations: z.object({
        missingSkills: z.array(z.string()).describe("Top missing skills to learn or list"),
        resumeImprovements: z.array(z.string()).describe("Actionable resume improvements"),
        atsOptimizationSuggestions: z.array(z.string()).describe("ATS specific formatting or keyword optimization tips"),
        estimatedScoreImprovement: z.number().describe("Estimated percentage score increase after implementing suggestions"),
        potentialScore: z.number().describe("Potential ATS score (current score + estimated improvement)")
    }).describe("AI Recommendation Engine output"),
    strengths: z.array(z.string()).describe("Top 3-5 strengths identified in the resume relative to the JD"),
    weaknesses: z.array(z.string()).describe("Top 3-5 weaknesses or gaps identified in the resume relative to the JD")
});

const answerEvaluationSchema = z.object({
    accuracy: z.number().describe("Score between 0 and 100 indicating accuracy of factual points mentioned in answer"),
    depth: z.number().describe("Score between 0 and 100 representing technical depth and detailed conceptual coverage"),
    clarity: z.number().describe("Score between 0 and 100 for grammatical flow, language structure, and explanation clarity"),
    explanationQuality: z.number().describe("Score between 0 and 100 evaluating how well the question was answered with relevant points and concepts"),
    overall: z.number().describe("Overall weighted score between 0 and 100"),
    feedback: z.object({
        strengths: z.array(z.string()).describe("List of strengths in the user's answer"),
        weaknesses: z.array(z.string()).describe("List of gaps or details missing from the user's answer")
    }).describe("AI feedback summarizing pros and cons of the answer")
});


const voiceAnswerEvaluationSchema = z.object({
    overallScore: z.number().min(0).max(100).describe("Weighted aggregate score between 0 and 100 assessing the verbal answer quality"),
    communicationScore: z.number().min(0).max(100).describe("Score out of 100 measuring communication efficiency, coherence, and flow"),
    clarityScore: z.number().min(0).max(100).describe("Score out of 100 for grammar, sentence structure, and vocabulary clarity"),
    technicalScore: z.number().min(0).max(100).describe("Score out of 100 for technical accuracy, domain terms, and frameworks mentioned"),
    explanationScore: z.number().min(0).max(100).describe("Score out of 100 evaluating depth, structure (e.g. STAR method), and examples used"),
    strengths: z.array(z.string()).describe("List of 2-3 key strengths of the verbal answer"),
    weaknesses: z.array(z.string()).describe("List of 2-3 gaps or areas to improve in content or expression"),
    suggestions: z.array(z.string()).describe("Actionable tips for refining the answer and verbal delivery")
});

const voiceFollowUpQuestionSchema = z.object({
    hasFollowUp: z.boolean().describe("Whether to ask a contextual follow-up question (true) or not (false)"),
    questionText: z.string().describe("The contextual follow-up question text (required if hasFollowUp is true)"),
    intention: z.string().describe("The interviewer intention behind asking this follow-up (required if hasFollowUp is true)"),
    answer: z.string().describe("Brief ideal reference answer guide for this follow-up question (required if hasFollowUp is true)")
});

/**
 * Helper to render HTML to PDF buffer via template renderer.
 */
async function generatePdfFromHtml(htmlContent) {
    const { renderPdf } = require("./pdf/pdfRenderer.service");
    return renderPdf(htmlContent, {});
}

/**
 * Generate interview preparation guide.
 */
async function generateInterviewReport({ resume, selfDescription, jobDescription, userId }) {
    const deterministicData = atsDeterministic.evaluate(resume, jobDescription);
    const userContext = userId ? await aiMemory.getUserContext(userId) : "";
    const prompt = interviewPrompts.generateInterviewReportPrompt({ resume, selfDescription, jobDescription, deterministicData, userContext });
    const response = await gateway.routeTask("resumeSuggestions", { prompt }, {
        jsonMode: true,
        responseSchema: interviewReportSchema.toJSONSchema()
    });
    return response.output;
}

/**
 * Generate resume PDF.
 */


/**
 * Generate ATS optimization report.
 */
async function generateAtsReport({ resume, jobDescription }) {
    const deterministicData = atsDeterministic.evaluate(resume, jobDescription);
    const prompt = atsPrompts.generateAtsReportPrompt({ resume, jobDescription, deterministicData });
    const response = await gateway.routeTask("atsResumeAnalysis", { prompt }, {
        jsonMode: true,
        responseSchema: atsReportSchema.toJSONSchema()
    });
    return response.output;
}

/**
 * Evaluate standard mock interview answer.
 */
async function evaluateUserAnswer({ question, intention, modelAnswer, userAnswer, userId }) {
    const userContext = userId ? await aiMemory.getUserContext(userId) : "";
    const prompt = interviewPrompts.evaluateUserAnswerPrompt({ question, intention, modelAnswer, userAnswer, userContext });
    // evaluateUserAnswer uses gemini for complex structural feedback
    const response = await gateway.routeTask("interviewEvaluation", { prompt }, {
        jsonMode: true,
        responseSchema: answerEvaluationSchema.toJSONSchema()
    });
    return response.output;
}


/**
 * Evaluate Live Voice mock interview answer.
 */
async function evaluateVoiceAnswer({ question, intention, modelAnswer, userAnswer, topic }) {
    const prompt = interviewPrompts.evaluateVoiceAnswerPrompt({ question, intention, modelAnswer, userAnswer, topic });
    // Route voice answers evaluation to Groq for latency
    const response = await gateway.routeTask("liveVoiceInterview", { prompt }, {
        jsonMode: true,
        responseSchema: voiceAnswerEvaluationSchema.toJSONSchema()
    });
    return response.output;
}

/**
 * Generate contextual follow-up question.
 */
async function generateAiFollowUpQuestion({ question, userAnswer }) {
    const prompt = interviewPrompts.generateAiFollowUpQuestionPrompt({ question, userAnswer });
    // Route follow-ups generation to Groq
    const response = await gateway.routeTask("voiceFollowup", { prompt }, {
        jsonMode: true,
        responseSchema: voiceFollowUpQuestionSchema.toJSONSchema()
    });
    return response.output;
}

/**
 * Generate voice interview summary recommendation feedback.
 */
async function generateVoiceSessionSummaryRecommendation({ evaluations }) {
    const prompt = interviewPrompts.generateVoiceSessionSummaryRecommendationPrompt({ evaluations });
    // Route summary coaching advice to Groq
    const response = await gateway.routeTask("liveVoiceInterview", { prompt });
    return response.output ? response.output.trim() : "Focus on structuring your responses using the STAR method (Situation, Task, Action, Result) and clearly state your technical choices with domain-specific terms.";
}

module.exports = {
    generateInterviewReport,
    generateAtsReport,
    evaluateUserAnswer,
    evaluateVoiceAnswer,
    generateAiFollowUpQuestion,
    generateVoiceSessionSummaryRecommendation
};