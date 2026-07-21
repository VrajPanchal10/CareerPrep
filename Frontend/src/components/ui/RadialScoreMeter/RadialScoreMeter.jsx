import React, { useEffect, useState } from "react";
import "./RadialScoreMeter.scss";

const RadialScoreMeter = ({ score = 0, size = 120, strokeWidth = 8 }) => {
    const [animatedScore, setAnimatedScore] = useState(0);

    useEffect(() => {
        // Animate score from 0 to target on load
        const timeout = setTimeout(() => {
            setAnimatedScore(score);
        }, 150);
        return () => clearTimeout(timeout);
    }, [score]);

    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference * (1 - animatedScore / 100);

    // Color zones mapping
    let colorZoneClass = "low"; // Red
    let statusText = "Action Needed";
    if (score >= 80) {
        colorZoneClass = "high"; // Green
        statusText = "Excellent Match";
    } else if (score >= 60) {
        colorZoneClass = "mid"; // Yellow
        statusText = "Average Match";
    }

    return (
        <div 
            className="radial-score-meter-container" 
            style={{ width: size, height: size }}
            role="progressbar"
            aria-valuenow={score}
            aria-valuemin="0"
            aria-valuemax="100"
            aria-label={`Match score: ${score} percent, status: ${statusText}`}
        >
            <svg width={size} height={size} className="radial-score-meter-svg">
                {/* Background Ring */}
                <circle 
                    className="radial-meter-bg" 
                    cx={size / 2} 
                    cy={size / 2} 
                    r={radius} 
                    strokeWidth={strokeWidth} 
                />
                {/* Score Progress Ring */}
                <circle 
                    className={`radial-meter-fill stroke--${colorZoneClass}`} 
                    cx={size / 2} 
                    cy={size / 2} 
                    r={radius} 
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    style={{ transform: `rotate(-90deg)`, transformOrigin: `${size/2}px ${size/2}px` }}
                />
            </svg>
            <div className="radial-score-text">
                <span className="value">{animatedScore}</span>
                <span className="percent">%</span>
            </div>
        </div>
    );
};

export default RadialScoreMeter;
