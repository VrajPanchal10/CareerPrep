import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../../features/auth/hooks/useAuth';
import axios from 'axios';
import { useToast } from '../../../context/ToastContext';
import "./sessionExpiredModal.scss";

const SessionExpiredModal = () => {
    const navigate = useNavigate();
    const { user, handleLogout } = useAuth();
    const { addToast } = useToast();

    const [showWarning, setShowWarning] = useState(false);
    const [showExpired, setShowExpired] = useState(false);
    const [countdown, setCountdown] = useState(120); // 2 minutes warning countdown

    const idleTimerRef = useRef(null);
    const countdownIntervalRef = useRef(null);

    // Reset idle timers on activity listeners
    const resetIdleTimer = () => {
        if (!user) return; // Only track when authenticated
        if (showWarning || showExpired) return; // Don't reset if prompt is active

        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

        // Set idle warning threshold to 28 minutes (1680000 ms)
        idleTimerRef.current = setTimeout(() => {
            triggerWarning();
        }, 28 * 60 * 1000); 
    };

    const triggerWarning = () => {
        setShowWarning(true);
        setCountdown(120);
        
        // Cache unsaved form/page state to prevent data loss (Requirement 3)
        cacheUnsavedWork();

        // Start 2-minute countdown
        countdownIntervalRef.current = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(countdownIntervalRef.current);
                    triggerExpiration();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const triggerExpiration = async () => {
        setShowWarning(false);
        setShowExpired(true);
        try {
            await handleLogout();
        } catch (_) {}
    };

    const handleExtendSession = async () => {
        // Clear countdown
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        setShowWarning(false);

        try {
            // Call refresh endpoint to extend sliding session token
            await axios.post(
                `${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/auth/refresh`,
                {},
                { withCredentials: true }
            );
            addToast("Session extended successfully.", "success");
            // Reset idle timer
            resetIdleTimer();
        } catch (err) {
            console.error("Failed to extend session:", err);
            triggerExpiration();
        }
    };

    const handleManualLogout = async () => {
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        setShowWarning(false);
        try {
            await handleLogout();
            navigate('/login');
        } catch (_) {}
    };

    const cacheUnsavedWork = () => {
        try {
            // Grab any active inputs on the page
            const textInputs = Array.from(document.querySelectorAll('input[type="text"], textarea'));
            const inputsCache = textInputs.map(el => ({
                id: el.id || el.name,
                value: el.value
            })).filter(item => item.id && item.value);

            if (inputsCache.length > 0) {
                localStorage.setItem(`careerprep_cached_work_${window.location.pathname}`, JSON.stringify(inputsCache));
                addToast("Your unsaved input progress has been cached locally.", "info");
            }
        } catch (err) {
            console.warn("Failed to cache unsaved work state:", err);
        }
    };

    // Listen for custom "session-expired" events from apiClient
    useEffect(() => {
        const handleSessionExpiredEvent = () => {
            if (!showExpired) {
                if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
                if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
                setShowWarning(false);
                setShowExpired(true);
            }
        };

        window.addEventListener('session-expired', handleSessionExpiredEvent);
        return () => {
            window.removeEventListener('session-expired', handleSessionExpiredEvent);
        };
    }, [showExpired]);

    // Setup global activity event listeners when authenticated
    useEffect(() => {
        if (user) {
            const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
            events.forEach(event => window.addEventListener(event, resetIdleTimer));
            resetIdleTimer(); // Initialize

            return () => {
                events.forEach(event => window.removeEventListener(event, resetIdleTimer));
                if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
                if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
            };
        } else {
            // Clear if not logged in
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
            setShowWarning(false);
            setShowExpired(false);
        }
    }, [user, showWarning, showExpired]);

    // Format countdown seconds
    const formatTime = (secs) => {
        const minutes = Math.floor(secs / 60);
        const seconds = secs % 60;
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

    if (!showWarning && !showExpired) return null;

    return (
        <div className="session-modal-overlay">
            <div className="session-modal-card">
                {showWarning && (
                    <>
                        <div className="session-modal-icon warning">⚠</div>
                        <h2>Inactivity Warning</h2>
                        <p>Your session is about to expire due to inactivity.</p>
                        <div className="countdown-timer">
                            Session expires in: <strong>{formatTime(countdown)}</strong>
                        </div>
                        <p className="notice">
                            Note: Any typing progress has been cached. Click "Extend" to remain signed in.
                        </p>
                        <div className="session-modal-actions">
                            <button onClick={handleExtendSession} className="session-btn extend">
                                Extend Session
                            </button>
                            <button onClick={handleManualLogout} className="session-btn logout">
                                Log Out
                            </button>
                        </div>
                    </>
                )}

                {showExpired && (
                    <>
                        <div className="session-modal-icon expired">✕</div>
                        <h2>Session Expired</h2>
                        <p>Your session has expired. Please sign in again to resume.</p>
                        <div className="session-modal-actions">
                            <button 
                                onClick={() => {
                                    setShowExpired(false);
                                    navigate('/login');
                                }} 
                                className="session-btn extend"
                                style={{ width: '100%' }}
                            >
                                Go to Login
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default SessionExpiredModal;
