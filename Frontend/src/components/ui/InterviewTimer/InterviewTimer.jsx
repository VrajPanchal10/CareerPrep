import React, { useEffect, useState, useRef } from "react";
import "./InterviewTimer.scss";

const InterviewTimer = ({ 
    active = false, 
    mode = "countup", 
    duration = 0, 
    onComplete, 
    onTick,
    resetTrigger
}) => {
    const [seconds, setSeconds] = useState(mode === "countdown" ? duration : 0);
    const intervalRef = useRef(null);
    // Track whether the timer is actively running so the onTick effect can
    // skip the initial render and the reset-to-zero tick.
    const isRunningRef = useRef(false);

    // Sync countdown duration if it changes externally
    useEffect(() => {
        if (mode === "countdown") {
            setSeconds(duration);
        }
    }, [duration, mode]);

    // Handle manual reset — also clears the running flag so onTick is not
    // fired immediately after a question change resets seconds to 0.
    useEffect(() => {
        isRunningRef.current = false;
        setSeconds(mode === "countdown" ? duration : 0);
    }, [resetTrigger]);

    useEffect(() => {
        if (!active) {
            isRunningRef.current = false;
            if (intervalRef.current) clearInterval(intervalRef.current);
            return;
        }

        isRunningRef.current = true;

        intervalRef.current = setInterval(() => {
            setSeconds(prev => {
                if (mode === "countdown") {
                    if (prev <= 1) {
                        clearInterval(intervalRef.current);
                        // Schedule onComplete outside the state updater to
                        // avoid calling setState during another component's render.
                        if (onComplete) setTimeout(onComplete, 0);
                        return 0;
                    }
                    return prev - 1;
                }
                return prev + 1;
            });
        }, 1000);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [active, mode, onComplete]);

    // Call onTick AFTER the render cycle completes — never inside the state updater.
    // onTick calls setTimer() in VoiceInterviewRoom, which would be an illegal
    // cross-component setState if invoked during InterviewTimer's own state update.
    // Guard with isRunningRef so we don't fire on the reset-to-0 tick.
    useEffect(() => {
        if (onTick && isRunningRef.current && seconds > 0) {
            onTick(seconds);
        }
    }, [seconds]);

    // Helper to format: MM:SS or HH:MM:SS
    const formatTime = (totalSecs) => {
        const hrs = Math.floor(totalSecs / 3600);
        const mins = Math.floor((totalSecs % 3600) / 60);
        const secs = totalSecs % 60;

        const formattedMins = mins.toString().padStart(2, "0");
        const formattedSecs = secs.toString().padStart(2, "0");

        if (hrs > 0) {
            return `${hrs.toString().padStart(2, "0")}:${formattedMins}:${formattedSecs}`;
        }
        return `${formattedMins}:${formattedSecs}`;
    };

    return (
        <div 
            className={`interview-timer ${active ? "active" : "paused"}`} 
            role="timer"
            aria-live="off"
            aria-label={`Interview timer displaying ${formatTime(seconds)}`}
        >
            <span className="timer-icon">⏱️</span>
            <span className="timer-digits">{formatTime(seconds)}</span>
            {!active && <span className="timer-status">PAUSED</span>}
        </div>
    );
};

export default InterviewTimer;
