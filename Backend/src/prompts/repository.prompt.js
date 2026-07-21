/**
 * GitHub Repository Analysis & Project Defense Prompt Templates
 */
module.exports = {
    generateRepoAnalysisPrompt: ({ repoUrl, repoName, owner, filesContext, folderStructure }) => {
        return `You are a Senior Software Architect and GitHub Analysis Expert.
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

Format the output as JSON according to the schema.`;
    },

    generateRepoQuestionsPrompt: ({ knowledgeGraph, limit }) => {
        return `You are a Technical Interview Designer and Staff Software Engineer.
Generate exactly ${limit} customized, challenging "Project Defense" interview questions based on this Project Knowledge Graph.

Knowledge Graph Details:
${JSON.stringify(knowledgeGraph, null, 2)}

Requirements:
- Target these 5 core topics in rotation: "Architecture", "Database", "Security", "API Design", "Deployment".
- Create questions that challenge decisions (e.g. "Why did you select MongoDB over PostgreSQL?", "How would you handle token invalidation in your JWT setup?").
- Adjust questions to feel like a real technical defense.
- Provide a detailed referenceAnswer for each question, tailored specifically to this project's stack.

Output format must be JSON according to the schema.`;
    },

    evaluateRepoAnswerPrompt: ({ question, referenceAnswer, userAnswer }) => {
        return `You are a Technical Interviewer conducting a project defense interview.
Evaluate the candidate's answer for the following question, checking accuracy, depth, clarity, and justification quality.

Question: ${question}
Ideal Reference Guide Answer: ${referenceAnswer}
Candidate's Answer: ${userAnswer}

Provide scores from 0 to 100 for accuracy, depth, clarity, explanationQuality, and overall score. Write constructive strengths and weaknesses feedback.

Output format must be JSON according to the schema.`;
    },

    generateRepoFollowUpPrompt: ({ question, userAnswer }) => {
        return `You are a mock interviewer.
Based on the question asked: "${question.questionText}"
And the candidate's response: "${userAnswer}"

Determine if it is appropriate to ask a brief, contextual follow-up question to probe deeper, challenge their decision-making logic, or address gaps in their explanation.
If yes, set hasFollowUp to true and populate the follow-up question text, intention, and reference answer.
If their answer was fully complete, or too brief to build upon, set hasFollowUp to false.

Output format must be JSON according to the schema.`;
    },

    generateRepoOverallFeedbackPrompt: ({ evaluations }) => {
        return `You are a Senior Engineering Mentor.
Review the evaluations of a candidate's project defense session:
${JSON.stringify(evaluations, null, 2)}

Provide overall strengths, weaknesses, and optimization recommendations.
Output format must be JSON.`;
    }
};
