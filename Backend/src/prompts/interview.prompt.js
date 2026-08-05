/**
 * Interview Prompt Templates
 */
module.exports = {
    generateInterviewReportPrompt: ({ resume, selfDescription, jobDescription, deterministicData, userContext }) => {
        return `Generate a comprehensive interview report and preparation plan for a candidate based on the provided details.

Input Data:
Resume: ${resume}
Self Description: ${selfDescription}
Job Description: ${jobDescription}

Deterministic Score Data (MUST USE EXACTLY):
- matchScore: ${deterministicData.baseScore}
- missingKeywords (Skill Gaps): [${deterministicData.missingKeywords.join(", ")}]

${userContext}

Constraints & Anti-Hallucination:
- You MUST output the "matchScore" EXACTLY as provided above (${deterministicData.baseScore}). Do NOT invent your own score.
- Every technical question MUST reference a specific technology or concept from the candidate's resume or the JD. Do NOT generate generic CS trivia.
- Skill gaps MUST be drawn primarily from the missingKeywords list provided. Do NOT invent skill gaps.
- You MUST analyze the Historical Context provided above.
- If the user has a historical weakness, generate technical questions that explicitly test that weakness.
- DO NOT generate generic templates (e.g. Day 1: Learn React). Instead, if the Historical Context shows they already know a skill, skip it. If they failed a previous interview on a topic, you MUST make that topic the primary focus of the preparation plan.

Explanation Requirement (CRITICAL):
- You MUST explain why the matchScore is ${deterministicData.baseScore}.
- Since there is no dedicated explanation field, provide this explanation by appending it to the "title" string.
- Example: "Software Engineer (Match Score: ${deterministicData.baseScore} - Strong alignment with React, but missing ${deterministicData.missingKeywords[0] || 'AWS'})"

Return a detailed JSON matching the required schema exactly.`;
    },

    evaluateUserAnswerPrompt: ({ question, intention, modelAnswer, userAnswer, userContext }) => {
        return `You are a technical interviewer evaluating a candidate's response to an interview question.

Input Data:
Question: ${question}
Interviewer's Intention: ${intention}
Reference Model Answer: ${modelAnswer}
Candidate's Answer: ${userAnswer}

${userContext}

Scoring Methodology & Rubric:
- 0-20: No relevant content or completely empty answer.
- 21-40: Mentions topic but major gaps.
- 41-60: Partially correct with missing depth.
- 61-80: Good coverage with minor gaps.
- 81-100: Comprehensive, detailed, technically accurate.
- overall score MUST be calculated as: 0.30*accuracy + 0.25*depth + 0.25*explanationQuality + 0.20*clarity.
- If the candidate's answer is empty, blank, or irrelevant, all scores MUST be below 20. Do not give artificially high scores (no flattery).

Explanation Requirement (CRITICAL):
- Strengths and weaknesses MUST cite or quote specific phrases from the candidate's answer to justify the scores.
- Explain the scores inside the strengths and weaknesses arrays using distinct bullet points.
- Tailor your feedback recognizing their past attempts found in the Historical Context. If they show improvement in a Historical Weakness, praise it. If they fail again, be stricter.

Provide a detailed, critical and fair evaluation matching the required JSON schema exactly.`;
    },

    evaluateVoiceAnswerPrompt: ({ 
        resume, 
        jobRole, 
        difficulty, 
        question, 
        intention, 
        modelAnswer, 
        userAnswer, 
        topic, 
        previousAnswers = [], 
        conversationMemory = [], 
        userContext,
        responseTime, 
        languageCode 
    }) => {
        const targetLangName = languageCode?.startsWith("hi") ? "Hindi" : (languageCode?.startsWith("gu") ? "Gujarati" : "English");

        return `You are a professional mock interviewer evaluating a candidate's verbal response to an interview question.

Candidate Context:
- Target Job Role: ${jobRole}
- Difficulty Level: ${difficulty}
- Candidate Resume: "${resume}"

Current Question:
- Question: ${question}
- Interviewer's Intention: ${intention}
- Reference Model Answer: ${modelAnswer}
- Topic Category: ${topic}
- Time taken to respond: ${responseTime} seconds
- Language Code used: ${languageCode} (${targetLangName})

Interview History:
- Previous Questions & Answers: ${JSON.stringify(previousAnswers)}
- Active Conversation Memory (prior weak areas): ${JSON.stringify(conversationMemory)}

${userContext}

Candidate's Verbal Answer Transcript:
"${userAnswer}"

CRITICAL MULTILINGUAL MANDATE:
All text strings in the "strengths", "weaknesses", and "suggestions" arrays MUST be written 100% in ${targetLangName}.
Do NOT write feedback in English when ${targetLangName} is selected, except for unavoidable domain technical terms (e.g., REST API, React, JWT, Node.js, MongoDB).

Provide a detailed, critical and fair evaluation based on the verbal response transcript matching the schema.
Analyze the transcript for filler words (like "um", "uh", "actually", "basically", "like").
Return your output as a JSON object matching the requested schema.

Your JSON output MUST match this exact format structure:
{
  "overallScore": 85,
  "communicationScore": 80,
  "clarityScore": 90,
  "technicalScore": 85,
  "explanationScore": 80,
  "technicalDepth": 75,
  "completeness": 80,
  "relevance": 85,
  "communicationFlow": 80,
  "grammarScore": 85,
  "fluencyScore": 80,
  "responseStructure": "STAR",
  "timeUtilization": 0.95,
  "fillerWords": ["um", "basically"],
  "confidenceIndicator": "Confident",
  "strengths": ["string in ${targetLangName}"],
  "weaknesses": ["string in ${targetLangName}"],
  "suggestions": ["string in ${targetLangName}"]
}

Scoring and Evaluation Criteria:
- communicationScore: evaluates flow, narrative structure (e.g. STAR method), and explanation logic.
- clarityScore: evaluates sentence coherence, grammatical structure, and vocabulary.
- technicalScore: evaluates use of domain terminology, concept accuracy, and reference matching.
- explanationScore: evaluates depth, examples, and detailed points covered.
- technicalDepth: score out of 100 measuring code or architecture detail depth.
- completeness: score out of 100 showing how much of the model answer was covered.
- relevance: score out of 100 on how directly the candidate answered the prompt.
- communicationFlow: evaluates overall conversational rhythm.
- grammarScore: grammatical accuracy.
- fluencyScore: language mastery.
- responseStructure: structure format ("STAR", "Chronological", or "Unstructured").
- timeUtilization: ratio of response time versus expected time allocation.
- fillerWords: string array of filler words used.
- confidenceIndicator: "Confident", "Neutral", or "Hesitant".
- overallScore: weighted aggregate.
Ensure comments and suggestions are practical, constructive, and tailored for verbal interview scenarios.`;
    },

    generateAiFollowUpQuestionPrompt: ({ question, userAnswer }) => {
        return `You are a professional mock interviewer conducting a voice interview. 
The candidate was asked a question:
Question: "${question.questionText || question.question}"
Reference Answer: "${question.answer}"

The candidate's response transcript:
"${userAnswer}"

Decide if it is appropriate to ask a brief, contextual follow-up question to probe deeper, clarify a point, or challenge their reasoning.
Return your output as a JSON object matching the requested schema.
If yes, set hasFollowUp to true and provide the questionText (the follow-up question), intention, and guide answer.
If no (e.g., if their answer is fully complete, or too poor to build on, or if no value is added), set hasFollowUp to false.
Keep the follow-up question brief, clear, and natural.`;
    },

    generateVoiceSessionSummaryRecommendationPrompt: ({ evaluations }) => {
        return `You are an expert career coach reviewing a candidate's mock interview performance.
Here is the structured feedback of the user's answers in this practice session:
${JSON.stringify(evaluations, null, 2)}

Based on their strengths, weaknesses, and suggestions, write a single, highly actionable, premium strategic recommendation (max 3 sentences) to help the candidate's future verbal interview preparations.
Avoid generic tips; be specific, constructive, and impactful.`;
    }
};
