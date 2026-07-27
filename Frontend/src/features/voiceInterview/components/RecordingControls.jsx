import React from 'react';

export const RecordingControls = ({
    interviewState,
    onRecordStart,
    onRecordPause,
    onRecordResume,
    onSubmit,
    timer
}) => {
    const isRecording = interviewState === "RECORDING";
    const isPaused = interviewState === "PAUSED";

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, "0");
        const s = (seconds % 60).toString().padStart(2, "0");
        return `${m}:${s}`;
    };

    if (["PROCESSING", "EVALUATED", "COMPLETED", "IDLE"].includes(interviewState)) {
        return null;
    }

    return (
        <div className="recording-controls-container">
            {interviewState === "READY" && (
                <button 
                    onClick={onRecordStart}
                    className="btn btn--primary start-answer-btn"
                >
                    <i className="fi fi-rr-microphone"></i> Start Answer
                </button>
            )}

            {(isRecording || isPaused) && (
                <div className="recording-action-bar">
                    {isRecording ? (
                        <button onClick={onRecordPause} className="control-btn">
                            <i className="fi fi-rr-pause"></i> Pause
                        </button>
                    ) : (
                        <button onClick={onRecordResume} className="control-btn">
                            <i className="fi fi-rr-play"></i> Resume
                        </button>
                    )}
                    <button onClick={onRecordPause} className="submit-answer-btn">
                        <i className="fi fi-rr-stop"></i> Stop Recording
                    </button>
                    <div className="recording-status-badge">
                        <span className={`status-dot ${isRecording ? 'recording' : 'paused'}`} />
                        <span className="status-label">{isRecording ? "Recording" : "Paused"}</span>
                        <span className="status-divider">•</span>
                        <span className="status-time">{formatTime(timer)}</span>
                    </div>
                </div>
            )}
        </div>
    );
};
