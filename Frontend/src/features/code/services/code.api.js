import axios from "axios";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
    withCredentials: true,
});

/**
 * Fetch all available coding questions, optionally filtered by topic and/or difficulty.
 */
export const fetchQuestions = async (filters = {}) => {
    const { topic, difficulty } = filters;
    const params = {};
    if (topic) params.topic = topic;
    if (difficulty) params.difficulty = difficulty;
    
    const response = await api.get("/api/code/questions", { params });
    return response.data;
};

/**
 * Fetch detailed info for a single coding question by ID.
 */
export const fetchQuestionById = async (id) => {
    const response = await api.get(`/api/code/questions/${id}`);
    return response.data;
};

/**
 * Trigger Gemini AI to generate a brand new custom coding question.
 */
export const generateQuestion = async (topic, difficulty) => {
    const response = await api.post("/api/code/questions/generate", { topic, difficulty });
    return response.data;
};

/**
 * Submit user code to the AI evaluator for correctness, readability, complexity and edge-cases.
 */
export const submitSolution = async ({ questionId, language, code }) => {
    const response = await api.post("/api/code/submit", { questionId, language, code });
    return response.data;
};

/**
 * Fetch user submissions, optionally filtered by questionId.
 */
export const fetchSubmissions = async (questionId = null) => {
    const params = {};
    if (questionId) params.questionId = questionId;
    const response = await api.get("/api/code/submissions", { params });
    return response.data;
};

/**
 * Fetch user statistics and topic-based progress tracking.
 */
export const fetchProgress = async () => {
    const response = await api.get("/api/code/progress");
    return response.data;
};
