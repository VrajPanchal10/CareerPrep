import React from "react";
import "./ModuleBreakdown.scss";

const ModuleBreakdown = ({ counts, averages }) => {
    const modules = [
        { key: "ats", label: "ATS Resume Audits", icon: "📄" },
        { key: "interview", label: "Mock Interviews", icon: "🎯" },
        { key: "voice", label: "Verbal Sessions", icon: "🎙️" },
        { key: "github", label: "Project Defenses", icon: "🛡️" }
    ];

    return (
        <div className="module-breakdown-card">
            <h3>Module Breakdown</h3>
            <p className="subtitle">Historical performance across different exercise types.</p>
            
            <div className="module-list">
                {modules.map(mod => {
                    const count = counts[mod.key] || 0;
                    const avg = averages[mod.key] || 0;
                    
                    return (
                        <div key={mod.key} className="module-item">
                            <div className="module-header">
                                <span className="module-title">{mod.icon} {mod.label}</span>
                                <span className="module-stats">{count} runs &bull; avg: {avg}%</span>
                            </div>
                            <div className="progress-bar-bg">
                                <div 
                                    className="progress-bar-fill" 
                                    style={{ 
                                        width: `${avg}%`,
                                        backgroundColor: avg >= 80 ? "#10b981" : avg >= 50 ? "#f59e0b" : "#ef4444"
                                    }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ModuleBreakdown;
