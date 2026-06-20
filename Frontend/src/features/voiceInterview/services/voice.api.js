import axios from "axios";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
    withCredentials: true,
});

/**
 * Start a new verbal mock session.
 * @param {Object} payload { interviewReportId, difficulty, enableFollowUps }
 */
export const startVoiceSession = async ({ interviewReportId, difficulty, enableFollowUps }) => {
    const response = await api.post("/api/voice-session/", {
        interviewReportId,
        difficulty,
        enableFollowUps
    });
    return response.data;
};

/**
 * Submit spoken transcript for AI grading.
 * @param {Object} payload { sessionId, questionIndex, userAnswer, responseTime }
 */
export const submitVoiceAnswer = async ({ sessionId, questionIndex, userAnswer, responseTime }) => {
    const response = await api.post("/api/voice-session/evaluate", {
        sessionId,
        questionIndex,
        userAnswer,
        responseTime
    });
    return response.data;
};

/**
 * Complete verbal practice session, compute aggregate scores, and generate coach advice.
 * @param {String} sessionId 
 */
export const completeVoiceSession = async (sessionId) => {
    const response = await api.post(`/api/voice-session/${sessionId}/complete`);
    return response.data;
};

/**
 * Retrieve voice coach progress metrics and trends data.
 */
export const fetchVoiceProgress = async () => {
    const response = await api.get("/api/voice-session/progress");
    return response.data;
};

/**
 * Fetch detailed verbal session history by ID.
 * @param {String} sessionId 
 */
export const fetchVoiceSession = async (sessionId) => {
    const response = await api.get(`/api/voice-session/${sessionId}`);
    return response.data;
};

/**
 * Get all user voice interview sessions.
 */
export const fetchVoiceSessions = async () => {
    const response = await api.get("/api/voice-session/");
    return response.data;
};
