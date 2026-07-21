import React, { useState, useEffect } from "react";
import "./RepositoryHistory.scss";

const RepositoryHistory = ({ analyses = [], selectedAnalysisId, onSelect, onReanalyze, onDelete }) => {
    const [pinnedIds, setPinnedIds] = useState(() => {
        const saved = localStorage.getItem("careerprep_pinned_repos");
        return saved ? JSON.parse(saved) : [];
    });

    const handlePinToggle = (id, e) => {
        e.stopPropagation();
        setPinnedIds(prev => {
            const next = prev.includes(id) 
                ? prev.filter(item => item !== id) 
                : [...prev, id];
            localStorage.setItem("careerprep_pinned_repos", JSON.stringify(next));
            return next;
        });
    };

    // Sort: Pinned first, then sorted by creation date (newest first)
    const sortedAnalyses = [...analyses].sort((a, b) => {
        const aPinned = pinnedIds.includes(a._id);
        const bPinned = pinnedIds.includes(b._id);
        
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;
        
        return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return (
        <div className="repository-history-list" aria-label="Repository audit history tracking panel">
            {sortedAnalyses.length === 0 ? (
                <div className="history-empty">
                    No repositories audited yet. Submit a scan above to build history.
                </div>
            ) : (
                <ul className="history-items">
                    {sortedAnalyses.map(item => {
                        const isSelected = item._id === selectedAnalysisId;
                        const isPinned = pinnedIds.includes(item._id);

                        return (
                            <li 
                                key={item._id}
                                className={`history-item ${isSelected ? "history-item--active" : ""} ${isPinned ? "history-item--pinned" : ""}`}
                                onClick={() => onSelect(item._id)}
                                tabIndex="0"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") onSelect(item._id);
                                }}
                            >
                                <div className="history-item__header">
                                    <div className="item-title-row">
                                        <button 
                                            className={`pin-btn ${isPinned ? "pinned" : ""}`} 
                                            onClick={(e) => handlePinToggle(item._id, e)}
                                            title={isPinned ? "Unpin from top" : "Pin repository to top"}
                                            aria-label={isPinned ? "Unpin repository" : "Pin repository"}
                                        >
                                            ★
                                        </button>
                                        <h4 className="repo-name">{item.repoName}</h4>
                                    </div>
                                    <span className="repo-owner">by {item.owner}</span>
                                </div>

                                <div className="history-item__meta">
                                    <span className="date">
                                        🗓️ {new Date(item.createdAt).toLocaleDateString()}
                                    </span>
                                    {item.branch && (
                                        <span className="branch">
                                            🌿 {item.branch}
                                        </span>
                                    )}
                                </div>

                                {/* Hover action controls overlay */}
                                <div className="history-item__actions" onClick={(e) => e.stopPropagation()}>
                                    <button 
                                        className="act-btn act-btn--reanalyze"
                                        onClick={() => onReanalyze({ repoUrl: `https://github.com/${item.owner}/${item.repoName}` })}
                                        title="Trigger fresh AI repository re-audit"
                                    >
                                        🔄 Re-Audit
                                    </button>
                                    <button 
                                        className="act-btn act-btn--delete"
                                        onClick={() => onDelete(item._id)}
                                        title="Delete repository analysis history log"
                                    >
                                        🗑️ Delete
                                    </button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};

export default RepositoryHistory;
