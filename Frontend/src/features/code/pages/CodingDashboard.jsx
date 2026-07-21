import React, { useState, useEffect } from "react";
import { Link } from "react-router";
import Navbar from "../../ats/components/Navbar";
import { fetchProgress } from "../services/code.api";
import "../style/code.scss";
import { SkeletonDashboard, EmptyState, ScrollToTop, ErrorBoundary, AnalyticsFilters } from "../../../components/ui";

const CodingDashboard = () => {
    const [stats, setStats] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState("");
    const [filters, setFilters] = useState({ dateRange: "all", role: "all", type: "all", repo: "all" });

    useEffect(() => {
        loadProgressData();
    }, []);

    const loadProgressData = async () => {
        setIsLoading(true);
        setErrorMsg("");
        try {
            const data = await fetchProgress();
            if (data.success) {
                setStats(data.stats);
            }
        } catch (err) {
            console.error("Failed to load progress stats", err);
            setErrorMsg("Could not retrieve coding analytics progress.");
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="coding-dashboard-container">
                <Navbar />
                <main style={{ padding: "2rem" }}>
                    <SkeletonDashboard />
                </main>
            </div>
        );
    }

    if (errorMsg) {
        return (
            <div className="coding-dashboard-container">
                <Navbar />
                <main style={{ padding: "3rem", textAlign: "center" }}>
                    <div style={{ background: "rgba(192, 41, 43, 0.15)", border: "1px solid #c0392b", color: "#c0392b", display: "inline-block", padding: "1.5rem 2rem", borderRadius: "8px" }}>
                        <h3>Error Loading Data</h3>
                        <p>{errorMsg}</p>
                        <button onClick={loadProgressData} style={{ background: "#d20d3b", border: "none", color: "#fff", padding: "0.5rem 1.2rem", borderRadius: "4px", cursor: "pointer", marginTop: "1rem" }}>
                            Retry
                        </button>
                    </div>
                </main>
            </div>
        );
    }

    // Default stats if none exists
    const safeStats = stats || {
        codingReadinessScore: 0,
        averageCodingScore: 0,
        strongTopics: [],
        weakTopics: [],
        difficultyDistribution: { Easy: 0, Medium: 0, Hard: 0 },
        recentAttempts: [],
        progressTracking: []
    };


    // Client-side filtering logic for recent attempts
    const filteredAttempts = (safeStats.recentAttempts || []).filter(attempt => {
        if (filters.dateRange !== "all") {
            const attemptDate = new Date(attempt.date || attempt.submittedAt || Date.now());
            const limit = new Date();
            if (filters.dateRange === "7days") limit.setDate(limit.getDate() - 7);
            else if (filters.dateRange === "30days") limit.setDate(limit.getDate() - 30);
            if (attemptDate < limit) return false;
        }
        if (filters.type !== "all" && filters.type !== "code") {
            return false;
        }
        return true;
    });

    return (
        <ErrorBoundary>
            <div className="coding-dashboard-container">
                <Navbar />

            <header className="coding-header">
                <div className="header-left">
                    <h1>Coding Performance Dashboard</h1>
                    <p>Track your technical readiness, language preps, strong/weak areas, and logical improvement timelines.</p>
                </div>
                <div className="header-right">
                    <Link to="/code" className="dash-link-btn" id="backToWorkspaceBtn">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                        Back to Editor Workspace
                    </Link>
                </div>
            </header>

            <div style={{ padding: "0 2rem" }}>
                <AnalyticsFilters onFilterChange={setFilters} />
            </div>

            <main className="dashboard-grid">
                {/* 1. Readiness Score Card */}
                <div className="stat-card micro-interactive-card" id="readinessScoreCard">
                    <h3>Coding Readiness Score</h3>
                    <div className="value" id="dashReadinessValue">{safeStats.codingReadinessScore}<span>%</span></div>
                    <div className="label">
                        {safeStats.codingReadinessScore >= 80 ? "EXCELLENT READY" : safeStats.codingReadinessScore >= 60 ? "MODERATE PRACTICE" : "PRACTICE REQUIRED"}
                    </div>
                </div>

                {/* 2. Average Score Card */}
                <div className="stat-card micro-interactive-card" id="averageScoreCard">
                    <h3>Average Attempt Score</h3>
                    <div className="value" id="dashAverageValue">{safeStats.averageCodingScore}<span>%</span></div>
                    <div className="label" style={{ background: "rgba(210, 13, 59, 0.1)", color: "#d20d3b" }}>
                        All Attempts
                    </div>
                </div>

                {/* 3. Difficulty Count Card */}
                <div className="stat-card micro-interactive-card" id="difficultyCard" style={{ alignItems: "stretch", textAlign: "left" }}>
                    <h3 style={{ textAlign: "center" }}>Difficulty Solved</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem", marginTop: "0.5rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.88rem" }}>
                            <span style={{ color: "#27ae60", fontWeight: "700" }}>Easy</span>
                            <span style={{ fontWeight: "700" }} id="easyCount">{safeStats.difficultyDistribution.Easy} solved</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.88rem" }}>
                            <span style={{ color: "#f39c12", fontWeight: "700" }}>Medium</span>
                            <span style={{ fontWeight: "700" }} id="mediumCount">{safeStats.difficultyDistribution.Medium} solved</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.88rem" }}>
                            <span style={{ color: "#c0392b", fontWeight: "700" }}>Hard</span>
                            <span style={{ fontWeight: "700" }} id="hardCount">{safeStats.difficultyDistribution.Hard} solved</span>
                        </div>
                    </div>
                </div>

                {/* 4. Strong & Weak Topics */}
                <div className="list-panel-card micro-interactive-card" id="topicsBreakdownCard">
                    <h2>Competency Area Breakdown</h2>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
                        <div>
                            <h3 style={{ fontSize: "0.85rem", color: "#27ae60", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 1rem 0" }}>
                                ✓ Strong Topics (&ge; 75%)
                            </h3>
                            <div className="topic-list-scroller" id="strongTopicsList">
                                {safeStats.strongTopics.length === 0 ? (
                                    <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.4)" }}>None logged yet.</p>
                                ) : (
                                    safeStats.strongTopics.map(t => (
                                        <div key={t.topic} className="topic-bar-item" style={{ marginBottom: "0.8rem" }}>
                                            <div className="bar-info">
                                                <span>{t.topic}</span>
                                                <span>{t.averageScore}%</span>
                                            </div>
                                            <div className="bar-track">
                                                <div className="bar-fill" style={{ width: `${t.averageScore}%` }} />
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                        <div>
                            <h3 style={{ fontSize: "0.85rem", color: "#e67e22", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 1rem 0" }}>
                                ⚠ Needs Practice (&lt; 75%)
                            </h3>
                            <div className="topic-list-scroller" id="weakTopicsList">
                                {safeStats.weakTopics.length === 0 ? (
                                    <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.4)" }}>None logged yet.</p>
                                ) : (
                                    safeStats.weakTopics.map(t => (
                                        <div key={t.topic} className="topic-bar-item" style={{ marginBottom: "0.8rem" }}>
                                            <div className="bar-info">
                                                <span>{t.topic}</span>
                                                <span>{t.averageScore}%</span>
                                            </div>
                                            <div className="bar-track">
                                                <div className="bar-fill weak" style={{ width: `${t.averageScore}%` }} />
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 5. Progress Tracking Timeline */}
                <div className="timeline-panel-card micro-interactive-card" id="timelineCard">
                    <h2>Topic Improvement Roadmap (Attempt Progressions)</h2>
                    <div className="timeline-scroller" id="progressTrackingTimeline">
                        {safeStats.progressTracking.length === 0 ? (
                            <p style={{ fontSize: "0.88rem", color: "rgba(255,255,255,0.4)", textAlign: "center", padding: "1.5rem" }}>
                                Attempt coding challenges to generate learning & score progression history.
                            </p>
                        ) : (
                            safeStats.progressTracking.map(track => (
                                <div key={track.topic} className="topic-timeline-row">
                                    <h4>{track.topic}</h4>
                                    <div className="points-flex">
                                        {track.attempts.map((att, idx) => (
                                            <React.Fragment key={idx}>
                                                <div className="point-bubble">
                                                    <span className="num">#{att.attemptNumber}</span>
                                                    <span className="score">{att.score}%</span>
                                                    <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.3)", marginLeft: "0.3rem" }}>
                                                        ({new Date(att.date).toLocaleDateString()})
                                                    </span>
                                                </div>
                                                {idx < track.attempts.length - 1 && (
                                                    <span className="arrow-connector">➔</span>
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* 6. Recent Attempts */}
                <div className="timeline-panel-card micro-interactive-card" id="recentAttemptsCard" style={{ gridColumn: "span 3" }}>
                    <h2>Recent Code Submissions History</h2>
                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }} id="recentSubmissionsTable">
                            <thead>
                                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                    <th style={{ padding: "0.8rem 1rem" }}>Question Title</th>
                                    <th style={{ padding: "0.8rem 1rem" }}>Topic</th>
                                    <th style={{ padding: "0.8rem 1rem" }}>Difficulty</th>
                                    <th style={{ padding: "0.8rem 1rem" }}>Language</th>
                                    <th style={{ padding: "0.8rem 1rem" }}>Date</th>
                                    <th style={{ padding: "0.8rem 1rem", textAlign: "right" }}>Score Achieved</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredAttempts.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" style={{ padding: "1.5rem" }}>
                                            <EmptyState
                                                icon="💻"
                                                title="No Coding Practice Submissions Yet"
                                                description="Choose a question in the editor workspace, draft a solution, and run test cases to analyze runtime performance."
                                                primaryAction={{
                                                    label: "Start Code Practice",
                                                    onClick: () => window.location.href = "/code"
                                                }}
                                            />
                                        </td>
                                    </tr>
                                ) : (
                                    filteredAttempts.map(attempt => (
                                        <tr key={attempt.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)", fontSize: "0.88rem" }}>
                                            <td style={{ padding: "0.9rem 1rem", fontWeight: "600" }}>{attempt.title}</td>
                                            <td style={{ padding: "0.9rem 1rem" }}>
                                                <span className="badge-topic">{attempt.topic}</span>
                                            </td>
                                            <td style={{ padding: "0.9rem 1rem" }}>
                                                <span className={`badge-diff ${attempt.difficulty.toLowerCase() === "easy" ? "badge-diff--easy" : attempt.difficulty.toLowerCase() === "medium" ? "badge-diff--medium" : "badge-diff--hard"}`}>
                                                    {attempt.difficulty}
                                                </span>
                                            </td>
                                            <td style={{ padding: "0.9rem 1rem", textTransform: "uppercase", fontSize: "0.8rem", color: "rgba(255,255,255,0.6)" }}>{attempt.language}</td>
                                            <td style={{ padding: "0.9rem 1rem", color: "rgba(255,255,255,0.5)" }}>
                                                {new Date(attempt.createdAt).toLocaleDateString()}
                                            </td>
                                            <td style={{ padding: "0.9rem 1rem", textAlign: "right", fontWeight: "700", color: attempt.overallScore >= 75 ? "#2ecc71" : attempt.overallScore >= 60 ? "#f1c40f" : "#e74c3c" }}>
                                                {attempt.overallScore}%
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
            <ScrollToTop />
        </div>
    </ErrorBoundary>
    );
};

export default CodingDashboard;
