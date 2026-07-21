import React from "react";
import "./RecordingControls.scss";

const RecordingControls = ({ recordingState = "stopped", onStart, onPause, onResume, onStop, disabled = false }) => {
    
    return (
        <div className="recording-controls" role="group" aria-label="Audio verbal recording control parameters">
            {recordingState === "stopped" ? (
                <button 
                    className="rec-btn rec-btn--start" 
                    onClick={onStart}
                    disabled={disabled}
                    aria-label="Start recording verbal response"
                    title="Start Speaking"
                    id="startRecControlBtn"
                >
                    🎙️ Start Answer
                </button>
            ) : (
                <div className="rec-btn-group">
                    {recordingState === "recording" ? (
                        <button 
                            className="rec-btn rec-btn--pause" 
                            onClick={onPause}
                            disabled={disabled}
                            aria-label="Pause active recording"
                            title="Pause recording"
                            id="pauseRecControlBtn"
                        >
                            ⏸️ Pause
                        </button>
                    ) : (
                        <button 
                            className="rec-btn rec-btn--resume" 
                            onClick={onResume}
                            disabled={disabled}
                            aria-label="Resume paused recording"
                            title="Resume recording"
                            id="resumeRecControlBtn"
                        >
                            ▶️ Resume
                        </button>
                    )}
                    
                    <button 
                        className="rec-btn rec-btn--stop" 
                        onClick={onStop}
                        disabled={disabled}
                        aria-label="Stop recording and submit for AI evaluation"
                        title="Submit Answer"
                        id="stopRecControlBtn"
                    >
                        ⏹️ Stop & Submit
                    </button>
                </div>
            )}

            {/* Displaying recording state label for accessibility screen readers */}
            <div className="rec-state-indicator" aria-live="polite">
                Status: <span className={`state-label state-label--${recordingState}`}>{recordingState.toUpperCase()}</span>
            </div>
        </div>
    );
};

export default RecordingControls;
