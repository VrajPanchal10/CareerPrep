import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import Navbar from "../../ats/components/Navbar";
import { getAllInterviewReports } from "../../interview/services/interview.api";
import { startVoiceSession, fetchVoiceProgress } from "../services/voice.api";
import "../style/voice.scss";
import { useToast, SkeletonDashboard, EmptyState, ScrollToTop, ErrorBoundary, LoadingButton, AnalyticsFilters, RadialScoreMeter } from "../../../components/ui";

const VoiceDashboard = () => {
    const [reports, setReports] = useState([]);
    const [stats, setStats] = useState(null);
    const [selectedReportId, setSelectedReportId] = useState("");
    const [difficulty, setDifficulty] = useState("Easy");
    const [enableFollowUps, setEnableFollowUps] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isStarting, setIsStarting] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [filters, setFilters] = useState({ dateRange: "all", role: "all", type: "all", repo: "all" });
    const { addToast } = useToast();

    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const reportIdParam = searchParams.get("reportId");

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        setIsLoading(true);
        setErrorMsg("");
        try {
            // Load interview plans
            const reportsData = await getAllInterviewReports();
            const reportsList = reportsData.interviewReports || [];
            setReports(reportsList);

            // Set default selected report from query params or first in list
            if (reportIdParam) {
                setSelectedReportId(reportIdParam);
            } else if (reportsList.length > 0) {
                setSelectedReportId(reportsList[0]._id);
            }

            // Load progress stats
            const statsData = await fetchVoiceProgress();
            if (statsData.success) {
                setStats(statsData.stats);
            }
        } catch (err) {
            console.error("Error loading voice dashboard:", err);
            setErrorMsg("Failed to retrieve dashboard analytics. Please retry.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleStartSession = async (e) => {
        e.preventDefault();
        if (!selectedReportId) {
            addToast("Please select or generate an interview plan first.", "warning");
            return;
        }

        setIsStarting(true);
        setErrorMsg("");
        try {
            const data = await startVoiceSession({
                interviewReportId: selectedReportId,
                difficulty,
                enableFollowUps
            });
            if (data.success) {
                addToast("Verbal practice session initialized!", "success");
                navigate(`/voice-interview/room/${data.session._id}`);
            }
        } catch (err) {
            console.error("Failed to start voice session", err);
            setErrorMsg(err.response?.data?.message || "Failed to initialize mock session.");
            addToast("Failed to initialize verbal practice run.", "error");
        } finally {
            setIsStarting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="voice-dashboard-container">
                <Navbar />
                <main style={{ padding: "2rem" }}>
                    <SkeletonDashboard />
                </main>
            </div>
        );
    }

    const safeStats = stats || {
        voiceReadinessScore: 0,
        averageVoiceScore: 0,
        averageCommunicationScore: 0,
        averageTechnicalScore: 0,
        recentSessions: [],
        trends: []
    };


    // Client-side filtering logic for recent sessions
    const filteredSessions = (safeStats.recentSessions || []).filter(session => {
        if (filters.dateRange !== "all") {
            const sessDate = new Date(session.date || session.completedAt || Date.now());
            const limit = new Date();
            if (filters.dateRange === "7days") limit.setDate(limit.getDate() - 7);
            else if (filters.dateRange === "30days") limit.setDate(limit.getDate() - 30);
            if (sessDate < limit) return false;
        }
        if (filters.type !== "all" && filters.type !== "voice") {
            return false;
        }
        return true;
    });

    return (
        <ErrorBoundary>
            <div className="voice-dashboard-container">
                <Navbar />

            <header className="voice-header">
                <div className="header-left">
                    <h1>Voice-to-Voice Interview Coach</h1>
                    <p>Practice speaking answers aloud in a simulation room and receive real-time clarity and delivery metrics.</p>
                </div>
                <div className="header-right">
                    <Link to="/" className="back-btn" id="backToCoachBtn">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                        Exit Voice Coach
                    </Link>
                </div>
            </header>

            <div style={{ padding: "0 2rem" }}>
                <AnalyticsFilters onFilterChange={setFilters} />
            </div>

            {errorMsg && (
                <div style={{ background: "rgba(192, 41, 43, 0.15)", border: "1px solid #c0392b", color: "#c0392b", margin: "1.5rem 2rem 0", padding: "0.75rem 1.2rem", borderRadius: "6px", fontSize: "0.88rem" }}>
                    <strong>Error:</strong> {errorMsg}
                </div>
            )}

            <main className="voice-grid">
                {/* 1. Setup Panel Card */}
                <div className="voice-card micro-interactive-card">
                    <h2>Mock Session Setup</h2>
                    <form className="setup-form" onSubmit={handleStartSession}>
                        <div className="form-group">
                            <label htmlFor="reportSelect">1. Target Position Plan</label>
                            {reports.length === 0 ? (
                                <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.4)", padding: "0.5rem 0" }}>
                                    No interview plans found. Create an interview plan first under the 
                                    <Link to="/" style={{ color: "#d20d3b", textDecoration: "none", marginLeft: "0.3rem", fontWeight: "600" }}>Interview Coach</Link> page.
                                </div>
                            ) : (
                                <select
                                    id="reportSelect"
                                    value={selectedReportId}
                                    onChange={(e) => setSelectedReportId(e.target.value)}
                                    required
                                >
                                    {reports.map(r => (
                                        <option key={r._id} value={r._id}>{r.title}</option>
                                    ))}
                                </select>
                            )}
                        </div>

                        <div className="form-group">
                            <label htmlFor="difficultySelect">2. Session Difficulty</label>
                            <select
                                id="difficultySelect"
                                value={difficulty}
                                onChange={(e) => setDifficulty(e.target.value)}
                            >
                                <option value="Easy">Easy (Conversational, fundamental questions)</option>
                                <option value="Medium">Medium (Technical review, scenario questions)</option>
                                <option value="Hard">Hard (Deep dive, case study challenges)</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>3. Contextual Follow-Ups</label>
                            <label className="form-toggle" id="followUpsToggleLabel">
                                <input
                                    type="checkbox"
                                    checked={enableFollowUps}
                                    onChange={(e) => setEnableFollowUps(e.target.checked)}
                                    id="followUpsToggle"
                                />
                                <span>Enable AI Contextual Follow-Up Questions</span>
                            </label>
                            <p style={{ margin: "0", fontSize: "0.78rem", color: "rgba(255,255,255,0.4)", lineHeight: "1.4" }}>
                                Generates contextual questions based on your verbal transcript (depth-limited to 1 to prevent fatigue).
                            </p>
                        </div>

                        <LoadingButton
                            type="submit"
                            loading={isStarting}
                            loadingText="Initializing..."
                            className="start-session-btn"
                            disabled={reports.length === 0}
                            id="startVoiceSessionBtn"
                        >
                            🎙️ Start Verbal Mock Session
                        </LoadingButton>
                    </form>
                </div>

                {/* 2. Stats and Gauges Card */}
                <div className="voice-card voice-card--span-2 micro-interactive-card hover-card">
                    <h2>Verbal mock metrics</h2>
                    <div className="gauges-row">
                        <div className="gauge-item readiness" id="voiceReadinessGauge">
                            <h3>Voice Readiness Score</h3>
                            <div className="radial-container" style={{ display: "flex", justifyContent: "center", margin: "1rem 0" }}>
                                <RadialScoreMeter score={safeStats.voiceReadinessScore} size={120} strokeWidth={8} />
                            </div>
                            <div className="badge-sub">
                                {safeStats.voiceReadinessScore >= 80 ? "EXCELLENT READY" : safeStats.voiceReadinessScore >= 60 ? "PRACTICED" : "PRACTICE REQUIRED"}
                            </div>
                        </div>

                        <div className="gauge-item" id="voiceCommGauge">
                            <h3>Avg Communication</h3>
                            <div className="radial-container">
                                <svg width="120" height="120">
                                    <circle className="track" cx="60" cy="60" r="55" />
                                    <circle 
                                        className="fill" 
                                        cx="60" 
                                        cy="60" 
                                        r="55" 
                                        strokeDashoffset={345 - (345 * safeStats.averageCommunicationScore) / 100}
                                        style={{ stroke: "#f1c40f" }}
                                    />
                                </svg>
                                <div className="value-text">{safeStats.averageCommunicationScore}%</div>
                            </div>
                            <div className="badge-sub">Expression Flow</div>
                        </div>

                        <div className="gauge-item" id="voiceTechGauge">
                            <h3>Avg Technical</h3>
                            <div className="radial-container">
                                <svg width="120" height="120">
                                    <circle className="track" cx="60" cy="60" r="55" />
                                    <circle 
                                        className="fill" 
                                        cx="60" 
                                        cy="60" 
                                        r="55" 
                                        strokeDashoffset={345 - (345 * safeStats.averageTechnicalScore) / 100}
                                        style={{ stroke: "#2ecc71" }}
                                    />
                                </svg>
                                <div className="value-text">{safeStats.averageTechnicalScore}%</div>
                            </div>
                            <div className="badge-sub">Accuracy Score</div>
                        </div>
                    </div>
                </div>

                {/* 3. Trends and Progress Card */}
                <div className="voice-card micro-interactive-card">
                    <h2>Improvement trends</h2>
                    <div className="trend-timeline" id="voiceTrendsTimeline">
                        {safeStats.trends.length === 0 ? (
                            <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.4)", textAlign: "center", padding: "2rem 0" }}>
                                Complete verbal sessions to trace historical trends.
                            </p>
                        ) : (
                            safeStats.trends.map((t, idx) => (
                                <div key={idx} className="trend-row">
                                    <div className="row-header">
                                        <h4>Verbal Mock Session #{t.sessionNumber}</h4>
                                        <span>{new Date(t.date).toLocaleDateString()}</span>
                                    </div>
                                    <div className="metrics-flex">
                                        <div className="metric-point">
                                            <span className="lbl">Overall</span>
                                            <span className="val">{t.overallScore}%</span>
                                        </div>
                                        <div className="metric-point">
                                            <span className="lbl">Comm</span>
                                            <span className="val comm">{t.communicationScore}%</span>
                                        </div>
                                        <div className="metric-point">
                                            <span className="lbl">Tech</span>
                                            <span className="val tech">{t.technicalScore}%</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* 4. Recent Session Attempts List */}
                <div className="voice-card voice-card--span-2 micro-interactive-card">
                    <h2>Recent Sessions Logs</h2>
                    <div style={{ overflowX: "auto" }} id="recentVoiceSessionsTableContainer">
                        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }} id="recentVoiceSessionsTable">
                            <thead>
                                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                    <th style={{ padding: "0.8rem" }}>Plan Title</th>
                                    <th style={{ padding: "0.8rem" }}>Difficulty</th>
                                    <th style={{ padding: "0.8rem" }}>Date</th>
                                    <th style={{ padding: "0.8rem" }}>Response Time</th>
                                    <th style={{ padding: "0.8rem", textAlign: "right" }}>Score</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSessions.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" style={{ padding: "1.5rem" }}>
                                            <EmptyState
                                                icon="🎙️"
                                                title="No Voice Session Logs"
                                                description="Begin a voice-to-voice interview setup. Once completed, your average communication flow and accuracy will be analyzed here."
                                                primaryAction={{
                                                    label: "Begin Interview Setup",
                                                    onClick: () => {
                                                        document.getElementById("reportSelect")?.focus();
                                                    }
                                                }}
                                            />
                                        </td>
                                    </tr>
                                 ) : (
                                    filteredSessions.map(session => (
                                        <tr key={session.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)", fontSize: "0.88rem" }}>
                                            <td style={{ padding: "0.9rem 0.8rem", fontWeight: "600" }}>{session.reportTitle}</td>
                                            <td style={{ padding: "0.9rem 0.8rem" }}>
                                                <span className={`badge-diff ${session.difficulty.toLowerCase() === "easy" ? "badge-diff--easy" : session.difficulty.toLowerCase() === "medium" ? "badge-diff--medium" : "badge-diff--hard"}`}>
                                                    {session.difficulty}
                                                </span>
                                            </td>
                                            <td style={{ padding: "0.9rem 0.8rem", color: "rgba(255,255,255,0.5)" }}>
                                                {new Date(session.completedAt).toLocaleDateString()}
                                            </td>
                                            <td style={{ padding: "0.9rem 0.8rem" }}>{session.averageResponseTime}s / q</td>
                                            <td style={{ padding: "0.9rem 0.8rem", textAlign: "right", fontWeight: "700", color: session.overallScore >= 75 ? "#2ecc71" : session.overallScore >= 60 ? "#f1c40f" : "#e74c3c" }}>
                                                {session.overallScore}%
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

export default VoiceDashboard;
