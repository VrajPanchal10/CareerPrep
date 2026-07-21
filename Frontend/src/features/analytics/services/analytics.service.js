import apiClient from "../../../utils/apiClient";

/**
 * Service to retrieve analytics metrics datasets from the backend REST endpoints.
 */
export async function fetchAtsReports() {
    try {
        const response = await apiClient.get("/api/ats");
        // Ensure we handle standard envelope responses correctly
        return response.data?.success ? (response.data.atsReports || response.data.reports || []) : (Array.isArray(response.data) ? response.data : []);
    } catch (err) {
        console.error("fetchAtsReports failed:", err);
        return [];
    }
}

export async function fetchInterviewPlans() {
    try {
        const response = await apiClient.get("/api/interview");
        return response.data?.success ? (response.data.interviewReports || response.data.plans || []) : (Array.isArray(response.data) ? response.data : []);
    } catch (err) {
        console.error("fetchInterviewPlans failed:", err);
        return [];
    }
}

export async function fetchInterviewSessions(interviewId) {
    try {
        const response = await apiClient.get(`/api/interview/progress/${interviewId}`);
        return response.data?.success ? response.data.progress || [] : [];
    } catch (err) {
        console.error("fetchInterviewSessions failed:", err);
        return [];
    }
}

export async function fetchCodingProgress() {
    try {
        const response = await apiClient.get("/api/code/progress");
        return response.data?.success ? response.data.stats || null : null;
    } catch (err) {
        console.error("fetchCodingProgress failed:", err);
        return null;
    }
}

export async function fetchVoiceProgress() {
    try {
        const response = await apiClient.get("/api/voice-session/progress");
        return response.data?.success ? response.data.stats || null : null;
    } catch (err) {
        console.error("fetchVoiceProgress failed:", err);
        return null;
    }
}

export async function fetchGithubProgress() {
    try {
        const response = await apiClient.get("/api/github-defense/progress");
        return response.data?.success ? response.data.stats || null : null;
    } catch (err) {
        console.error("fetchGithubProgress failed:", err);
        return null;
    }
}
