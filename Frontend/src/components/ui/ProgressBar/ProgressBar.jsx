import React from "react";
import "./ProgressBar.scss";

const ProgressBar = ({ progress, status = "uploading" }) => {
    const isComplete = progress >= 100;
    
    return (
        <div className="progress-bar-container" role="progressbar" aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100">
            <div className="progress-bar-header">
                <span className="status-text">
                    {status === "uploading" && !isComplete && "Uploading file..."}
                    {status === "evaluating" && "Evaluating compatibility..."}
                    {(status === "success" || (status === "uploading" && isComplete)) && "Processing completed successfully!"}
                    {status === "error" && "Operation failed!"}
                </span>
                <span className="percentage-text">{Math.round(progress)}%</span>
            </div>
            <div className="progress-track">
                <div 
                    className={`progress-fill progress-fill--${status} ${isComplete ? "progress-fill--complete" : ""}`} 
                    style={{ width: `${progress}%` }} 
                />
            </div>
        </div>
    );
};

export default ProgressBar;
