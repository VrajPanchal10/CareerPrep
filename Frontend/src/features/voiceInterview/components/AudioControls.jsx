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
        <div className="voice-controls-container">
            <div className="voice-settings-grid">
                <div className="voice-setting-item">
                    <label htmlFor="voiceLanguageSelect">Language</label>
                    <select 
                        id="voiceLanguageSelect"
                        className="voice-select"
                        value={voiceLanguage} 
                        onChange={(e) => setVoiceLanguage(e.target.value)}
                        disabled={["RECORDING", "PLAYING", "PROCESSING", "PAUSED_RECORDING"].includes(interviewState)}
                    >
                        <option value="en-IN">Indian English</option>
                        <option value="hi-IN">Hindi (IN)</option>
                        <option value="gu-IN">Gujarati (IN)</option>
                    </select>
                </div>

                <div className="voice-setting-item">
                    <div className="label-with-help">
                        <label htmlFor="voiceSpeakerSelect">Speaker</label>
                        <HelpTooltip content="Choose a speaker voice." />
                    </div>
                    <select 
                        id="voiceSpeakerSelect"
                        className="voice-select"
                        value={voiceSpeaker}
                        onChange={(e) => setVoiceSpeaker(e.target.value)}
                        disabled={["RECORDING", "PLAYING", "PROCESSING", "PAUSED"].includes(interviewState)}
                    >
                        <option value="meera" disabled>Meera (Female) - Unsupported</option>
                        <option value="shreya">Shreya (Female)</option>
                        <option value="shubh">Shubh (Male)</option>
                    </select>
                </div>

                <div className="voice-setting-item">
                    <div className="label-with-value">
                        <label>Speed</label>
                        <span className="speed-val">{speakingRate.toFixed(1)}x</span>
                    </div>
                    <input
                        type="range"
                        className="voice-slider"
                        min="0.5"
                        max="2.0"
                        step="0.1"
                        value={speakingRate}
                        onChange={(e) => setSpeakingRate(parseFloat(e.target.value))}
                        disabled={["RECORDING", "PLAYING", "PROCESSING"].includes(interviewState)}
                    />
                </div>
            </div>

            <div className="voice-volume-row">
                {/* Assistant Volume placeholder. Rendered by parent passing children */}
                {children}
            </div>

            <div className="playback-buttons-row">
                <button onClick={onPlay} className="control-btn" disabled={interviewState === "RECORDING"}>
                    <i className="fi fi-rr-volume"></i> {interviewState === "PLAYING" ? "Replay Question" : "Replay Question"}
                </button>
                
                <button onClick={onPause} className="control-btn" disabled={interviewState !== "PLAYING" && interviewState !== "PAUSED_PLAYBACK"}>
                    <i className="fi fi-rr-pause"></i> Pause
                </button>

                <button onClick={onStop} className="control-btn" disabled={interviewState !== "PLAYING" && interviewState !== "PAUSED_PLAYBACK"}>
                    <i className="fi fi-rr-stop"></i> Stop Audio
                </button>
            </div>
        </div>
    );
};
