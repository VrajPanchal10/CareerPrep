const { GoogleGenAI } = require("@google/genai")
const { z } = require("zod")
const puppeteer = require("puppeteer")

const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_GENAI_API_KEY
})

// Model configurations
const PRIMARY_MODEL = process.env.GEMINI_PRIMARY_MODEL || "gemini-2.5-flash"
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-2.5-flash-lite"
const REQUEST_TIMEOUT_MS = parseInt(process.env.GEMINI_REQUEST_TIMEOUT_MS || "30000", 10)

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
})

/**
 * Helper to wrap a promise in a timeout.
 */
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

/**
 * Helper to wait for a given duration.
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Call Gemini with retry logic, token count, timing, and fallback model.
 */
async function callGeminiWithRetryAndFallback({ contents, config, primaryModel = PRIMARY_MODEL, fallbackModel = FALLBACK_MODEL }) {
    const timestamp = new Date().toISOString();
    let promptSize = 0;
    let tokenCount = 0;

    // 1. Calculate prompt size and token count
    try {
        if (typeof contents === "string") {
            promptSize = contents.length;
        } else if (Array.isArray(contents)) {
            promptSize = contents.map(c => typeof c === "string" ? c : JSON.stringify(c)).join("").length;
        } else {
            promptSize = JSON.stringify(contents).length;
        }

        // Use countTokens API
        const tokenResponse = await ai.models.countTokens({
            model: primaryModel,
            contents: contents
        });
        tokenCount = tokenResponse.totalTokens;
    } catch (err) {
        console.error(`[AI Service] [${timestamp}] Failed to calculate tokens:`, err.message);
    }

    const backoffs = [2000, 5000, 10000]; // 2s, 5s, 10s backoff
    let currentModel = primaryModel;
    let attempt = 1;
    const maxAttempts = 4; // 1 initial attempt + 3 retries

    while (attempt <= maxAttempts) {
        const startTime = Date.now();
        const attemptTimestamp = new Date().toISOString();
        console.log(`[AI Service] [${attemptTimestamp}] Attempt ${attempt}/${maxAttempts} using model '${currentModel}' (Prompt size: ${promptSize} chars, ${tokenCount} tokens)`);

        try {
            // Call generateContent with timeout
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
            console.log(`[AI Service] [${new Date().toISOString()}] Success. Model: ${currentModel}, Time taken: ${duration}ms`);
            return response;
        } catch (error) {
            const duration = Date.now() - startTime;
            const status = error.status || error.code || (error.message && error.message.includes("timed out") ? "TIMEOUT" : "UNKNOWN");
            
            console.error(`[AI Service] [${new Date().toISOString()}] Attempt ${attempt} failed. Model: ${currentModel}, Status: ${status}, Duration: ${duration}ms. Error:`, error.message || error);

            // Determine if the error is retryable (429, 503, 500, UNAVAILABLE, INTERNAL, etc.)
            const isTimeout = status === "TIMEOUT" || error.message?.toLowerCase().includes("timeout");
            const isRetryableStatus = [429, 503, 500, "UNAVAILABLE", "RESOURCE_EXHAUSTED", "INTERNAL"].includes(status) || isTimeout;

            if (isRetryableStatus && attempt < maxAttempts) {
                const backoffMs = backoffs[attempt - 1] || 2000;
                console.warn(`[AI Service] Retryable error encountered. Waiting ${backoffMs / 1000}s before next attempt...`);
                await delay(backoffMs);
                attempt++;
            } else {
                // If we ran out of retries on primary model, try the fallback model (if configured and different)
                if (currentModel === primaryModel && fallbackModel && currentModel !== fallbackModel) {
                    console.warn(`[AI Service] Primary model '${primaryModel}' failed/unavailable. Switching to fallback model '${fallbackModel}'...`);
                    currentModel = fallbackModel;
                    attempt = 1; // Reset attempt count for fallback model
                    // Re-calculate token count for fallback model
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
                    // Out of options, throw custom structured error
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

async function generateInterviewReport({ resume, selfDescription, jobDescription }) {
    const prompt = `Generate an interview report for a candidate with the following details:
                        Resume: ${resume}
                        Self Description: ${selfDescription}
                        Job Description: ${jobDescription}
`

    const response = await callGeminiWithRetryAndFallback({
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: interviewReportSchema.toJSONSchema(),
        }
    })

    try {
        return JSON.parse(response.text)
    } catch (err) {
        throw new Error("Failed to parse Gemini response as valid JSON schema")
    }
}

async function generatePdfFromHtml(htmlContent) {
    const browser = await puppeteer.launch({
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
    })
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" })

    const pdfBuffer = await page.pdf({
        format: "A4", margin: {
            top: "20mm",
            bottom: "20mm",
            left: "15mm",
            right: "15mm"
        }
    })

    await browser.close()

    return pdfBuffer
}

async function generateResumePdf({ resume, selfDescription, jobDescription }) {
    const resumePdfSchema = z.object({
        html: z.string().describe("The HTML content of the resume which can be converted to PDF using any library like puppeteer")
    })

    const prompt = `Generate resume for a candidate with the following details:
                        Resume: ${resume}
                        Self Description: ${selfDescription}
                        Job Description: ${jobDescription}

                        the response should be a JSON object with a single field "html" which contains the HTML content of the resume which can be converted to PDF using any library like puppeteer.
                        The resume should be tailored for the given job description and should highlight the candidate's strengths and relevant experience. The HTML content should be well-formatted and structured, making it easy to read and visually appealing.
                        The content of resume should be not sound like it's generated by AI and should be as close as possible to a real human-written resume.
                        you can highlight the content using some colors or different font styles but the overall design should be simple and professional.
                        The content should be ATS friendly, i.e. it should be easily parsable by ATS systems without losing important information.
                        The resume should not be so lengthy, it should ideally be 1-2 pages long when converted to PDF. Focus on quality rather than quantity and make sure to include all the relevant information that can increase the candidate's chances of getting an interview call for the given job description.
                    `

    const response = await callGeminiWithRetryAndFallback({
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: resumePdfSchema.toJSONSchema(),
        }
    })

    let jsonContent;
    try {
        jsonContent = JSON.parse(response.text)
    } catch (err) {
        throw new Error("Failed to parse Gemini response as valid JSON resume HTML schema")
    }

    const pdfBuffer = await generatePdfFromHtml(jsonContent.html)

    return pdfBuffer
}

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
})

async function generateAtsReport({ resume, jobDescription }) {
    const prompt = `Perform a complete ATS keyword and match analysis comparing the candidate's resume with the job description.
                        Resume: ${resume}
                        Job Description: ${jobDescription}
                        
                        Evaluate keyword occurrences, construct an overall ATS match score, compute matching breakdown scores, identify matched, missing, and extra keywords, formulate a detailed heatmap array, create side-by-side comparison tables, and list strategic recommendations to optimize the resume.
                        Make the response highly professional, constructive, and realistic.
`

    const response = await callGeminiWithRetryAndFallback({
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: atsReportSchema.toJSONSchema(),
        }
    })

    try {
        return JSON.parse(response.text)
    } catch (err) {
        throw new Error("Failed to parse Gemini response as valid JSON ATS Report schema")
    }
}

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
})

async function evaluateUserAnswer({ question, intention, modelAnswer, userAnswer }) {
    const prompt = `You are a technical interviewer evaluating a candidate's response to an interview question.
                        Question: ${question}
                        Interviewer's Intention: ${intention}
                        Reference Model Answer: ${modelAnswer}
                        Candidate's Answer: ${userAnswer}

                        Provide a detailed, critical and fair evaluation matching the required schema. Focus on assessing explanation quality and technical accuracy instead of confidence. Keep the feedback practical and constructive.
`

    const response = await callGeminiWithRetryAndFallback({
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: answerEvaluationSchema.toJSONSchema(),
        }
    })

    try {
        return JSON.parse(response.text)
    } catch (err) {
        throw new Error("Failed to parse Gemini response as valid JSON Answer Evaluation schema")
    }
}

const codingQuestionSchema = z.object({
    title: z.string().describe("A concise and clear title for the coding question (e.g. 'Two Sum', 'Reverse Linked List')"),
    description: z.string().describe("Detailed markdown description of the coding challenge, including problem statement and explanation"),
    difficulty: z.enum(["Easy", "Medium", "Hard"]).describe("The difficulty level of the coding question"),
    topic: z.string().describe("The main category or topic of the question (e.g. 'Arrays', 'Dynamic Programming')"),
    sampleInput: z.string().describe("Sample inputs for the code test cases (e.g., 'nums = [2,7,11,15], target = 9')"),
    sampleOutput: z.string().describe("Expected output matching the sample inputs (e.g., '[0,1]')"),
    constraints: z.array(z.string()).describe("A list of constraints on the inputs (e.g., '1 <= nums.length <= 10^4')"),
    hints: z.array(z.string()).describe("A list of progressive hints to guide the user towards the solution")
})

const codeEvaluationSchema = z.object({
    overallScore: z.number().min(0).max(100).describe("Weighted aggregate score between 0 and 100 based on correctness, readability, complexities, logic, structure, and edge cases"),
    correctnessScore: z.number().min(0).max(100).describe("Score out of 100 for theoretical correctness and logic alignment"),
    readabilityScore: z.number().min(0).max(100).describe("Score out of 100 for code structure, variable naming, formatting, and cleanliness"),
    complexityScore: z.number().min(0).max(100).describe("Score out of 100 for optimal time and space complexity efficiency"),
    strengths: z.array(z.string()).describe("List of 2-3 key strengths or positive attributes of the submitted code"),
    weaknesses: z.array(z.string()).describe("List of 2-3 gaps, inefficiencies, or errors identified in the code"),
    suggestions: z.array(z.string()).describe("Actionable tips or alternatives to improve the code's correctness, structure, or complexity")
})

async function generateAiCodingQuestion({ topic, difficulty }) {
    const prompt = `You are an expert technical interviewer. Generate a programming question targeting:
                        Topic: ${topic}
                        Difficulty: ${difficulty}
                        
                        Create a complete coding question object according to the schema. 
                        Make sure the constraints, description, sample inputs/outputs, and hints are clear, accurate, and structured.
                        Ensure the problem is standard and challenging for the given level.
                    `

    const response = await callGeminiWithRetryAndFallback({
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: codingQuestionSchema.toJSONSchema(),
        }
    })

    try {
        return JSON.parse(response.text)
    } catch (err) {
        throw new Error("Failed to parse Gemini response as valid JSON Coding Question schema")
    }
}

async function evaluateCodeSubmission({ question, language, code }) {
    const prompt = `You are a strict, senior technical interviewer and compiler-level code reviewer. 
                        Evaluate the following programming submission.
                        
                        Question:
                        Title: ${question.title}
                        Description: ${question.description}
                        Sample Input: ${question.sampleInput}
                        Sample Output: ${question.sampleOutput}
                        Constraints: ${question.constraints ? question.constraints.join(', ') : 'None'}
                        
                        Submission Details:
                        Language: ${language}
                        Submitted Code:
                        \`\`\`${language}
                        ${code}
                        \`\`\`
                        
                        Perform a deep semantic evaluation of the code:
                        1. Correctness: Does it solve the problem logically? Detect syntax errors, infinite loops, or logical flaws.
                        2. Logic Quality: Is it structured properly with correct variables, conditionals, and functions?
                        3. Readability: Is it clean, well-formatted, and easy to read?
                        4. Time & Space Complexity: Analyze big-O complexities and if they can be optimized.
                        5. Edge Case Handling: Does it handle nulls, empty inputs, single element lists, out of bounds, etc.?
                        
                        Provide constructive feedback matching the required schema. Ensure the score values reflect the code quality (e.g. penalize heavily for infinite loops, syntax errors, incorrect complexity, or missing edge cases).
                    `

    const response = await callGeminiWithRetryAndFallback({
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: codeEvaluationSchema.toJSONSchema(),
        }
    })

    try {
        return JSON.parse(response.text)
    } catch (err) {
        throw new Error("Failed to parse Gemini response as valid JSON Code Evaluation schema")
    }
}

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

async function evaluateVoiceAnswer({ question, intention, modelAnswer, userAnswer, topic }) {
    const prompt = `You are a professional mock interviewer evaluating a candidate's verbal response to an interview question.
                        Question: ${question}
                        Interviewer's Intention: ${intention}
                        Reference Model Answer: ${modelAnswer}
                        Topic Category: ${topic}
                        
                        Candidate's Verbal Answer Transcript:
                        "${userAnswer}"
                        
                        Provide a detailed, critical and fair evaluation based on the verbal response transcript matching the schema.
                        Assign scores based on content and structure:
                        - communicationScore: evaluates flow, narrative structure (e.g. STAR method), and explanation logic.
                        - clarityScore: evaluates sentence coherence, grammatical structure, and vocabulary.
                        - technicalScore: evaluates use of domain terminology, concept accuracy, and reference matching.
                        - explanationScore: evaluates depth, examples, and detailed points covered.
                        - overallScore: weighted aggregate.
                        Ensure comments and suggestions are practical, constructive, and tailored for verbal interview scenarios.
                    `;

    const response = await callGeminiWithRetryAndFallback({
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: voiceAnswerEvaluationSchema.toJSONSchema(),
        }
    });

    try {
        return JSON.parse(response.text);
    } catch (err) {
        throw new Error("Failed to parse Gemini response as valid JSON Voice Evaluation schema");
    }
}

async function generateAiFollowUpQuestion({ question, userAnswer }) {
    const prompt = `You are a professional mock interviewer conducting a voice interview. 
                        The candidate was asked a question:
                        Question: "${question.questionText || question.question}"
                        Reference Answer: "${question.answer}"
                        
                        The candidate's response transcript:
                        "${userAnswer}"
                        
                        Decide if it is appropriate to ask a brief, contextual follow-up question to probe deeper, clarify a point, or challenge their reasoning.
                        If yes, set hasFollowUp to true and provide the questionText (the follow-up question), intention, and guide answer.
                        If no (e.g., if their answer is fully complete, or too poor to build on, or if no value is added), set hasFollowUp to false.
                        Keep the follow-up question brief, clear, and natural.
                    `;

    const response = await callGeminiWithRetryAndFallback({
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: voiceFollowUpQuestionSchema.toJSONSchema(),
        }
    });

    try {
        return JSON.parse(response.text);
    } catch (err) {
        throw new Error("Failed to parse Gemini response as valid voice follow-up question schema");
    }
}

async function generateVoiceSessionSummaryRecommendation({ evaluations }) {
    const prompt = `You are an expert career coach reviewing a candidate's mock interview performance.
                        Here is the structured feedback of the user's answers in this practice session:
                        ${JSON.stringify(evaluations, null, 2)}
                        
                        Based on their strengths, weaknesses, and suggestions, write a single, highly actionable, premium strategic recommendation (max 3 sentences) to help the candidate's future verbal interview preparations.
                        Avoid generic tips; be specific, constructive, and impactful.
                    `;

    const response = await callGeminiWithRetryAndFallback({
        contents: prompt,
        config: {
            // Simply call default text generation for a paragraph recommendation
        }
    });

    return response.text ? response.text.trim() : "Focus on structuring your responses using the STAR method (Situation, Task, Action, Result) and clearly state your technical choices with domain-specific terms.";
}

module.exports = {
    generateInterviewReport,
    generateResumePdf,
    generateAtsReport,
    evaluateUserAnswer,
    generateAiCodingQuestion,
    evaluateCodeSubmission,
    evaluateVoiceAnswer,
    generateAiFollowUpQuestion,
    generateVoiceSessionSummaryRecommendation
}