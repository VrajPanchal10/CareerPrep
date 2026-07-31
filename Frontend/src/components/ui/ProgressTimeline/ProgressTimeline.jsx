import React from "react";
import "./ProgressTimeline.scss";

const STAGES = [
    { key: "connecting", label: "Connecting to GitHub API" },
    { key: "fetching", label: "Fetching Repository Metadata" },
    { key: "reading", label: "Reading Folder Structure" },
    { key: "parsing", label: "Parsing Code Files" },
    { key: "ai", label: "AI Security & Architecture Analysis" },
    { key: "report", label: "Compiling Snapshot Report" },
    { key: "completed", label: "Analysis Completed!" }
];

const ProgressTimeline = ({ 
    currentStage = "connecting", 
    filesAnalyzed = 0, 
    currentFile = "", 
    currentFolder = "",
    repoName = ""
}) => {
    const rawIndex = STAGES.findIndex(s => s.key === currentStage);
    const currentStageIndex = rawIndex >= 0 ? rawIndex : 0;
    const progressPercent = Math.min(100, Math.max(12, Math.round(((currentStageIndex + 1) / STAGES.length) * 100)));

    return (
        <div className="progress-timeline-card git-card" role="status" aria-live="polite">
            {/* Header */}
            <div className="progress-timeline-card__header">
                <div className="header-title-group">
                    <span className="pulse-icon">⚡</span>
                    <div>
                        <h3>Analyzing Repository</h3>
                        <p className="repo-target-name">{repoName || "GitHub Repository"}</p>
                    </div>
                </div>
                <div className="header-badge-group">
                    <span className="stage-indicator">
                        Stage {currentStageIndex + 1} of {STAGES.length}
                    </span>
                </div>
            </div>

            {/* Overall Progress Bar */}
            <div className="overall-progress-container">
                <div className="progress-bar-label-row">
                    <span>Overall Audit Progress</span>
                    <span className="progress-pct-val">{progressPercent}%</span>
                </div>
                <div className="progress-bar-track">
                    <div 
                        className="progress-bar-fill" 
                        style={{ width: `${progressPercent}%` }} 
                    />
                </div>
                <div className="progress-bar-footer">
                    <span>⚡ AI Analysis Engine Running...</span>
                    <span>Est. Time: ~3–5 seconds</span>
                </div>
            </div>

            {/* Steps Timeline Grid */}
            <div className="timeline-steps">
                {STAGES.map((stage, idx) => {
                    const isCompleted = idx < currentStageIndex;
                    const isActive = idx === currentStageIndex;
                    
                    let statusClass = "pending";
                    if (isCompleted) statusClass = "completed";
                    else if (isActive) statusClass = "active";

                    return (
                        <div key={stage.key} className={`timeline-step timeline-step--${statusClass}`}>
                            <div className="step-marker">
                                {isCompleted ? (
                                    <span className="check-icon">✓</span>
                                ) : isActive ? (
                                    <span className="spinner-ring" />
                                ) : (
                                    <span className="step-num">{idx + 1}</span>
                                )}
                            </div>
                            <div className="step-content">
                                <span className="step-label">{stage.label}</span>
                                {isActive && (
                                    <span className="active-badge anim-pulse">IN PROGRESS</span>
                                )}
                                {isCompleted && (
                                    <span className="completed-badge">DONE</span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Real-time file processing info panel */}
            {currentStage !== "completed" && (
                <div className="live-progress-details">
                    <div className="details-header">
                        <span>🔍 REAL-TIME AUDIT TELEMETRY</span>
                    </div>
                    <div className="details-grid">
                        <div className="details-row">
                            <span className="details-label">Audited Folder:</span>
                            <span className="details-val bold">{currentFolder || "root/"}</span>
                        </div>
                        {currentFile && (
                            <div className="details-row">
                                <span className="details-label">Reading File:</span>
                                <span className="details-val code-val">{currentFile}</span>
                            </div>
                        )}
                        <div className="details-row">
                            <span className="details-label">Parsed Elements:</span>
                            <span className="details-val bold">{filesAnalyzed} nodes mapped</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProgressTimeline;
