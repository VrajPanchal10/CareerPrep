import React, { useMemo } from "react";
import Navbar from "../../ats/components/Navbar";
import { useAnalytics } from "../hooks/useAnalytics";
import { 
    AnalyticsFilters, 
    ErrorBoundary, 
    SkeletonDashboard, 
    AnalyticsSummary, 
    ComparisonCard, 
    EmptyAnalytics,
    ModuleBreakdown,
    StaticRecommendations
} from "../../../components/ui";
import "./globalAnalytics.scss";
import "../../../components/ui/AnalyticsWidgets/AnalyticsWidgets.scss";

/**
 * Global CareerPrep Analytics Dashboard Page.
 */
const GlobalAnalytics = () => {
    const { 
        loading, 
        attempts, 
        summary, 
        lastUpdated, 
        filters, 
        updateFilters, 
        exportData 
    } = useAnalytics();

    // Segment attempts for targeted comparisons
    const filteredAts = useMemo(() => attempts.filter(a => a.type === "ats"), [attempts]);
    const filteredInterviews = useMemo(() => attempts.filter(a => a.type === "interview"), [attempts]);
    const filteredCoding = useMemo(() => attempts.filter(a => a.type === "code"), [attempts]);
    const filteredVoice = useMemo(() => attempts.filter(a => a.type === "voice"), [attempts]);
    const filteredGithub = useMemo(() => attempts.filter(a => a.type === "github"), [attempts]);

    // CSV Data exporter helper
    const handleExportCsv = () => {
        const data = exportData();
        if (data.length === 0) return;
        
        try {
            const headers = Object.keys(data[0]).join(",");
            const rows = data.map(row => 
                Object.values(row).map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")
            ).join("\n");
            
            const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(headers + "\n" + rows);
            const link = document.createElement("a");
            link.setAttribute("href", csvContent);
            link.setAttribute("download", `careerprep_analytics_${new Date().toISOString().split("T")[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error("CSV Export failed:", err);
        }
    };

    if (loading) {
        return (
            <div className="global-analytics-page">
                <Navbar />
                <main style={{ padding: "2rem" }}>
                    <SkeletonDashboard />
                </main>
            </div>
        );
    }

    return (
        <div className="global-analytics-page">
            <Navbar />
            
            <main className="analytics-main-container">
                {/* Header Information Banner */}
                <header className="analytics-header-section">
                    <div className="header-details">
                        <h1>Overall Career Preparation Analytics</h1>
                        <p className="subtitle">Unified cross-module tracking for resume matching, mock interviews, and assessment trials.</p>
                        
                        <div className="metadata-row">
                            <span className="metadata-badge" aria-label="Last update timestamp">
                                🕒 Last Synced: <strong>{lastUpdated || "Just now"}</strong>
                            </span>
                            <span className="metadata-badge" aria-label="Analyzed sessions count">
                                📈 Total Evaluated Runs: <strong>{attempts.length}</strong>
                            </span>
                        </div>
                    </div>
                    
                    {attempts.length > 0 && (
                        <div className="header-actions">
                            <button 
                                onClick={handleExportCsv} 
                                className="button primary-button" 
                                style={{ margin: 0, padding: "0.6rem 1.25rem", borderRadius: "8px", background: "#10b981", color: "#ffffff", border: "none", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem", transition: "all 0.2s" }}
                                title="Download spreadsheet of metrics"
                            >
                                <svg height={"0.9rem"} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/>
                                </svg>
                                Export CSV Dataset
                            </button>
                        </div>
                    )}
                </header>

                {/* Filter Selector Panel */}
                <AnalyticsFilters onFilterChange={updateFilters} />

                {attempts.length === 0 ? (
                    <ErrorBoundary>
                        <EmptyAnalytics 
                            title="No attempt profiles aggregated matching current filters."
                            description="Review your filter criteria or start practicing by creating mock interview plan runs."
                        />
                    </ErrorBoundary>
                ) : (
                    <div className="analytics-dashboard-grid">
                        {/* Summary Metrics Row */}
                        <div className="grid-full-width">
                            <ErrorBoundary>
                                <AnalyticsSummary summary={summary} />
                            </ErrorBoundary>
                        </div>
                        
                        {/* Module Breakdown Full-Width Section */}
                        <div className="grid-full-width">
                            <ErrorBoundary>
                                <ModuleBreakdown counts={summary.moduleCounts || {}} averages={summary.moduleAverages || {}} />
                            </ErrorBoundary>
                        </div>

                        {/* Paired Row 1: ATS Resume Progression + AI Recommendations */}
                        <div className="analytics-paired-row">
                            <div className="paired-card-wrapper">
                                <ErrorBoundary>
                                    <ComparisonCard 
                                        attempts={filteredAts} 
                                        title="ATS Resume Version Progression" 
                                        actionUrl="/ats"
                                        actionText="Start ATS Analysis"
                                    />
                                </ErrorBoundary>
                            </div>
                            <div className="paired-card-wrapper">
                                <ErrorBoundary>
                                    <StaticRecommendations topWeaknesses={summary.topWeaknesses || []} />
                                </ErrorBoundary>
                            </div>
                        </div>

                        {/* Paired Row 2: AI Coach Interview Progression + Recent Evaluation Logs */}
                        <div className="analytics-paired-row">
                            <div className="paired-card-wrapper">
                                <ErrorBoundary>
                                    <ComparisonCard 
                                        attempts={filteredInterviews} 
                                        title="AI Coach Interview Progression" 
                                        actionUrl="/mock-interview"
                                        actionText="Start Mock Interview"
                                    />
                                </ErrorBoundary>
                            </div>
                            <div className="paired-card-wrapper">
                                <div className="activity-timeline-card">
                                    <div className="card-header-fixed">
                                        <h2>Recent Evaluation Logs</h2>
                                    </div>
                                    <div className="card-body-scrollable">
                                        <div className="activity-list" role="list">
                                            {attempts.map((item, idx) => (
                                                <div key={item.id || idx} className="activity-item" role="listitem">
                                                    <div className="activity-info">
                                                        <span className={`activity-badge activity-badge--${item.type}`}>
                                                            {item.type.toUpperCase()}
                                                        </span>
                                                        <div className="activity-texts">
                                                            <h3>{item.title}</h3>
                                                            <p>{item.role} • {new Date(item.date).toLocaleDateString()}</p>
                                                        </div>
                                                    </div>
                                                    <div className="activity-score">
                                                        <span className={`pill score-status--${item.overallScore >= 80 ? 'high' : item.overallScore >= 60 ? 'mid' : 'low'}`}>
                                                            {item.overallScore}%
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="card-footer-fixed">
                                        <span>Total Logs: {attempts.length}</span>
                                        <span style={{ color: '#38bdf8' }}>✓ Realtime Stream</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Bottom Full-Width Row: Coding Challenges Progression */}
                        <div className="grid-full-width">
                            <ErrorBoundary>
                                <ComparisonCard 
                                    attempts={filteredCoding} 
                                    title="Coding Challenges Performance Progression" 
                                    actionUrl="/coding"
                                    actionText="Start Coding Challenge"
                                />
                            </ErrorBoundary>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default GlobalAnalytics;
