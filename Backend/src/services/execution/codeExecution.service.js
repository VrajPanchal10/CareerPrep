const codingQuestionModel = require("../../models/codingQuestion.model");
const codingSubmissionModel = require("../../models/codingSubmission.model");
const languageMap = require("./languageMap");
const judge0Provider = require("./judge0.provider");
const { generateMentorReport } = require("../code/codeAnalysis.service"); // keeping it here or can be moved later
const { getCached, setCached } = require("../code/executionCache.service"); // assuming we keep it in code/
const { logger } = require("../../utils/securityLogger");
const pLimit = require("p-limit");

const MAX_CODE_BYTES = parseInt(process.env.MAX_SOURCE_SIZE || "100000", 10);
const DEFAULT_TIME_LIMIT_S = parseInt(process.env.MAX_EXECUTION_TIME || "5", 10);
const DEFAULT_MEMORY_LIMIT_KB = parseInt(process.env.MAX_MEMORY_LIMIT || "262144", 10);

/**
 * Compute a 0–100 execution score based on test case pass rate.
 */
function computeExecutionScore(visibleSummary, hiddenSummary) {
    const visTotal = visibleSummary.total || 0;
    const hidTotal = hiddenSummary?.total || 0;
    if (visTotal + hidTotal === 0) return 0;
    const visPct = visTotal > 0 ? (visibleSummary.passed / visTotal) : 1;
    const hidPct = hidTotal > 0 ? ((hiddenSummary?.passed || 0) / hidTotal) : 1;
    if (hidTotal === 0) return Math.round(visPct * 100);
    if (visTotal === 0) return Math.round(hidPct * 100);
    return Math.round((visPct * 0.4 + hidPct * 0.6) * 100);
}

/**
 * Derive legacy-compatible scores.
 */
function deriveLegacyScores(executionScore, mentorReport, overallVerdict) {
    const correctness = executionScore;
    const complexity = mentorReport.timeComplexity && !mentorReport.timeComplexity.toLowerCase().includes("unavail")
        ? Math.min(100, Math.max(0, 100 - (mentorReport.optimizations?.length || 0) * 10))
        : 50;
    const readability = mentorReport.codeQuality
        ? (mentorReport.edgeCases?.length > 2 ? 55 : 75)
        : 60;
    const overall = Math.round((correctness * 0.6) + (complexity * 0.2) + (readability * 0.2));
    return { overallScore: overall, correctnessScore: correctness, complexityScore: complexity, readabilityScore: readability };
}

/**
 * Run an array of test cases concurrently.
 */
async function _runTestCases({ sourceCode, language, testCases, timeLimitS, memoryLimitKb, signal }) {
    if (!testCases || testCases.length === 0) return [];
    
    // Concurrency limit for test cases inside a submission
    const limit = pLimit(5); 

    const tasks = testCases.map(tc => limit(async () => {
        const res = await judge0Provider.executeCode({
            sourceCode,
            language,
            stdin: tc.input || "",
            timeLimitS: timeLimitS || DEFAULT_TIME_LIMIT_S,
            memoryLimitKb: memoryLimitKb || DEFAULT_MEMORY_LIMIT_KB,
            signal
        });
        
        // Compare output for verdict if compilation succeeded and it's not a runtime error
        if (res.verdict === "ACCEPTED" && tc.expectedOutput) {
            const actual = res.stdout.trim();
            const expected = tc.expectedOutput.trim();
            if (actual !== expected) {
                res.verdict = "WRONG_ANSWER";
                res.statusLabel = "WRONG_ANSWER";
            }
        }
        return res;
    }));
    return Promise.all(tasks);
}

/**
 * Run visible tests.
 */
async function runVisibleTests({ sourceCode, language, testCases, timeLimitS, memoryLimitKb, signal }) {
    const rawResults = await _runTestCases({ sourceCode, language, testCases, timeLimitS, memoryLimitKb, signal });
    
    let passed = 0, failed = 0, compilationError = false, compilationOutput = null;

    const results = rawResults.map((raw, idx) => {
        const tc = testCases[idx];
        const isPass = raw.verdict === "ACCEPTED";
        if (raw.verdict === "COMPILATION_ERROR") {
            compilationError = true;
            compilationOutput = raw.compileOutput || raw.stderr || "Compilation failed.";
        }
        isPass ? passed++ : failed++;
        return {
            index: idx + 1,
            label: tc.label || `Test Case ${idx + 1}`,
            input: tc.input || "",
            expectedOutput: tc.expectedOutput || "",
            actualOutput: raw.stdout || "",
            verdict: raw.verdict,
            statusLabel: raw.statusLabel,
            passed: isPass,
            timeMs: raw.timeMs,
            memoryKb: raw.memoryKb,
            stderr: raw.verdict === "RUNTIME_ERROR" ? raw.stderr : null,
            compileOutput: raw.compileOutput || null,
            retryCount: raw.retryCount || 0,
            runtime: raw.runtime || null
        };
    });

    return { passed, failed, total: rawResults.length, compilationError, compilationOutput, results };
}

/**
 * Run hidden tests.
 */
async function runHiddenTests({ sourceCode, language, testCases, timeLimitS, memoryLimitKb, signal }) {
    if (!testCases || testCases.length === 0) return { passed: 0, failed: 0, total: 0, overallVerdict: "NO_HIDDEN_TESTS" };

    const rawResults = await _runTestCases({ sourceCode, language, testCases, timeLimitS, memoryLimitKb, signal });
    
    let passed = 0, failed = 0;
    let hasRuntimeError = false, hasTle = false, hasMle = false;

    for (const raw of rawResults) {
        if (raw.verdict === "ACCEPTED") passed++;
        else {
            failed++;
            if (raw.verdict === "TLE") hasTle = true;
            if (raw.verdict === "MLE") hasMle = true;
            if (raw.verdict === "RUNTIME_ERROR") hasRuntimeError = true;
        }
    }

    let overallVerdict;
    if (failed === 0) overallVerdict = "ACCEPTED";
    else if (hasTle) overallVerdict = "TLE";
    else if (hasMle) overallVerdict = "MLE";
    else if (hasRuntimeError) overallVerdict = "RUNTIME_ERROR";
    else overallVerdict = "WRONG_ANSWER";

    return { passed, failed, total: rawResults.length, overallVerdict };
}

function computeOverallVerdict(visibleSummary, hiddenSummary) {
    if (visibleSummary.compilationError) return "COMPILATION_ERROR";
    const totalPassed = visibleSummary.passed + (hiddenSummary?.passed || 0);
    const totalAll = visibleSummary.total + (hiddenSummary?.total || 0);
    if (totalAll === 0) return "NO_TESTS";
    if (totalPassed === totalAll) return "ACCEPTED";
    if (hiddenSummary?.overallVerdict === "TLE") return "TLE";
    if (hiddenSummary?.overallVerdict === "MLE") return "MLE";
    if (hiddenSummary?.overallVerdict === "RUNTIME_ERROR") return "RUNTIME_ERROR";
    for (const r of (visibleSummary.results || [])) {
        if (r.verdict === "TLE") return "TLE";
        if (r.verdict === "MLE") return "MLE";
        if (r.verdict === "RUNTIME_ERROR") return "RUNTIME_ERROR";
    }
    return "WRONG_ANSWER";
}

/**
 * Execute code with a custom stdin.
 */
async function runCustomInput({ sourceCode, language, stdin, timeLimitS, memoryLimitKb, signal }) {
    return judge0Provider.executeCode({
        sourceCode,
        language,
        stdin: stdin || "",
        timeLimitS: timeLimitS || DEFAULT_TIME_LIMIT_S,
        memoryLimitKb: memoryLimitKb || DEFAULT_MEMORY_LIMIT_KB,
        signal
    });
}

/**
 * Full evaluation pipeline.
 */
async function evaluateSubmission({ questionId, language, sourceCode, userId, signal }) {
    if (!(await languageMap.isSupported(language))) {
        const err = new Error(`Language "${language}" is not supported.`);
        err.status = 400; err.code = "UNSUPPORTED_LANGUAGE";
        throw err;
    }

    if (Buffer.byteLength(sourceCode, "utf8") > MAX_CODE_BYTES) {
        const err = new Error("Code payload exceeds maximum size limit.");
        err.status = 400; err.code = "CODE_TOO_LARGE";
        throw err;
    }

    const question = await codingQuestionModel.findById(questionId);
    if (!question) {
        const err = new Error("Question not found.");
        err.status = 404; throw err;
    }

    const visibleTestCases = (question.testCases || []).filter(tc => !tc.isHidden);
    const hiddenTestCases = (question.testCases || []).filter(tc => tc.isHidden);
    const testInputs = (question.testCases || []).map(tc => tc.input || "");

    const cached = getCached(language, sourceCode, testInputs);
    if (cached) {
        logger.debug(`[Execution] Cache HIT for user=${userId}, question=${questionId}`);
        const submission = await codingSubmissionModel.create({
            userId, questionId: question._id, language: language.toLowerCase(),
            submittedCode: sourceCode, fromCache: true, ...cached.dbFields
        });
        return buildResponse(submission, cached.responseExtras, true);
    }

    const timeLimitS = question.timeLimitMs ? question.timeLimitMs / 1000 : DEFAULT_TIME_LIMIT_S;
    const memoryLimitKb = question.memoryLimitKb || DEFAULT_MEMORY_LIMIT_KB;

    let visibleSummary;
    try {
        visibleSummary = await runVisibleTests({ sourceCode, language, testCases: visibleTestCases, timeLimitS, memoryLimitKb, signal });
    } catch (err) {
        if (err.name === "Judge0Error" && (err.status >= 500 || err.status === 429 || err.status === 408)) {
            const serviceErr = new Error("The code execution engine is temporarily unavailable.");
            serviceErr.status = 503; serviceErr.code = "EXECUTION_ENGINE_UNAVAILABLE";
            throw serviceErr;
        }
        throw err;
    }

    let hiddenSummary = { passed: 0, failed: 0, total: hiddenTestCases.length, overallVerdict: "SKIPPED" };
    let mentorReport = null, overallVerdict;

    if (visibleSummary.compilationError) {
        overallVerdict = "COMPILATION_ERROR";
        mentorReport = {
            explanation: `Compilation failed: ${visibleSummary.compilationOutput?.slice(0, 500) || "Check syntax errors."}`,
            timeComplexity: "N/A", spaceComplexity: "N/A", optimizations: ["Fix compilation errors before optimizing."],
            codeQuality: "Code could not be compiled.", edgeCases: [],
            progressiveHints: ["Review the compilation error message carefully.", "Check for syntax errors, missing semicolons, or incorrect types."],
            interviewQuestions: [], conceptToStudy: "Compilation and language syntax"
        };
    } else {
        if (hiddenTestCases.length > 0) {
            try {
                hiddenSummary = await runHiddenTests({ sourceCode, language, testCases: hiddenTestCases, timeLimitS, memoryLimitKb, signal });
            } catch (err) {
                logger.error("[Execution] Hidden test run failed:", err);
                hiddenSummary = { passed: 0, failed: 0, total: hiddenTestCases.length, overallVerdict: "SKIPPED" };
            }
        }
        overallVerdict = computeOverallVerdict(visibleSummary, hiddenSummary);

        try {
            mentorReport = await generateMentorReport({
                question: { title: question.title, description: question.description, difficulty: question.difficulty, topic: question.topic, constraints: question.constraints },
                language, sourceCode, overallVerdict,
                visibleResults: visibleSummary.results || [],
                hiddenSummary: { passed: hiddenSummary.passed, total: hiddenSummary.total }
            });
        } catch (err) {
            logger.error("[Execution] Gemini mentor failed:", err);
            mentorReport = {
                explanation: `Execution verdict: ${overallVerdict}. AI coaching temporarily unavailable.`,
                timeComplexity: "Unavailable", spaceComplexity: "Unavailable", optimizations: [], codeQuality: "AI review temporarily unavailable.",
                edgeCases: [], progressiveHints: [], interviewQuestions: [], conceptToStudy: ""
            };
        }
    }

    const executionScore = computeExecutionScore(visibleSummary, hiddenSummary);
    const legacyScores = deriveLegacyScores(executionScore, mentorReport, overallVerdict);

    const avgRuntimeMs = (() => {
        const times = (visibleSummary.results || []).map(r => r.timeMs).filter(Boolean);
        return times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
    })();
    const avgMemoryKb = (() => {
        const mems = (visibleSummary.results || []).map(r => r.memoryKb).filter(Boolean);
        return mems.length > 0 ? Math.round(mems.reduce((a, b) => a + b, 0) / mems.length) : 0;
    })();

    const dbData = {
        userId, questionId: question._id, language: language.toLowerCase(),
        submittedCode: sourceCode, fromCache: false,
        executionScore, executionVerdict: overallVerdict,
        visibleTestsPassed: visibleSummary.passed, visibleTestsTotal: visibleSummary.total,
        hiddenTestsPassed: hiddenSummary.passed, hiddenTestsTotal: hiddenSummary.total,
        compilationStatus: visibleSummary.compilationError ? "error" : "success",
        compilationError: visibleSummary.compilationOutput || null,
        avgRuntimeMs, avgMemoryKb,
        aiExplanation: mentorReport.explanation,
        timeComplexity: mentorReport.timeComplexity, spaceComplexity: mentorReport.spaceComplexity,
        optimizations: mentorReport.optimizations, edgeCases: mentorReport.edgeCases,
        interviewQuestions: mentorReport.interviewQuestions, conceptToStudy: mentorReport.conceptToStudy,
        ...legacyScores,
        strengths: (overallVerdict === "ACCEPTED" ? ["All test cases passed."] : []),
        weaknesses: (overallVerdict !== "ACCEPTED" ? [`Execution verdict: ${overallVerdict}`] : []),
        suggestions: mentorReport.optimizations,
        
        providerName: "Judge0",
        providerResponseTime: visibleSummary.results[0]?.timeMs || 0, // Rough estimate
        runtimeVersion: visibleSummary.results[0]?.runtime || null,
        retryCount: Math.max(0, ...(visibleSummary.results || []).map(r => r.retryCount || 0)),
        executionMetadata: {
            hiddenTestsRun: hiddenTestCases.length > 0
        }
    };

    const submission = await codingSubmissionModel.create(dbData);

    const responseExtras = {
        mentorReport,
        visibleTestResults: visibleSummary.results || [],
        hiddenTestSummary: { passed: hiddenSummary.passed, failed: hiddenSummary.failed, total: hiddenSummary.total }
    };
    setCached(language, sourceCode, testInputs, { dbFields: dbData, responseExtras });

    return buildResponse(submission, responseExtras, false);
}

function buildResponse(submission, extras, fromCache) {
    return {
        submission, cached: fromCache,
        executionResult: {
            verdict: submission.executionVerdict, executionScore: submission.executionScore,
            compilationStatus: submission.compilationStatus, compilationError: submission.compilationError,
            avgRuntimeMs: submission.avgRuntimeMs, avgMemoryKb: submission.avgMemoryKb,
            visibleTestsPassed: submission.visibleTestsPassed, visibleTestsTotal: submission.visibleTestsTotal,
            hiddenTestsPassed: submission.hiddenTestsPassed, hiddenTestsTotal: submission.hiddenTestsTotal,
            visibleTestResults: extras.visibleTestResults || [], hiddenTestSummary: extras.hiddenTestSummary || {}
        },
        aiMentor: extras.mentorReport || null
    };
}

module.exports = { evaluateSubmission, runCustomInput };
