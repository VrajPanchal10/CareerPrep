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
    const browser = await puppeteer.launch()
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

module.exports = { generateInterviewReport, generateResumePdf, generateAtsReport, evaluateUserAnswer }