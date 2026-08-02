import React from 'react';

export const QuestionCard = ({
    questionIndex,
    totalQuestions,
    displayQuestion,
    isFollowUp,
    intention,
    voiceLanguage,
    interviewState,
    isTranslating,
    children
}) => {
    const isSpeaking = interviewState === "PLAYING";

    const followUpLabel = voiceLanguage === "hi-IN" 
        ? "💡 प्रासंगिक अनुवर्ती प्रश्न" 
        : voiceLanguage === "gu-IN" 
            ? "💡 સંબંધિત ફોલો-અપ પ્રશ્ન" 
            : "💡 Contextual Follow-Up";

    const translatingText = voiceLanguage === "hi-IN" 
        ? "अनुवाद हो रहा है..." 
        : voiceLanguage === "gu-IN" 
            ? "અનુવાદ થઈ રહ્યો છે..." 
            : "Translating question...";

    return (
        <div className="speech-synth-card">
            <div className={`ai-avatar ${isSpeaking ? 'speaking' : ''}`}>
                🤖
            </div>
            
            {isFollowUp && (
                <div style={{ marginBottom: "1rem", color: "#f1c40f", fontSize: "0.85rem", fontWeight: "bold" }}>
                    <i className="fi fi-rr-lightbulb-on"></i> {followUpLabel}
                </div>
            )}

            {isTranslating ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.6rem", margin: "1.5rem 0", color: "#818cf8" }}>
                    <div style={{
                        width: "18px",
                        height: "18px",
                        border: "2px solid rgba(129, 140, 248, 0.2)",
                        borderTopColor: "#818cf8",
                        borderRadius: "50%",
                        animation: "lazy-route-spin 0.8s linear infinite"
                    }} />
                    <span style={{ fontSize: "0.95rem", fontWeight: "500" }}>{translatingText}</span>
                </div>
            ) : (
                <h3 className="question-speech-text">{displayQuestion}</h3>
            )}
            
            <div className="speech-controls">
                {children}
            </div>
        </div>
    );
};

