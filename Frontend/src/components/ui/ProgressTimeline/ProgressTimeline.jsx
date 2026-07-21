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

const ProgressTimeline = ({ currentStage = "connecting", filesAnalyzed = 0, currentFile = "", currentFolder = "" }) => {
    const currentStageIndex = STAGES.findIndex(s => s.key === currentStage);

    return (
        <div className="progress-timeline-card" role="status" aria-live="polite">
            <div className="progress-timeline-card__header">
                <h3>Repo Analysis Status Timeline</h3>
                <span className="stage-indicator">
                    Stage {currentStageIndex + 1} of {STAGES.length}
                </span>
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
                                {isCompleted ? "✓" : idx + 1}
                            </div>
                            <div className="step-content">
                                <span className="step-label">{stage.label}</span>
                                {isActive && (
                                    <span className="active-badge anim-pulse">ACTIVE</span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Real-time file processing info panel */}
            {currentStage !== "completed" && (
                <div className="live-progress-details">
                    <div className="details-row">
                        <span className="details-label">Audited Folders:</span>
                        <span className="details-val bold">{currentFolder || "root/"}</span>
                    </div>
                    {currentFile && (
                        <div className="details-row">
                            <span className="details-label">Reading File:</span>
                            <span className="details-val code-val">{currentFile}</span>
                        </div>
                    )}
                    <div className="details-row">
                        <span className="details-label">Parsed Nodes:</span>
                        <span className="details-val bold">{filesAnalyzed} elements mapped</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProgressTimeline;
