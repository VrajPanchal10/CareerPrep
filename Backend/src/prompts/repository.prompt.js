/**
 * GitHub Repository Analysis & Project Defense Prompt Templates
 */
module.exports = {
    generateRepoAnalysisPrompt: ({ repoUrl, repoName, owner, filesContext, folderStructure }) => {
        return `You are a Principal Software Architect and Lead Technical Auditor.
Analyze the provided GitHub repository source files, package manifests, and folder structure for "${repoName}" by ${owner}.

Repository Metadata:
- URL: ${repoUrl}
- Name: ${repoName}
- Owner: ${owner}

Directory Layout:
${folderStructure}

Source Code & Manifest Context:
${filesContext}

Instructions:
Generate a comprehensive, highly specific repository analysis as JSON matching the schema. You MUST populate every field in detail based directly on the actual code, packages, frameworks, patterns, and files in this repository:

1. "summary": A rich 3-4 sentence technical overview of what ${repoName} does, its primary architecture pattern, core capabilities, and infrastructure.

2. "projectSnapshot":
   - "projectSummary": Concise 2-sentence summary.
   - "techStack": Array of specific tools, libraries, and frameworks detected (e.g. React, Node.js, Express, MongoDB, Tailwind, Vite, Axios, JWT).
   - "architectureOverview": Detailed explanation of the architectural pattern (e.g., MVC, Service Layer, Monorepo, Microservices) and file organization.
   - "mainFeatures": Array of 4-6 key features implemented in this repository.
   - "securityOverview": Detailed description of security mechanisms (e.g. JWT tokens, bcrypt, Helmet, CSRF, input validation, CORS).
   - "deploymentOverview": Explanation of hosting/deployment strategies, environment variables, build setup, or Docker configuration.
   - "improvementOpportunities": Array of 3-4 actionable refactoring opportunities.

3. "healthReport":
   - "architectureStrengths": Array of 3-5 clear architectural strengths.
   - "architectureWeaknesses": Array of 3-5 code/structure weaknesses or tech debt.
   - "securityConcerns": Array of 2-4 potential security gaps or risk areas.
   - "scalabilityConcerns": Array of 2-4 performance or scalability bottlenecks.
   - "missingEngineeringPractices": Array of 2-4 missing practices (e.g. CI/CD pipelines, unit testing, structured logging).
   - "improvementRecommendations": Array of 3-5 concrete recommendations for improvement.

4. "knowledgeGraph":
   - "projectName": "${repoName}"
   - "frontendStack": Array of frontend tools/frameworks detected.
   - "backendStack": Array of backend frameworks/libraries detected.
   - "database": Array of database systems, ORMs, and ODMs used.
   - "authentication": Array of auth protocols and packages used.
   - "majorFeatures": Array of key application capabilities.
   - "folderStructure": Concise folder hierarchy summary.
   - "keyComponents": Array of major UI/architectural components.
   - "services": Array of service modules and helper modules.
   - "routes": Array of API endpoints or page routes detected.
   - "models": Array of database schemas/models detected.
   - "externalApis": Array of third-party APIs integrated.
   - "deploymentApproach": Array of deployment platforms/tools.

5. "interviewTopics":
   - "architecture": Array of 3 technical questions specifically challenging architectural choices in ${repoName}.
   - "frontend": Array of 3 technical questions on frontend design, state, or performance in ${repoName}.
   - "backend": Array of 3 technical questions on backend middleware, routes, or error handling in ${repoName}.
   - "database": Array of 3 technical questions on data models, query optimization, or indexing in ${repoName}.
   - "deploymentAndSecurity": Array of 3 technical questions on deployment, environment secrets, and security posture in ${repoName}.
   - "githubDefense": Array of 3 technical defense questions on technical trade-offs, refactoring priorities, and scalability.

DO NOT return empty arrays or generic placeholders. Base all items on the provided source code and repository structure. Return ONLY valid JSON.`;
    },

    generateRepoQuestionsPrompt: ({ knowledgeGraph, limit, userContext }) => {
        return `You are a Senior Staff Software Engineer interviewing a candidate for a role. You are conducting a "Project Defense" interview where you grill the candidate on their GitHub repository.

Project Knowledge Graph:
${JSON.stringify(knowledgeGraph, null, 2)}

${userContext || ""}

Constraints & Anti-Hallucination:
- Generate EXACTLY ${limit} highly challenging technical questions.
- If the Historical Context identifies any weaknesses (e.g., Docker, SQL), you MUST generate questions specifically probing those weak areas within the context of their codebase.
- Do NOT generate generic questions (e.g. "What is React?"). Questions must reference specific architectural decisions or stack choices in the Knowledge Graph.
- Frame the intention and guide answer like a strict grading rubric.

Provide the response in the exact JSON format requested.`;
    },

    evaluateRepoAnswerPrompt: ({ question, referenceAnswer, userAnswer, userContext }) => {
        return `You are a Senior Staff Software Engineer grading a candidate's answer during a Project Defense interview.

Question Asked: "${question}"
Reference Guide Answer: "${referenceAnswer}"
Candidate's Answer: "${userAnswer}"

${userContext || ""}

Scoring Methodology & Rubric:
- 0-20: No relevant content or completely empty answer.
- 21-40: Mentions topic but major gaps.
- 41-60: Partially correct with missing depth.
- 61-80: Good coverage with minor gaps.
- 81-100: Comprehensive, detailed, technically accurate.
- overall score MUST be calculated as: 0.30*accuracy + 0.25*depth + 0.25*explanationQuality + 0.20*clarity.
- If the candidate evades the question or gives an irrelevant response, score below 30. No flattery.

Feedback Rules:
- Strengths and Weaknesses must explicitly quote or address the candidate's exact words.
- If the candidate failed to explain a concept that was also listed as a weakness in the Historical Context, be extremely strict in the feedback.

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
