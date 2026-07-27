import React from "react";
import { Link } from "react-router";
import { compareAttempts } from "../../../features/analytics/analyticsComparisons";

/**
 * Renders side-by-side attempt delta analysis, strengths progression, and resolved gaps.
 * Uses fixed-height dashboard card architecture with scrollable internal body.
 */
const ComparisonCard = ({ attempts = [], title = "Assessment Run Comparison", actionUrl, actionText }) => {
    if (!attempts || attempts.length < 2) {
        return (
            <div className="comparison-card empty-comparison">
                <div className="card-header-fixed">
                    <h3 className="comparison-card__title">{title}</h3>
                    <p style={{ color: "rgba(255,255,255,0.45)", margin: "0", fontSize: "0.85rem" }}>
                        Compare two or more sessions to highlight score progress, strengths gained, and weaknesses resolved.
                    </p>
                </div>

                <div className="card-body-scrollable" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.75rem", padding: "1.5rem 1rem", textAlign: "center" }}>
                    <div style={{ fontSize: "2rem" }}>📈</div>
                    <div style={{ fontWeight: "600", fontSize: "0.95rem", color: "#f8fafc" }}>
                        No comparison available yet
                    </div>
                    <p style={{ fontSize: "0.825rem", color: "#94a3b8", margin: 0, maxWidth: "260px" }}>
                        Complete one more evaluation session to unlock detailed trend analysis and gap tracking.
                    </p>

                    {actionUrl && (
                        <Link 
                            to={actionUrl} 
                            className="button primary-button" 
                            style={{ 
                                marginTop: "0.5rem", 
                                padding: "0.45rem 1rem", 
                                fontSize: "0.825rem", 
                                borderRadius: "8px", 
                                background: "rgba(56, 189, 248, 0.15)", 
                                border: "1px solid rgba(56, 189, 248, 0.3)", 
                                color: "#38bdf8",
                                textDecoration: "none"
                            }}
                        >
                            {actionText || "Start Analysis"}
                        </Link>
                    )}
                </div>

                <div className="card-footer-fixed">
                    <span>Progression Engine</span>
                    <span style={{ color: '#10b981' }}>✓ Tracking Ready</span>
                </div>
            </div>
        );
    }

    const {
        initialScore,
        latestScore,
        scoreDiff,
        gainedStrengths,
        resolvedWeaknesses,
        progression,
        count
    } = compareAttempts(attempts);

    const deltaClass = scoreDiff > 0 ? "gained" : scoreDiff < 0 ? "lost" : "stable";
    const deltaSign = scoreDiff > 0 ? "+" : "";

    return (
        <div className="comparison-card" role="region" aria-label="Attempts comparison stats">
            <div className="card-header-fixed">
                <h3 className="comparison-card__title">{title}</h3>
            </div>
            
            <div className="card-body-scrollable">
                <div className="comparison-card__grid">
                    {/* Score differences block */}
                    <div className="comparison-card__scores">
                        <div className="score-block">
                            <span className="label">Initial Score</span>
                            <span className="value">{initialScore}%</span>
                        </div>
                        <div className="score-divider">➔</div>
                        <div className="score-block">
                            <span className="label">Latest Score</span>
                            <span className="value">{latestScore}%</span>
                        </div>
                        <div className={`score-delta score-delta--${deltaClass}`}>
                            <span className="label">Progress Delta</span>
                            <span className="value">{deltaSign}{scoreDiff}%</span>
                        </div>
                    </div>

                    {/* Progression attempts index */}
                    <div className="comparison-card__timeline">
                        <h4>Session Attempts Sequence ({count})</h4>
                        <div className="timeline-trail">
                            {progression.map((item, idx) => (
                                <div key={idx} className="timeline-node">
                                    <span className="node-marker">{item.attemptNum}</span>
                                    <div className="node-info">
                                        <span className="node-score">{item.score}%</span>
                                        <span className="node-date">{item.date}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Diffs: Strengths and gaps resolutions */}
                <div className="comparison-card__details">
                    <div className="detail-column">
                        <h4 className="gained-header">💪 Gained Strengths ({gainedStrengths.length})</h4>
                        {gainedStrengths.length > 0 ? (
                            <ul>
                                {gainedStrengths.map((str, i) => <li key={i}>{str}</li>)}
                            </ul>
                        ) : (
                            <p className="none-text">No new strengths logged yet.</p>
                        )}
                    </div>

                    <div className="detail-column">
                        <h4 className="resolved-header">✅ Resolved Weaknesses ({resolvedWeaknesses.length})</h4>
                        {resolvedWeaknesses.length > 0 ? (
                            <ul>
                                {resolvedWeaknesses.map((wk, i) => <li key={i}>{wk}</li>)}
                            </ul>
                        ) : (
                            <p className="none-text">No weaknesses resolved yet.</p>
                        )}
                    </div>
                </div>
            </div>

            <div className="card-footer-fixed">
                <span>Evaluated Runs: {count}</span>
                <span style={{ color: '#10b981' }}>✓ Delta Computed</span>
            </div>
        </div>
    );
};

export default ComparisonCard;
