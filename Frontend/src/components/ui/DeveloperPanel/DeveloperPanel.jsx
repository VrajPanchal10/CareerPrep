import React from "react";
import "./DeveloperPanel.scss";

/**
 * DeveloperPanel Component
 * Displays system-level diagnostics and warnings only during local development.
 * Automatically hidden in production builds.
 */
const DeveloperPanel = ({ title = "Developer Diagnostics", data = {}, warnings = [] }) => {
    // Hide panel completely in production
    if (!import.meta.env.DEV) return null;

    const dataEntries = Object.entries(data);

    return (
        <div className="developer-panel" aria-label="Development Debug Console">
            <div className="developer-panel__header">
                <span className="terminal-dot red" />
                <span className="terminal-dot yellow" />
                <span className="terminal-dot green" />
                <h4 className="developer-panel__title">💻 {title} [DEV MODE ONLY]</h4>
            </div>
            
            <div className="developer-panel__body">
                {dataEntries.length > 0 && (
                    <div className="metrics-grid">
                        {dataEntries.map(([key, value]) => (
                            <div key={key} className="metric-row">
                                <span className="metric-key">{key}:</span>
                                <span className="metric-val">{value}</span>
                            </div>
                        ))}
                    </div>
                )}

                {warnings && warnings.length > 0 && (
                    <div className="warnings-section">
                        <div className="warnings-header">⚠️ Quality Warnings Detected:</div>
                        <ul className="warnings-list">
                            {warnings.map((warn, index) => (
                                <li key={index} className="warning-item">
                                    • {warn}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DeveloperPanel;
