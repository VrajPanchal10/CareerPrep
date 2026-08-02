/**
 * Interview Prompt Templates
 */
module.exports = {
    generateInterviewReportPrompt: ({ resume, selfDescription, jobDescription }) => {
        return `Generate an interview report for a candidate with the following details:
Resume: ${resume}
Self Description: ${selfDescription}
Job Description: ${jobDescription}`;
    },

    evaluateUserAnswerPrompt: ({ question, intention, modelAnswer, userAnswer }) => {
        return `You are a technical interviewer evaluating a candidate's response to an interview question.
Question: ${question}
Interviewer's Intention: ${intention}
Reference Model Answer: ${modelAnswer}
Candidate's Answer: ${userAnswer}

Provide a detailed, critical and fair evaluation matching the required schema. Focus on assessing explanation quality and technical accuracy instead of confidence. Keep the feedback practical and constructive.`;
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
