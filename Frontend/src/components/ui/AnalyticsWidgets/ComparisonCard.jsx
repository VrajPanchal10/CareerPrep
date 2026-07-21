import React from "react";
import { compareAttempts } from "../../../features/analytics/analyticsComparisons";

/**
 * Renders side-by-side attempt delta analysis, strengths progression, and resolved gaps.
 */
const ComparisonCard = ({ attempts = [], title = "Assessment Run Comparison" }) => {
    if (!attempts || attempts.length < 2) {
        return (
            <div className="comparison-card empty-comparison">
                <h3>{title}</h3>
                <p style={{ color: "rgba(255,255,255,0.4)", margin: "1rem 0" }}>
                    Compare two or more sessions to highlight score progress, strengths gained, and weaknesses resolved.
                </p>
                <div className="badge badge--warning" style={{ display: "inline-block" }}>
                    Requires at least 2 completed sessions
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
            <h3 className="comparison-card__title">{title}</h3>
            
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
                            {gainedStrengths.map((str, idx) => (
                                <li key={idx}>Verified competency in <span className="highlight">{str}</span></li>
                            ))}
                        </ul>
                    ) : (
                        <p className="no-data-text">No additional strengths added in latest practice run.</p>
                    )}
                </div>

                <div className="detail-column">
                    <h4 className="resolved-header">🛡️ Resolved Weaknesses ({resolvedWeaknesses.length})</h4>
                    {resolvedWeaknesses.length > 0 ? (
                        <ul>
                            {resolvedWeaknesses.map((weak, idx) => (
                                <li key={idx}>Corrected performance gaps in <span className="highlight">{weak}</span></li>
                            ))}
                        </ul>
                    ) : (
                        <p className="no-data-text">No critical weaknesses resolved in latest session.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ComparisonCard;
