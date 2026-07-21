import React from 'react';
import { HelpTooltip } from "../../../components/ui";

export const AudioControls = ({
    interviewState,
    onPlay,
    onPause,
    onResume,
    onStop,
    speakingRate,
    setSpeakingRate,
    voiceLanguage,
    setVoiceLanguage,
    voiceSpeaker,
    setVoiceSpeaker,
    children
}) => {
    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1.5rem", marginTop: "1.5rem" }}>
            <div style={{ display: "flex", gap: "1.5rem", alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <span style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.6)" }}>Language:</span>
                    <select 
                        style={{
                            background: "rgba(255,255,255,0.03)", 
                            border: "1px solid rgba(255,255,255,0.08)", 
                            color: "#fff", 
                            padding: "0.4rem 0.8rem", 
                            borderRadius: "6px", 
                            fontSize: "0.82rem",
                            outline: "none"
                        }}
                        value={voiceLanguage} 
                        onChange={(e) => setVoiceLanguage(e.target.value)}
                        disabled={["RECORDING", "PLAYING", "PROCESSING", "PAUSED_RECORDING"].includes(interviewState)}
                    >
                        <option value="en-IN">Indian English</option>
                        <option value="hi-IN">Hindi (IN)</option>
                        <option value="gu-IN">Gujarati (IN)</option>
                    </select>
                </div>

                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <span style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.6)" }}>Speaker</span>
                    <HelpTooltip content="Choose a speaker voice." />
                    <select 
                        style={{
                            background: "rgba(255,255,255,0.03)", 
                            border: "1px solid rgba(255,255,255,0.08)", 
                            color: "#fff", 
                            padding: "0.4rem 0.8rem", 
                            borderRadius: "6px", 
                            fontSize: "0.82rem",
                            outline: "none"
                        }}
                        value={voiceSpeaker}
                        onChange={(e) => setVoiceSpeaker(e.target.value)}
                        disabled={["RECORDING", "PLAYING", "PROCESSING", "PAUSED"].includes(interviewState)}
                    >
                        <option value="meera" disabled>Meera (Female) - Unsupported</option>
                        <option value="shreya">Shreya (Female)</option>
                        <option value="shubh">Shubh (Male)</option>
                    </select>
                </div>

                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <span style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.6)" }}>Speed: {speakingRate.toFixed(1)}x</span>
                    <input
                        type="range"
                        min="0.5"
                        max="2.0"
                        step="0.1"
                        value={speakingRate}
                        onChange={(e) => setSpeakingRate(parseFloat(e.target.value))}
                        disabled={["RECORDING", "PLAYING", "PROCESSING"].includes(interviewState)}
                        style={{ width: "80px", accentColor: "#d20d3b" }}
                    />
                </div>
            </div>

            <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
                {/* Assistant Volume placeholder. Rendered by parent passing children */}
                {children}
            </div>

            <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
                <button onClick={onPlay} className="control-btn" disabled={interviewState === "RECORDING"} style={{ padding: "0.6rem 1rem", fontSize: "0.85rem", borderRadius: "6px" }}>
                    <i className="fi fi-rr-volume"></i> {interviewState === "PLAYING" ? "Replay Question" : "Replay Question"}
                </button>
                
                <button onClick={onPause} className="control-btn" disabled={interviewState !== "PLAYING" && interviewState !== "PAUSED_PLAYBACK"} style={{ padding: "0.6rem 1rem", fontSize: "0.85rem", borderRadius: "6px" }}>
                    <i className="fi fi-rr-pause"></i> Pause
                </button>

                <button onClick={onStop} className="control-btn" disabled={interviewState !== "PLAYING" && interviewState !== "PAUSED_PLAYBACK"} style={{ padding: "0.6rem 1rem", fontSize: "0.85rem", borderRadius: "6px" }}>
                    <i className="fi fi-rr-stop"></i> Stop Audio
                </button>
            </div>
        </div>
    );
};
