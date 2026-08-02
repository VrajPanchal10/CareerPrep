import api from "../../../utils/apiClient";

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
 * Upload audio file for transcription via Sarvam STT.
 * @param {FormData} formData
 */
export const transcribeVoiceAudio = async (formData) => {
    const response = await api.post("/api/voice-session/transcribe", formData, {
        headers: {
            "Content-Type": "multipart/form-data"
        }
    });
    return response.data;
};

/**
 * Request speech synthesis via Sarvam TTS.
 * @param {Object} payload { text, languageCode, speaker }
 */
export const synthesizeSpeech = async ({ text, languageCode, speaker, gender, speed }, options = {}) => {
    const response = await api.post("/api/voice-session/speak", {
        text,
        languageCode,
        speaker,
        gender,
        speed
    }, {
        signal: options.signal,
        ...options
    });
    return response.data;
};

/**
 * Submit spoken transcript for AI grading.
 * @param {Object} payload { sessionId, questionIndex, userAnswer, responseTime }
 */
export const submitVoiceAnswer = async ({ sessionId, questionIndex, userAnswer, responseTime, languageCode }) => {
    const response = await api.post("/api/voice-session/evaluate", {
        sessionId,
        questionIndex,
        userAnswer,
        responseTime,
        languageCode
    });
    return response.data;
};

/**
 * Complete verbal practice session, compute aggregate scores, and generate coach advice.
 * @param {String} sessionId 
 */
export const completeVoiceSession = async (sessionId) => {
    const response = await api.post(`/api/voice-session/${sessionId}/complete`, {});
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
export const fetchVoiceSession = async (sessionId, lang) => {
    const url = lang ? `/api/voice-session/${sessionId}?lang=${lang}` : `/api/voice-session/${sessionId}`;
    const response = await api.get(url);
    return response.data;
};

/**
 * Request instant on-demand translation for a question or text snippet.
 * @param {Object} payload { text, targetLanguage, sessionId, questionIndex }
 */
export const requestOnDemandTranslation = async ({ text, targetLanguage, sessionId, questionIndex }) => {
    const response = await api.post("/api/voice-session/translate-on-demand", {
        text,
        targetLanguage,
        sessionId,
        questionIndex
    });
    return response.data;
};

/**
 * Get all user voice interview sessions.
 */
export const fetchVoiceSessions = async () => {
    const response = await api.get("/api/voice-session/");
    return response.data;
};

