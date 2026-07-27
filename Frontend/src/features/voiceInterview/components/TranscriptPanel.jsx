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
        <div className="transcript-card">
            <div className="transcript-header">
                <h4>SPOKEN TRANSCRIPTION / TYPED ANSWER</h4>
                {isRecording && (
                    <div className="listening-indicator">
                        <span className="listening-dot" />
                        <span>Listening...</span>
                    </div>
                )}
                {isPaused && <span className="paused-indicator">Paused</span>}
            </div>
            
            <textarea
                value={transcript}
                onChange={(e) => onTranscriptChange(e.target.value)}
                readOnly={isReadOnly}
                placeholder="Your transcribed text will populate here as you speak. Alternatively, you can type your answer manually here..."
                className="transcript-textarea"
            />
        </div>
    );
};
