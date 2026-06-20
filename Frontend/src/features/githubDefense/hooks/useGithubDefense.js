import { useState, useCallback } from "react";
import {
    analyzeRepository,
    startRepoInterview,
    submitRepoAnswer,
    completeRepoInterview,
    fetchRepoDashboard,
    fetchRepoSession
} from "../services/githubDefense.api";

export const useGithubDefense = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [analyses, setAnalyses] = useState([]);
    const [dashboard, setDashboard] = useState(null);
    const [activeSession, setActiveSession] = useState(null);

    const loadDashboard = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchRepoDashboard();
            setAnalyses(data.analyses || []);
            setDashboard(data.dashboard || null);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to load dashboard data.");
        } finally {
            setLoading(false);
        }
    }, []);

    const triggerAnalysis = useCallback(async ({ repoUrl, githubToken }) => {
        setLoading(true);
        setError(null);
        try {
            const data = await analyzeRepository({ repoUrl, githubToken });
            await loadDashboard(); // refresh
            return data.analysis;
        } catch (err) {
            const msg = err.response?.data?.message || "Repository analysis failed.";
            setError(msg);
            throw new Error(msg);
        } finally {
            setLoading(false);
        }
    }, [loadDashboard]);

    const startInterview = useCallback(async ({ repositoryAnalysisId, interviewLength }) => {
        setLoading(true);
        setError(null);
        try {
            const data = await startRepoInterview({ repositoryAnalysisId, interviewLength });
            setActiveSession(data.session);
            return data.session;
        } catch (err) {
            const msg = err.response?.data?.message || "Failed to start interview room.";
            setError(msg);
            throw new Error(msg);
        } finally {
            setLoading(false);
        }
    }, []);

    const loadSession = useCallback(async (sessionId) => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchRepoSession(sessionId);
            setActiveSession(data.session);
            return data.session;
        } catch (err) {
            setError(err.response?.data?.message || "Failed to fetch session.");
        } finally {
            setLoading(false);
        }
    }, []);

    const submitAnswer = useCallback(async ({ sessionId, questionIndex, userAnswer }) => {
        setError(null);
        try {
            const data = await submitRepoAnswer({ sessionId, questionIndex, userAnswer });
            setActiveSession(data.session);
            return data;
        } catch (err) {
            const msg = err.response?.data?.message || "Failed to submit answer.";
            setError(msg);
            throw new Error(msg);
        }
    }, []);

    const completeInterview = useCallback(async (sessionId) => {
        setLoading(true);
        setError(null);
        try {
            const data = await completeRepoInterview(sessionId);
            setActiveSession(data.session);
            return data.result;
        } catch (err) {
            const msg = err.response?.data?.message || "Failed to complete interview.";
            setError(msg);
            throw new Error(msg);
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        loading,
        error,
        analyses,
        dashboard,
        activeSession,
        loadDashboard,
        triggerAnalysis,
        startInterview,
        loadSession,
        submitAnswer,
        completeInterview
    };
};
