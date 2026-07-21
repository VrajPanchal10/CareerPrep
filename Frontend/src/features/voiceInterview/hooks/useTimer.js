import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Hook to manage a strictly single-instance timer interval.
 * Solves the duplicate timer race condition.
 */
export function useTimer(initialValue = 0) {
    const [timer, setTimer] = useState(initialValue);
    const intervalRef = useRef(null);

    const startTimer = useCallback(() => {
        if (intervalRef.current) return;
        intervalRef.current = setInterval(() => {
            setTimer((prev) => prev + 1);
        }, 1000);
    }, []);

    const pauseTimer = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    const resetTimer = useCallback((newInitial = 0) => {
        pauseTimer();
        setTimer(newInitial);
    }, [pauseTimer]);

    // Cleanup on unmount
    useEffect(() => {
        return () => pauseTimer();
    }, [pauseTimer]);

    return { timer, startTimer, pauseTimer, resetTimer };
}
