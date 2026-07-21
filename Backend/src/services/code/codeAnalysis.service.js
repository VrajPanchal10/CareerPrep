/**
 * codeAnalysis.service.js
 * Gemini AI coaching layer for code evaluation.
 *
 * STRICT SECURITY CONTRACT:
 *   - Gemini NEVER decides pass/fail — it only receives the execution engine's verdict.
 *   - Gemini NEVER receives hidden test case inputs or expected outputs.
 *   - The prompt explicitly instructs Gemini not to override execution results.
 *   - Code is placed in a delimited block to prevent prompt injection.
 *
 * Uses the project-standard geminiProvider (same as all other AI services).
 * Gemini's role: explain, teach, coach, optimize — NOT evaluate correctness.
 */

const geminiProvider = require("../providers/gemini.provider");
const aiConfig = require("../../config/aiProviders.config");
const { logger } = require("../../utils/securityLogger");

/**
 * Build the coaching prompt for Gemini.
 * Hidden test case details are intentionally excluded.
 *
 * @param {object} opts
 * @param {object}   opts.question          - { title, description, difficulty, topic, constraints }
 * @param {string}   opts.language          - Language name (e.g. "javascript")
 * @param {string}   opts.sourceCode        - User's code
 * @param {string}   opts.overallVerdict    - Piston verdict (e.g. "ACCEPTED", "WRONG_ANSWER")
 * @param {object[]} opts.visibleResults    - Array of visible test case results
 * @param {object}   opts.hiddenSummary     - { passed, total } (no inputs/outputs)
 * @returns {string}
 */
function buildCoachingPrompt({ question, language, sourceCode, overallVerdict, visibleResults, hiddenSummary }) {
    const testSummary = (visibleResults || []).map((r, i) =>
        `  Test ${i + 1} [${r.passed ? "PASS" : "FAIL"}] — ` +
        `Verdict: ${r.verdict}, Time: ${r.timeMs ?? "N/A"}ms, Memory: ${r.memoryKb ?? "N/A"}KB` +
        (r.passed ? "" : `\n    Input: ${r.input}\n    Expected: ${r.expectedOutput}\n    Got: ${r.actualOutput || "(no output)"}`) +
        (r.stderr ? `\n    StdErr: ${r.stderr.slice(0, 300)}` : "") +
        (r.compileOutput ? `\n    CompileOutput: ${r.compileOutput.slice(0, 300)}` : "")
    ).join("\n");

    return `You are an expert coding mentor reviewing a student's solution. Your role is EXCLUSIVELY to teach, explain, and coach—not to judge correctness (that has already been done by the execution engine).

== PROBLEM ==
Title: ${question.title}
Difficulty: ${question.difficulty}
Topic: ${question.topic}
Description: ${(question.description || "").slice(0, 800)}
Constraints: ${(question.constraints || []).join("; ")}

== SUBMISSION DETAILS ==
Language: ${language}
Overall Execution Verdict (from Execution Engine, authoritative): ${overallVerdict}
Visible Tests: ${(visibleResults || []).filter(r => r.passed).length}/${(visibleResults || []).length} passed
Hidden Tests: ${hiddenSummary?.passed ?? "N/A"}/${hiddenSummary?.total ?? "N/A"} passed (inputs not available to you)

== EXECUTION RESULTS (visible test cases only) ==
${testSummary || "No visible test case data."}

== SUBMITTED CODE ==
\`\`\`${language}
${(sourceCode || "").slice(0, 3000)}
\`\`\`

== YOUR TASK ==
Respond ONLY with a valid JSON object matching this exact structure (no markdown fences, no extra text):
{
  "explanation": "2-4 sentence explanation of why the code succeeded or failed, referencing the execution verdict",
  "timeComplexity": "Big-O time complexity (e.g. O(n), O(n log n), O(n^2))",
  "spaceComplexity": "Big-O space complexity (e.g. O(1), O(n))",
  "optimizations": ["optimization suggestion 1", "optimization suggestion 2", "optimization suggestion 3"],
  "codeQuality": "2-3 sentences on naming conventions, readability, and code structure",
  "edgeCases": ["edge case 1 the code may miss", "edge case 2"],
  "progressiveHints": ["hint 1 (vague, directional)", "hint 2 (more specific)", "hint 3 (most specific, near-answer)"],
  "interviewQuestions": ["follow-up interview question 1", "follow-up interview question 2"],
  "conceptToStudy": "Name of the key algorithm, data structure, or concept to review based on this problem"
}

CRITICAL RULES:
- Do NOT state whether the code is correct or incorrect — the execution engine already determined that.
- Do NOT reference hidden test case inputs or expected outputs.
- Do NOT add markdown fences or any text outside the JSON.
- If the verdict is COMPILATION_ERROR, skip complex analysis and focus solely on fixing the syntax/type error.
- If the verdict is RUNTIME_ERROR, provide step-by-step debugging guidance instead of standard optimization.
- If the verdict is WRONG_ANSWER, focus on logic analysis and identifying edge cases.
- If the verdict is ACCEPTED, focus heavily on code optimization and space/time complexity analysis.`;
}

/**
 * Generate a Gemini coaching report for a code submission.
 * Falls back gracefully if Gemini is unavailable.
 *
 * @param {object} opts
 * @param {object}   opts.question
 * @param {string}   opts.language
 * @param {string}   opts.sourceCode
 * @param {string}   opts.overallVerdict
 * @param {object[]} opts.visibleResults
 * @param {object}   opts.hiddenSummary
 * @returns {Promise<object>}  Coaching report object
 */
async function generateMentorReport(opts) {
    const prompt = buildCoachingPrompt(opts);

    const result = await geminiProvider.execute({ prompt }, {
        jsonMode: false,
        timeoutMs: aiConfig.providers.gemini.timeoutMs
    });

    if (!result.success || !result.output) {
        logger.error("[CodeAnalysis] Gemini mentor failed:", result.error || {});
        return buildFallbackReport(opts.overallVerdict);
    }

    try {
        // Strip any accidental markdown fences the model may add
        const cleaned = result.output
            .replace(/^```json\s*/i, "")
            .replace(/^```\s*/i, "")
            .replace(/\s*```$/i, "")
            .trim();

        const parsed = JSON.parse(cleaned);
        return sanitizeMentorReport(parsed);
    } catch (err) {
        logger.error("[CodeAnalysis] Failed to parse Gemini JSON:", err);
        return buildFallbackReport(opts.overallVerdict);
    }
}

/**
 * Sanitize and normalize a parsed Gemini response.
 * Ensures all fields are present and of the correct type.
 */
function sanitizeMentorReport(raw) {
    return {
        explanation:        String(raw.explanation || "No explanation available."),
        timeComplexity:     String(raw.timeComplexity || "Unknown"),
        spaceComplexity:    String(raw.spaceComplexity || "Unknown"),
        optimizations:      Array.isArray(raw.optimizations) ? raw.optimizations.slice(0, 5).map(String) : [],
        codeQuality:        String(raw.codeQuality || ""),
        edgeCases:          Array.isArray(raw.edgeCases) ? raw.edgeCases.slice(0, 5).map(String) : [],
        progressiveHints:   Array.isArray(raw.progressiveHints) ? raw.progressiveHints.slice(0, 3).map(String) : [],
        interviewQuestions: Array.isArray(raw.interviewQuestions) ? raw.interviewQuestions.slice(0, 3).map(String) : [],
        conceptToStudy:     String(raw.conceptToStudy || "")
    };
}

/**
 * Graceful fallback when Gemini is unavailable.
 */
function buildFallbackReport(verdict) {
    return {
        explanation:        `Your submission resulted in: ${verdict}. AI analysis is temporarily unavailable.`,
        timeComplexity:     "Unavailable",
        spaceComplexity:    "Unavailable",
        optimizations:      [],
        codeQuality:        "AI analysis temporarily unavailable.",
        edgeCases:          [],
        progressiveHints:   [],
        interviewQuestions: [],
        conceptToStudy:     ""
    };
}

module.exports = { generateMentorReport };
