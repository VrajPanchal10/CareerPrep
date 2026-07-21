import React from 'react';

export const ProgressBar = ({ currentQIndex, totalQuestions }) => {
    const percent = Math.round(((currentQIndex) / totalQuestions) * 100);

    return (
        <div className="session-progress-bar" style={{ marginBottom: "1.5rem" }}>
            <div className="bar-text">
                <span style={{ textTransform: "uppercase", fontWeight: "bold" }}>Questions Practice Progress</span>
                <span style={{ textTransform: "uppercase", fontWeight: "bold" }}>{currentQIndex + 1} of {totalQuestions}</span>
            </div>
            <div className="track">
                <div className="fill" style={{ width: `${percent}%` }}></div>
            </div>
        </div>
    );
};
