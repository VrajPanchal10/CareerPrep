import React from "react";
import TrendCard from "./TrendCard";

/**
 * Grid rendering a set of TrendCards representing overall preparation summaries.
 */
const AnalyticsSummary = ({ summary }) => {
    const {
        averageScore = 0,
        bestScore = 0,
        consistencyScore = 0,
        improvementTrend = 0,
        totalSessionsCount = 0
    } = summary || {};

    const trendDir = improvementTrend > 0 ? "up" : improvementTrend < 0 ? "down" : "none";
    const trendVal = improvementTrend !== 0 ? `${Math.abs(improvementTrend)}%` : undefined;

    return (
        <div className="analytics-summary-grid">
            <TrendCard 
                title="Average Performance"
                value={`${averageScore}%`}
                subtext="Overall mean accuracy score"
                icon="📊"
            />
            <TrendCard 
                title="Peak Assessment"
                value={`${bestScore}%`}
                subtext="Highest single attempt score"
                icon="🏆"
            />
            <TrendCard 
                title="Consistency Rating"
                value={`${consistencyScore}%`}
                subtext="Metric stability index"
                icon="🎯"
            />
            <TrendCard 
                title="Score Growth"
                value={improvementTrend >= 0 ? `+${improvementTrend}%` : `${improvementTrend}%`}
                subtext={`Across ${totalSessionsCount} practice runs`}
                icon="📈"
                trendDirection={trendDir}
                trendValue={trendVal}
            />
        </div>
    );
};

export default AnalyticsSummary;
