import axios from "axios";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
    withCredentials: true,
});

/**
 * Trigger deep AI analysis on a public/private repo.
 */
export const analyzeRepository = async ({ repoUrl, githubToken }) => {
    const response = await api.post("/api/github-defense/analyze", {
        repoUrl,
        githubToken
    });
    return response.data;
};

/**
 * Start a mock project-defense interview.
 */
export const startRepoInterview = async ({ repositoryAnalysisId, interviewLength }) => {
    const response = await api.post("/api/github-defense/interview/start", {
        repositoryAnalysisId,
        interviewLength
    });
    return response.data;
};

/**
 * Submit candidate defense answer.
 */
export const submitRepoAnswer = async ({ sessionId, questionIndex, userAnswer }) => {
    const response = await api.post("/api/github-defense/interview/submit", {
        sessionId,
        questionIndex,
        userAnswer
    });
    return response.data;
};

/**
 * Complete the interview, compile overall metrics and feedback.
 */
export const completeRepoInterview = async (sessionId) => {
    const response = await api.post(`/api/github-defense/interview/${sessionId}/complete`);
    return response.data;
};

/**
 * Fetch analyzed repos and dashboard scores summary.
 */
export const fetchRepoDashboard = async () => {
    const response = await api.get("/api/github-defense/dashboard");
    return response.data;
};

/**
 * Fetch details of a specific repository interview session.
 */
export const fetchRepoSession = async (sessionId) => {
    const response = await api.get(`/api/github-defense/session/${sessionId}`);
    return response.data;
};
