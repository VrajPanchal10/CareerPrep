import React from "react";
import Tooltip from "../Tooltip/Tooltip";
import "./KeywordBadge.scss";

const KeywordBadge = ({ keyword, score, status, description, onClick }) => {
    let explanation = description;
    if (!explanation) {
        if (status === "matched") {
            explanation = `"${keyword}" matches the job description (${score}% density). Click to locate this keyword in your resume.`;
        } else if (status === "missing") {
            explanation = `"${keyword}" is missing from your resume. We highly recommend adding this key term to optimize your match score.`;
        } else {
            explanation = `"${keyword}" is considered "extra" because it appears on your resume but is not listed as a core requirement. Click to locate this keyword.`;
        }
    }

    const tooltipContent = (
        <div className="keyword-tooltip">
            <span className="keyword-tooltip__title">
                <span className={`status-indicator status-indicator--${status}`} />
                {status.toUpperCase()} KEYWORD
            </span>
            <p className="keyword-tooltip__desc">{explanation}</p>
        </div>
    );

    return (
        <Tooltip content={tooltipContent} position="top">
            <div 
                className={`keyword-badge status--${status} ${onClick ? 'keyword-badge--clickable' : ''}`} 
                onClick={onClick}
                tabIndex="0" 
                aria-label={`${keyword} - ${status} keyword`}
                style={onClick ? { cursor: "pointer" } : {}}
            >
                <span className="keyword-badge__name">{keyword}</span>
                {score !== undefined && <span className="keyword-badge__score">{score}%</span>}
            </div>
        </Tooltip>
    );
};

export default KeywordBadge;
