import React, { memo } from 'react';

const UI_STRINGS = {
    "hi-IN": {
        strengthsTitle: "उत्तर की शक्तियाँ",
        weaknessesTitle: "उत्तर की कमजोरियाँ",
        suggestionsTitle: "सुधार के लिए सुझाव",
        noStrengths: "कोई विशेष शक्ति दर्ज नहीं की गई।",
        noWeaknesses: "कोई विशेष कमजोरी नहीं पाई गई।",
        noSuggestions: "कोई विशेष सुझाव नहीं।"
    },
    "gu-IN": {
        strengthsTitle: "જવાબની શક્તિઓ",
        weaknessesTitle: "જવાબની નબળાઈઓ",
        suggestionsTitle: "સુધારણા માટે સૂચનો",
        noStrengths: "કોઈ મુખ્ય શક્તિઓ મળી નથી.",
        noWeaknesses: "કોઈ વિશેષ નબળાઈઓ મળી નથી.",
        noSuggestions: "કોઈ ખાસ સૂચનો નથી."
    },
    "en-IN": {
        strengthsTitle: "Answer Strengths",
        weaknessesTitle: "Answer Weaknesses",
        suggestionsTitle: "Suggestions for Improvement",
        noStrengths: "No strengths identified.",
        noWeaknesses: "No weaknesses identified.",
        noSuggestions: "No specific suggestions."
    }
};

export const EvaluationPanel = memo(({ evaluation, voiceLanguage = "en-IN" }) => {
    if (!evaluation) return null;

    const labels = UI_STRINGS[voiceLanguage] || UI_STRINGS["en-IN"];

    const renderProgressBar = (label, score, colorClass = "default") => {
        const barColor = colorClass === "red" ? "#e74c3c" : colorClass === "yellow" ? "#f1c40f" : "#2ecc71";
        return (
            <div style={{ marginBottom: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", color: "rgba(255,255,255,0.7)", marginBottom: "0.25rem" }}>
                    <span>{label}</span>
                    <span style={{ fontWeight: "bold", color: "#fff" }}>{score}%</span>
                </div>
                <div style={{ width: "100%", height: "6px", background: "rgba(255,255,255,0.08)", borderRadius: "3px", overflow: "hidden" }}>
                    <div style={{ width: `${score}%`, height: "100%", background: barColor, borderRadius: "3px", transition: "width 0.8s ease" }} />
                </div>
            </div>
        );
    };

    const getConfidenceBadgeColor = (indicator) => {
        if (indicator === "Confident") return { bg: "rgba(46, 204, 113, 0.15)", border: "1px solid rgba(46, 204, 113, 0.4)", text: "#2ecc71" };
        if (indicator === "Neutral") return { bg: "rgba(241, 196, 15, 0.15)", border: "1px solid rgba(241, 196, 15, 0.4)", text: "#f1c40f" };
        return { bg: "rgba(231, 76, 60, 0.15)", border: "1px solid rgba(231, 76, 60, 0.4)", text: "#e74c3c" };
    };

    const confidenceStyle = getConfidenceBadgeColor(evaluation.confidenceIndicator);

    return (
        <div style={{ marginTop: "2rem", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "2rem" }}>
            
            {/* Top Overview Row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
                <h3 style={{ margin: 0, fontSize: "1.25rem", color: "#fff", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <i className="fi fi-rr-chart-pie-alt" style={{ color: "#d20d3b" }}></i> AI Speech Evaluation
                </h3>
                <div style={{ 
                    background: "rgba(210, 13, 59, 0.1)", 
                    border: "1px solid rgba(210, 13, 59, 0.3)", 
                    borderRadius: "8px", 
                    padding: "0.5rem 1rem",
                    display: "flex", 
                    alignItems: "center", 
                    gap: "0.75rem"
                }}>
                    <span style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.6)", textTransform: "uppercase", fontWeight: "bold" }}>Overall Score:</span>
                    <span style={{ fontSize: "1.5rem", fontWeight: "800", color: "#d20d3b" }}>{evaluation.overallScore}%</span>
                </div>
            </div>

            {/* Core Metrics Grid */}
            <div className="summary-scores-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", marginBottom: "2rem" }}>
                <div className="score-box comm">
                    <h3>Communication</h3>
                    <div className="score">{evaluation.communicationScore}</div>
                </div>
                <div className="score-box clarity">
                    <h3>Clarity</h3>
                    <div className="score">{evaluation.clarityScore}</div>
                </div>
                <div className="score-box tech">
                    <h3>Technical</h3>
                    <div className="score">{evaluation.technicalScore}</div>
                </div>
                <div className="score-box">
                    <h3>Explanation</h3>
                    <div className="score">{evaluation.explanationScore}</div>
                </div>
            </div>

            {/* Metadata & Behavioral Highlights Row */}
            <div style={{ 
                display: "flex", 
                gap: "1rem", 
                flexWrap: "wrap", 
                marginBottom: "2rem", 
                background: "rgba(255,255,255,0.02)", 
                border: "1px solid rgba(255,255,255,0.05)", 
                borderRadius: "10px", 
                padding: "1rem" 
            }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", minWidth: "120px" }}>
                    <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", fontWeight: "bold" }}>Confidence</span>
                    <span style={{ 
                        background: confidenceStyle.bg, 
                        border: confidenceStyle.border, 
                        color: confidenceStyle.text, 
                        padding: "0.2rem 0.5rem", 
                        borderRadius: "4px", 
                        fontSize: "0.75rem", 
                        fontWeight: "bold",
                        width: "fit-content",
                        textAlign: "center"
                    }}>
                        {evaluation.confidenceIndicator || "Neutral"}
                    </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", minWidth: "120px" }}>
                    <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", fontWeight: "bold" }}>Structure</span>
                    <span style={{ 
                        background: "rgba(138, 43, 226, 0.15)", 
                        border: "1px solid rgba(138, 43, 226, 0.3)", 
                        color: "#9b59b6", 
                        padding: "0.2rem 0.5rem", 
                        borderRadius: "4px", 
                        fontSize: "0.75rem", 
                        fontWeight: "bold",
                        width: "fit-content"
                    }}>
                        {evaluation.responseStructure || "STAR Method"}
                    </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", minWidth: "120px" }}>
                    <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", fontWeight: "bold" }}>Time Utilization</span>
                    <span style={{ 
                        background: "rgba(52, 152, 219, 0.15)", 
                        border: "1px solid rgba(52, 152, 219, 0.3)", 
                        color: "#3498db", 
                        padding: "0.2rem 0.5rem", 
                        borderRadius: "4px", 
                        fontSize: "0.75rem", 
                        fontWeight: "bold",
                        width: "fit-content"
                    }}>
                        {evaluation.timeUtilization ? `${Math.round(evaluation.timeUtilization * 100)}% speed WPM` : "Balanced"}
                    </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", flex: 1, minWidth: "200px" }}>
                    <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", fontWeight: "bold" }}>Filler Words Used</span>
                    <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.2rem" }}>
                        {evaluation.fillerWords && evaluation.fillerWords.length > 0 ? (
                            evaluation.fillerWords.map((w, idx) => (
                                <span key={idx} style={{ 
                                    background: "rgba(231, 76, 60, 0.1)", 
                                    border: "1px solid rgba(231, 76, 60, 0.25)", 
                                    color: "#e74c3c", 
                                    padding: "0.1rem 0.4rem", 
                                    borderRadius: "3px", 
                                    fontSize: "0.7rem" 
                                }}>
                                    "{w}"
                                </span>
                            ))
                        ) : (
                            <span style={{ 
                                background: "rgba(46, 204, 113, 0.1)", 
                                border: "1px solid rgba(46, 204, 113, 0.25)", 
                                color: "#2ecc71", 
                                padding: "0.1rem 0.4rem", 
                                borderRadius: "3px", 
                                fontSize: "0.7rem",
                                fontWeight: "bold"
                            }}>
                                Excellent (0 fillers)
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Depth & Script Analytics Grid */}
            <div style={{ 
                display: "grid", 
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", 
                gap: "1.5rem", 
                marginBottom: "2rem",
                background: "rgba(0,0,0,0.2)",
                border: "1px solid rgba(255,255,255,0.06)",
                padding: "1.2rem",
                borderRadius: "10px"
            }}>
                <div>
                    <h4 style={{ fontSize: "0.85rem", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginTop: 0, marginBottom: "1rem", letterSpacing: "1px" }}>
                        Technical Accuracy
                    </h4>
                    {renderProgressBar("Technical Depth Score", evaluation.technicalDepth ?? 70, (evaluation.technicalDepth ?? 70) > 75 ? "green" : "yellow")}
                    {renderProgressBar("Completeness (Model Reference)", evaluation.completeness ?? 70, (evaluation.completeness ?? 70) > 75 ? "green" : "yellow")}
                    {renderProgressBar("Relevance to Question", evaluation.relevance ?? 70, (evaluation.relevance ?? 70) > 75 ? "green" : "yellow")}
                </div>
                <div>
                    <h4 style={{ fontSize: "0.85rem", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginTop: 0, marginBottom: "1rem", letterSpacing: "1px" }}>
                        Delivery & Rhythm
                    </h4>
                    {renderProgressBar("Communication Flow Rate", evaluation.communicationFlow ?? 70, (evaluation.communicationFlow ?? 70) > 75 ? "green" : "yellow")}
                    {renderProgressBar("Grammatical Coherence", evaluation.grammarScore ?? 70, (evaluation.grammarScore ?? 70) > 75 ? "green" : "yellow")}
                    {renderProgressBar("Verbal Fluency Score", evaluation.fluencyScore ?? 70, (evaluation.fluencyScore ?? 70) > 75 ? "green" : "yellow")}
                </div>
            </div>

            {/* Strengths & Weaknesses Cards */}
            <div className="summary-bullets-grid" style={{ marginBottom: "1.5rem" }}>
                <div className="bullet-card strong">
                    <h3><i className="fi fi-rr-thumbs-up"></i> {labels.strengthsTitle}</h3>
                    <ul>
                        {evaluation.strengths && evaluation.strengths.length > 0 ? (
                            evaluation.strengths.map((s, idx) => <li key={idx}>{s}</li>)
                        ) : (
                            <li>{labels.noStrengths}</li>
                        )}
                    </ul>
                </div>
                <div className="bullet-card weak">
                    <h3><i className="fi fi-rr-thumbs-down"></i> {labels.weaknessesTitle}</h3>
                    <ul>
                        {evaluation.weaknesses && evaluation.weaknesses.length > 0 ? (
                            evaluation.weaknesses.map((w, idx) => <li key={idx}>{w}</li>)
                        ) : (
                            <li>{labels.noWeaknesses}</li>
                        )}
                    </ul>
                </div>
            </div>

            {/* Actionable Coach Advice */}
            <div className="summary-stats-box" style={{ marginTop: "1.5rem" }}>
                <h3 style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "0.5rem" }}>
                    <i className="fi fi-rr-lightbulb-on" style={{ color: "#f1c40f" }}></i> {labels.suggestionsTitle}
                </h3>
                <ul style={{ paddingLeft: "1.2rem", color: "rgba(255,255,255,0.78)", fontSize: "0.88rem", lineHeight: "1.6", margin: 0 }}>
                    {evaluation.suggestions && evaluation.suggestions.length > 0 ? (
                        evaluation.suggestions.map((s, idx) => <li key={idx} style={{ marginBottom: "0.5rem" }}>{s}</li>)
                    ) : (
                        <li>{labels.noSuggestions}</li>
                    )}
                </ul>
            </div>
        </div>
    );
});

EvaluationPanel.displayName = "EvaluationPanel";
