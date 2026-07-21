import React from "react";

/**
 * Reusable visual metric card displaying scores, ratings, and growth status.
 */
const TrendCard = ({ title, value, subtext, icon, trendDirection, trendValue }) => {
    let trendClass = "neutral";
    let trendArrow = "";

    if (trendDirection === "up") {
        trendClass = "positive";
        trendArrow = "▲";
    } else if (trendDirection === "down") {
        trendClass = "negative";
        trendArrow = "▼";
    }

    return (
        <div className="trend-card" role="region" aria-label={`${title} stats block`}>
            <div className="trend-card__header">
                <span className="trend-card__title">{title}</span>
                {icon && <span className="trend-card__icon" aria-hidden="true">{icon}</span>}
            </div>
            
            <div className="trend-card__body">
                <span className="trend-card__value">{value}</span>
                {trendValue !== undefined && (
                    <span className={`trend-card__badge trend-card__badge--${trendClass}`}>
                        {trendArrow} {trendValue}
                    </span>
                )}
            </div>

            <div className="trend-card__footer">
                <span className="trend-card__subtext">{subtext}</span>
            </div>
        </div>
    );
};

export default TrendCard;
