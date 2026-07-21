import React, { useState, useEffect } from "react";
import DevLogger from "../../../utils/devLogger";
import "./DeveloperLogs.scss";

const DeveloperLogs = () => {
    const [logs, setLogs] = useState([]);
    const [isCollapsed, setIsCollapsed] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    // Completely hide in production build
    if (import.meta.env.PROD) {
        return null;
    }

    useEffect(() => {
        const unsubscribe = DevLogger.subscribe(setLogs);
        return () => unsubscribe();
    }, []);

    const handleCopy = () => {
        const text = logs
            .map(l => `[${l.timestamp}] [${l.category.toUpperCase()}]\n${l.details}`)
            .join("\n\n");
        navigator.clipboard.writeText(text);
    };

    const handleClear = () => {
        DevLogger.clear();
    };

    const filteredLogs = logs.filter(log => {
        const query = searchQuery.toLowerCase();
        return (
            log.category.toLowerCase().includes(query) ||
            log.details.toLowerCase().includes(query)
        );
    });

    return (
        <div className={`developer-logs-pane ${isCollapsed ? "collapsed" : ""}`}>
            {/* Header */}
            <div className="dev-logs-header" onClick={() => setIsCollapsed(!isCollapsed)}>
                <div className="header-left">
                    <span className="dev-icon">⚙️</span>
                    <span className="dev-title">Developer Logs Console</span>
                    <span className="dev-badge">{filteredLogs.length} events</span>
                </div>

                <div className="header-right" onClick={(e) => e.stopPropagation()}>
                    {!isCollapsed && (
                        <>
                            <input 
                                type="text"
                                className="dev-search-input"
                                placeholder="Search logs..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            <button className="dev-ctrl-btn" onClick={handleCopy} title="Copy all logs">
                                📋 Copy
                            </button>
                            <button className="dev-ctrl-btn" onClick={handleClear} title="Clear console logs">
                                🧹 Clear
                            </button>
                        </>
                    )}
                    <button 
                        className="toggle-btn" 
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        aria-expanded={!isCollapsed}
                    >
                        {isCollapsed ? "▲" : "▼"}
                    </button>
                </div>
            </div>

            {/* Main Log List */}
            {!isCollapsed && (
                <div className="dev-logs-body">
                    {filteredLogs.length === 0 ? (
                        <div className="dev-logs-empty">
                            No logs registered yet. Actions taken across dashboards will print diagnostics here.
                        </div>
                    ) : (
                        <div className="dev-logs-list">
                            {filteredLogs.map(log => (
                                <div key={log.id} className="dev-log-card">
                                    <div className="log-meta">
                                        <span className="log-timestamp">[{log.timestamp}]</span>
                                        <span className="log-cat">{log.category}</span>
                                    </div>
                                    <pre className="log-details-block">
                                        <code>{log.details}</code>
                                    </pre>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default DeveloperLogs;
