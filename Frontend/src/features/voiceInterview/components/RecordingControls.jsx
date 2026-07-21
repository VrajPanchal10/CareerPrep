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
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", marginTop: "1rem" }}>
            
            {interviewState === "READY" && (
                <button 
                    onClick={onRecordStart}
                    className="btn btn--primary"
                    style={{ padding: "0.8rem 2rem", fontSize: "1.1rem", borderRadius: "8px", background: "#27ae60" }}
                >
                    <i className="fi fi-rr-microphone"></i> Start Answer
                </button>
            )}

            {(isRecording || isPaused) && (
                <div style={{ display: "flex", gap: "1rem" }}>
                    {isRecording ? (
                        <button onClick={onRecordPause} className="btn" style={{ background: "#f1c40f", color: "#000", padding: "0.6rem 1.5rem" }}>
                            <i className="fi fi-rr-pause"></i> Pause
                        </button>
                    ) : (
                        <button onClick={onRecordResume} className="btn" style={{ background: "#2ecc71", color: "#fff", padding: "0.6rem 1.5rem" }}>
                            <i className="fi fi-rr-play"></i> Resume
                        </button>
                    )}
                    <button onClick={onSubmit} className="btn btn--primary" style={{ background: "#d20d3b", padding: "0.6rem 1.5rem" }}>
                        <i className="fi fi-rr-stop"></i> Stop & Submit
                    </button>
                </div>
            )}

            {(isRecording || isPaused) && (
                <div style={{ fontSize: "0.85rem", fontWeight: "bold", textTransform: "uppercase" }}>
                    <span style={{ color: "rgba(255,255,255,0.5)" }}>Status: </span>
                    <span style={{ color: isRecording ? "#d20d3b" : "#f1c40f" }}>
                        {isRecording ? "RECORDING" : "PAUSED"}
                    </span>
                </div>
            )}

            {isRecording && (
                <div style={{
                    marginTop: "0.5rem",
                    background: "rgba(20,20,25,0.8)",
                    border: "1px solid rgba(210, 13, 59, 0.4)",
                    borderRadius: "20px",
                    padding: "0.4rem 1rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    boxShadow: "0 0 15px rgba(210,13,59,0.2)"
                }}>
                    <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#d20d3b", animation: "recordingPulse 1s infinite alternate" }}></div>
                    <span style={{ color: "#d20d3b", fontWeight: "bold", fontSize: "0.85rem", letterSpacing: "1px" }}>MIC ACTIVE {formatTime(timer)}</span>
                </div>
            )}

            {isPaused && (
                <div style={{
                    marginTop: "0.5rem",
                    background: "rgba(20,20,25,0.8)",
                    border: "1px solid rgba(241, 196, 15, 0.4)",
                    borderRadius: "20px",
                    padding: "0.4rem 1rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem"
                }}>
                    <span style={{ color: "#f1c40f", fontWeight: "bold", fontSize: "0.85rem", letterSpacing: "1px" }}>{formatTime(timer)}</span>
                </div>
            )}

        </div>
    );
};
