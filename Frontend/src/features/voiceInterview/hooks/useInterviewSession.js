import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchVoiceSession, submitVoiceAnswer, completeVoiceSession } from '../services/voice.api';

export function useInterviewSession(sessionId, onSessionLoaded, onError) {
    const [session, setSession] = useState(null);
    const [currentQIndex, setCurrentQIndex] = useState(0);
    const [summaryData, setSummaryData] = useState(null);
    const [resumeData, setResumeData] = useState(null);

    const callbacksRef = useRef({ onSessionLoaded, onError });
    useEffect(() => {
        callbacksRef.current = { onSessionLoaded, onError };
    }, [onSessionLoaded, onError]);

    const loadSession = useCallback(async () => {
        try {
            const data = await fetchVoiceSession(sessionId);
            if (data.success) {
                setSession(data.session);
                
                const answeredIndexes = data.session.evaluations.map(e => e.questionIndex);
                let nextIdx = 0;
                for (let i = 0; i < data.session.questions.length; i++) {
                    if (!answeredIndexes.includes(i)) {
                        nextIdx = i;
                        break;
                    }
                }
                if (answeredIndexes.length === data.session.questions.length) {
                    nextIdx = data.session.questions.length - 1;
                }
                setCurrentQIndex(nextIdx);

                if (callbacksRef.current.onSessionLoaded) {
                    callbacksRef.current.onSessionLoaded(data.session, nextIdx);
                }
            }
        } catch (err) {
            if (callbacksRef.current.onError) callbacksRef.current.onError("Could not retrieve session details.");
        }
    }, [sessionId]);

    useEffect(() => {
        const savedData = sessionStorage.getItem(`voice_session_${sessionId}`);
        if (savedData) {
            try {
                const parsed = JSON.parse(savedData);
                setResumeData(parsed);
                return;
            } catch (err) {
                sessionStorage.removeItem(`voice_session_${sessionId}`);
            }
        }
        loadSession();
    }, [sessionId, loadSession]);

    const handleResumeSession = useCallback(() => {
        if (!resumeData) return null;
        const res = { ...resumeData };
        setSession(res.session);
        setCurrentQIndex(res.currentQIndex);
        setResumeData(null);
        return res;
    }, [resumeData]);

    const handleDiscardResume = useCallback(() => {
        sessionStorage.removeItem(`voice_session_${sessionId}`);
        setResumeData(null);
        loadSession();
    }, [sessionId, loadSession]);

    const saveSessionProgress = useCallback((stateToSave) => {
        if (session && stateToSave.interviewState !== "IDLE" && stateToSave.interviewState !== "COMPLETED") {
            sessionStorage.setItem(`voice_session_${sessionId}`, JSON.stringify({
                session, currentQIndex, ...stateToSave
            }));
        }
    }, [session, currentQIndex, sessionId]);

    const clearSessionProgress = useCallback(() => {
        sessionStorage.removeItem(`voice_session_${sessionId}`);
    }, [sessionId]);

    const nextQuestion = useCallback(() => {
        if (!session || !session.questions) return false;
        if (currentQIndex < session.questions.length - 1) {
            setCurrentQIndex(prev => prev + 1);
            return true;
        }
        return false;
    }, [session, currentQIndex]);

    const submitAnswer = useCallback(async ({ transcript, timer, voiceLanguage }) => {
        try {
            const data = await submitVoiceAnswer({
                sessionId,
                questionIndex: currentQIndex,
                userAnswer: transcript,
                responseTime: timer,
                languageCode: voiceLanguage
            });
            if (data.success) {
                setSession(data.session);
                return { success: true, evaluation: data.evaluation, hasFollowUp: !!data.followUpQuestion };
            }
            return { success: false, error: "Failed to submit answer" };
        } catch (err) {
            return { success: false, error: err.response?.data?.message || "Failed to submit and evaluate your verbal answer." };
        }
    }, [sessionId, currentQIndex]);

    const completeSession = useCallback(async () => {
        try {
            const data = await completeVoiceSession(sessionId);
            if (data.success) {
                setSummaryData(data.session);
                setSession(data.session);
                clearSessionProgress();
                return { success: true, summary: data.session };
            }
            return { success: false, error: "Failed to complete voice practice session statistics." };
        } catch (err) {
            return { success: false, error: "Failed to complete voice practice session statistics." };
        }
    }, [sessionId, clearSessionProgress]);

    return {
        session,
        currentQIndex,
        summaryData,
        resumeData,
        handleResumeSession,
        handleDiscardResume,
        saveSessionProgress,
        clearSessionProgress,
        nextQuestion,
        submitAnswer,
        completeSession,
        setSession
    };
}
