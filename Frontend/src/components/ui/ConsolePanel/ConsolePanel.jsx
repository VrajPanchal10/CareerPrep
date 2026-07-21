import React, { useState, useEffect, useRef } from "react";
import "./ConsolePanel.scss";

const ConsolePanel = ({ logs = [], onClear, isCollapsed, onToggleCollapse }) => {
    const [filter, setFilter] = useState("all"); // all, error, warning, info
    const [heightMode, setHeightMode] = useState("medium"); // short (150px), medium (250px), tall (400px)
    const logsEndRef = useRef(null);

    // Auto-scroll to bottom of console when new logs are added
    useEffect(() => {
        if (logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [logs, isCollapsed]);

    const handleCopyLogs = () => {
        const text = logs
            .map(l => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.message}`)
            .join("\n");
        navigator.clipboard.writeText(text);
    };

    const handleDownloadLogs = () => {
        const text = logs
            .map(l => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.message}`)
            .join("\n");
        const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `careerprep_console_logs_${Date.now()}.txt`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const filteredLogs = logs.filter(l => {
        if (filter === "all") return true;
        return l.type === filter;
    });

    const heightStyle = isCollapsed 
        ? "42px" 
        : heightMode === "short" 
            ? "150px" 
            : heightMode === "medium" 
                ? "250px" 
                : "400px";

    return (
        <div 
            className={`console-panel ${isCollapsed ? "collapsed" : ""}`} 
            style={{ height: heightStyle }}
            role="log"
            aria-live="polite"
        >
            {/* Header */}
            <div className="console-panel__header" onClick={onToggleCollapse}>
                <div className="header-left">
                    <span className="console-icon">💻</span>
                    <span className="console-title">Console Output</span>
                    <span className="console-badge">{filteredLogs.length} logs</span>
                </div>

                <div className="header-right" onClick={(e) => e.stopPropagation()}>
                    {!isCollapsed && (
                        <>
                            {/* Height selection */}
                            <div className="height-controls">
                                <button 
                                    className={`size-btn ${heightMode === "short" ? "active" : ""}`}
                                    onClick={() => setHeightMode("short")}
                                    title="Short height"
                                >
                                    S
                                </button>
                                <button 
                                    className={`size-btn ${heightMode === "medium" ? "active" : ""}`}
                                    onClick={() => setHeightMode("medium")}
                                    title="M"
                                >
                                    M
                                </button>
                                <button 
                                    className={`size-btn ${heightMode === "tall" ? "active" : ""}`}
                                    onClick={() => setHeightMode("tall")}
                                    title="Tall height"
                                >
                                    L
                                </button>
                            </div>

                            {/* Copy/Download/Clear */}
                            <button className="ctrl-btn" onClick={handleCopyLogs} title="Copy All Logs">
                                📋 Copy
                            </button>
                            <button className="ctrl-btn" onClick={handleDownloadLogs} title="Download Logs">
                                💾 Save
                            </button>
                            <button className="ctrl-btn" onClick={onClear} title="Clear Console">
                                🧹 Clear
                            </button>
                        </>
                    )}
                    <button 
                        className="toggle-btn" 
                        onClick={onToggleCollapse}
                        aria-expanded={!isCollapsed}
                        title={isCollapsed ? "Expand Console" : "Collapse Console"}
                    >
                        {isCollapsed ? "▲" : "▼"}
                    </button>
                </div>
            </div>

            {/* Main console content */}
            {!isCollapsed && (
                <div className="console-panel__body">
                    {/* Filters Bar */}
                    <div className="console-filters">
                        <button className={`filter-btn ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>All</button>
                        <button className={`filter-btn ${filter === "info" ? "active" : ""}`} onClick={() => setFilter("info")}>Info</button>
                        <button className={`filter-btn ${filter === "success" ? "active" : ""}`} onClick={() => setFilter("success")}>Success</button>
                        <button className={`filter-btn ${filter === "warning" ? "active" : ""}`} onClick={() => setFilter("warning")}>Warning</button>
                        <button className={`filter-btn ${filter === "error" ? "active" : ""}`} onClick={() => setFilter("error")}>Error</button>
                    </div>

                    {/* Output log entries */}
                    <div className="console-logs">
                        {filteredLogs.length === 0 ? (
                            <div className="console-empty">No console entries to display. Run code to log output.</div>
                        ) : (
                            filteredLogs.map((log, index) => (
                                <div key={index} className={`log-entry log-entry--${log.type}`}>
                                    <span className="log-timestamp">[{log.timestamp}]</span>
                                    <span className="log-badge">{log.type.toUpperCase()}</span>
                                    <span className="log-message">{log.message}</span>
                                </div>
                            ))
                        )}
                        <div ref={logsEndRef} />
                    </div>
                </div>
            )}
        </div>
    );
};

export default ConsolePanel;
