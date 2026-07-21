import api from "../../../utils/apiClient";

/**
 * Fetch all available coding questions, optionally filtered by topic and/or difficulty.
 */
export const fetchQuestions = async (filters = {}) => {
    const { topic, difficulty } = filters;
    const params = {};
    if (topic)      params.topic      = topic;
    if (difficulty) params.difficulty = difficulty;
    const response = await api.get("/api/coding/questions", { params });
    return response.data;
};

/**
 * Fetch detailed info for a single coding question by ID.
 * Hidden test case inputs/outputs are stripped server-side.
 */
export const fetchQuestionById = async (id) => {
    const response = await api.get(`/api/coding/questions/${id}`);
    return response.data;
};

/**
 * Fetch visible test cases for a question (safe to display in the problem panel).
 */
export const fetchVisibleTestCases = async (questionId) => {
    const response = await api.get(`/api/coding/questions/${questionId}/testcases`);
    return response.data;
};

/**
 * Trigger Gemini AI to generate a brand new custom coding question.
 */
export const generateQuestion = async (topic, difficulty) => {
    const response = await api.post("/api/coding/questions/generate", { topic, difficulty });
    return response.data;
};

/**
 * Submit user code for the full Piston + Gemini hybrid evaluation.
 * Response shape: { submission, executionResult, aiMentor, cached }
 * Accepts an optional AbortSignal for cancellation.
 */
export const submitSolution = async ({ questionId, language, code, signal }) => {
    const response = await api.post("/api/coding/submit", { questionId, language, code }, { signal });
    return response.data;
};

/**
 * Run code with custom stdin — no submission saved, no AI analysis.
 * Returns: { verdict, stdout, stderr, compileOutput, timeMs, memoryKb }
 * Accepts an optional AbortSignal for cancellation.
 */
export const runWithCustomInput = async ({ language, code, stdin = "", signal }) => {
    const response = await api.post("/api/coding/run", { language, code, stdin }, { signal });
    return response.data;
};

/**
 * Fetch user submissions, optionally filtered by questionId.
 */
export const fetchSubmissions = async (questionId = null) => {
    const params = {};
    if (questionId) params.questionId = questionId;
    const response = await api.get("/api/coding/submissions", { params });
    return response.data;
};

/**
 * Fetch user statistics and topic-based progress tracking.
 */
export const fetchProgress = async () => {
    const response = await api.get("/api/coding/progress");
    return response.data;
};

/**
 * Check Piston execution engine health.
 * Public endpoint — no auth required.
 * Returns: { success, engine: { healthy, status, ... }, cache }
 */
export const checkEngineHealth = async () => {
    const response = await api.get("/api/coding/health");
    return response.data;
};

/**
 * Get all supported languages list dynamically from Piston cache.
 */
export const fetchSupportedLanguages = async () => {
    const response = await api.get("/api/coding/languages");
    return response.data;
};
