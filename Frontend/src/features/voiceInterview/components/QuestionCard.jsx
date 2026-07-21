import React from 'react';

export const QuestionCard = ({
    questionIndex,
    totalQuestions,
    displayQuestion,
    isFollowUp,
    intention,
    voiceLanguage,
    interviewState,
    children // Expecting AudioControls to be passed as children
}) => {
    const isSpeaking = interviewState === "PLAYING";

    return (
        <div className="speech-synth-card">
            <div className={`ai-avatar ${isSpeaking ? 'speaking' : ''}`}>
                🤖
            </div>
            
            {isFollowUp && (
                <div style={{ marginBottom: "1rem", color: "#f1c40f", fontSize: "0.85rem", fontWeight: "bold" }}>
                    <i className="fi fi-rr-lightbulb-on"></i> Contextual Follow-Up
                </div>
            )}
            
            <h3 className="question-speech-text">{displayQuestion}</h3>
            
            <div className="speech-controls">
                {children}
            </div>
        </div>
    );
};
