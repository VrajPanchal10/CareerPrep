import React from 'react';
import { LoadingButton } from "../../../components/ui";

export const TranscriptPanel = ({
    transcript,
    onTranscriptChange,
    interviewState,
    onSubmit,
    timer,
    browserConfidence = 1.0,
    voiceLanguage
}) => {
    const isReadOnly = ["PROCESSING", "EVALUATED", "COMPLETED"].includes(interviewState);
    const isRecording = interviewState === "RECORDING";
    const isPaused = interviewState === "PAUSED";
    const isProcessing = interviewState === "PROCESSING";

    return (
        <div className="transcript-card" style={{ marginTop: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <h4 style={{ textTransform: "uppercase", fontSize: "0.85rem", letterSpacing: "1px", color: "rgba(255,255,255,0.7)" }}>SPOKEN TRANSCRIPTION / TYPED ANSWER</h4>
                {isRecording && (
                    <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                        <span style={{ color: "#2ecc71", fontSize: "0.8rem", fontWeight: "bold", animation: "recordingPulse 1s infinite alternate" }}>🎤 Listening...</span>
                        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.8rem" }}>
                            Confidence: <strong style={{ color: "#2ecc71" }}>{Math.round(browserConfidence * 100)}%</strong>
                        </span>
                        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.8rem" }}>
                            Language: <strong style={{ color: "#8a2be2" }}>{voiceLanguage === "hi-IN" ? "Hindi" : (voiceLanguage === "gu-IN" ? "Gujarati" : "English")}</strong>
                        </span>
                    </div>
                )}
                {isPaused && <span style={{ color: "#e67e22", fontSize: "0.8rem", fontWeight: "bold" }}>Paused</span>}
            </div>
            
            <textarea
                value={transcript}
                onChange={(e) => onTranscriptChange(e.target.value)}
                readOnly={isReadOnly}
                placeholder="Your transcribed text will populate here as you speak. Alternatively, you can type your answer manually here..."
                style={{ width: "100%", height: "150px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "1rem", color: "#fff", resize: "none" }}
            />
        </div>
    );
};
