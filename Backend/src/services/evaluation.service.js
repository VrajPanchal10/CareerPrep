const { z } = require("zod");
const gateway = require("./aiGateway.service");
const interviewPrompts = require("../prompts/interview.prompt");

const voiceAnswerEvaluationSchema = z.object({
    overallScore: z.number().min(0).max(100),
    communicationScore: z.number().min(0).max(100),
    clarityScore: z.number().min(0).max(100),
    technicalScore: z.number().min(0).max(100),
    explanationScore: z.number().min(0).max(100),
    technicalDepth: z.number().min(0).max(100),
    completeness: z.number().min(0).max(100),
    relevance: z.number().min(0).max(100),
    communicationFlow: z.number().min(0).max(100),
    grammarScore: z.number().min(0).max(100),
    fluencyScore: z.number().min(0).max(100),
    responseStructure: z.string(),
    timeUtilization: z.number(),
    fillerWords: z.array(z.string()),
    confidenceIndicator: z.enum(["Confident", "Neutral", "Hesitant"]),
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    suggestions: z.array(z.string())
});

const voiceFollowUpQuestionSchema = z.object({
    hasFollowUp: z.boolean(),
    questionText: z.string().optional(),
    intention: z.string().optional(),
    answer: z.string().optional()
});

/**
 * Evaluates candidate voice answer with target candidate context, JD and resume details.
 */
async function evaluateVoiceResponse(contextData) {
    const prompt = interviewPrompts.evaluateVoiceAnswerPrompt(contextData);
    
    const response = await gateway.routeTask("liveVoiceInterview", { prompt }, {
        jsonMode: true,
        responseSchema: voiceAnswerEvaluationSchema.toJSONSchema()
    });
    
    return response.output;
}

/**
 * Contextual follow-up question generation leveraging active conversationMemory context.
 */
async function generateContextualFollowUp({ question, userAnswer }) {
    const prompt = interviewPrompts.generateAiFollowUpQuestionPrompt({ question, userAnswer });
    
    const response = await gateway.routeTask("voiceFollowup", { prompt }, {
        jsonMode: true,
        responseSchema: voiceFollowUpQuestionSchema.toJSONSchema()
    });
    
    return response.output;
}

module.exports = {
    evaluateVoiceResponse,
    generateContextualFollowUp
};
