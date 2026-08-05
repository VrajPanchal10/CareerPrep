const AtsReport = require("../models/atsReport.model");
const InterviewReport = require("../models/interviewReport.model");
const VoiceInterviewSession = require("../models/voiceSession.model");
const RepositoryAnalysis = require("../models/repositoryAnalysis.model");
const { logger } = require("../utils/securityLogger");

/**
 * AI Memory Service
 * Aggregates a user's historical performance across all AI modules (ATS, Text Interview, Voice Interview, GitHub)
 * to provide a unified Cross-Module AI Memory context.
 */

async function getUserContext(userId) {
    try {
        // Run queries in parallel using lean() for optimal performance
        const [atsReport, interviewReport, voiceSession, repoAnalysis] = await Promise.all([
            AtsReport.findOne({ user: userId }).sort({ createdAt: -1 }).lean(),
            InterviewReport.findOne({ user: userId }).sort({ createdAt: -1 }).lean(),
            VoiceInterviewSession.findOne({ user: userId, status: "completed" }).sort({ createdAt: -1 }).lean(),
            RepositoryAnalysis.findOne({ user: userId }).sort({ createdAt: -1 }).lean()
        ]);

        const memory = {
            missingAtsKeywords: [],
            interviewSkillGaps: [],
            voiceWeaknesses: [],
            githubArchitectureWeaknesses: []
        };

        if (atsReport && atsReport.missingKeywords) {
            memory.missingAtsKeywords = atsReport.missingKeywords;
        }

        if (interviewReport && interviewReport.skillGaps) {
            // skillGaps is an array of objects { skill, severity }
            memory.interviewSkillGaps = interviewReport.skillGaps.map(g => g.skill);
        }

        if (voiceSession && voiceSession.weakAreas) {
            memory.voiceWeaknesses = voiceSession.weakAreas;
        }

        if (repoAnalysis && repoAnalysis.healthReport && repoAnalysis.healthReport.architectureWeaknesses) {
            memory.githubArchitectureWeaknesses = repoAnalysis.healthReport.architectureWeaknesses;
        }

        // Format into a structured text context for the LLM
        let contextText = `=== HISTORICAL CANDIDATE CONTEXT (AI MEMORY) ===\n`;
        contextText += `The candidate has the following historical weaknesses identified by other AI modules. You MUST prioritize these topics in your generation if relevant to the job description.\n\n`;
        
        let hasData = false;
        if (memory.missingAtsKeywords.length > 0) {
            contextText += `- ATS Missing Keywords: ${memory.missingAtsKeywords.join(", ")}\n`;
            hasData = true;
        }
        if (memory.interviewSkillGaps.length > 0) {
            contextText += `- Previous Interview Skill Gaps: ${memory.interviewSkillGaps.join(", ")}\n`;
            hasData = true;
        }
        if (memory.voiceWeaknesses.length > 0) {
            contextText += `- Previous Voice Interview Weaknesses: ${memory.voiceWeaknesses.join(", ")}\n`;
            hasData = true;
        }
        if (memory.githubArchitectureWeaknesses.length > 0) {
            contextText += `- GitHub Defense Weaknesses: ${memory.githubArchitectureWeaknesses.join(", ")}\n`;
            hasData = true;
        }

        if (!hasData) {
            contextText += `No historical weaknesses found. Assume a standard baseline.\n`;
        }
        contextText += `=================================================\n`;

        return contextText;

    } catch (error) {
        logger.error(`[AI Memory Service] Failed to aggregate context for user ${userId}: ${error.message}`);
        // Fail open: If memory fails, return empty context so core flow doesn't break
        return `=== HISTORICAL CANDIDATE CONTEXT (AI MEMORY) ===\nNo historical data available due to internal retrieval error.\n=================================================\n`;
    }
}

module.exports = {
    getUserContext
};
