import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router'
import Navbar from '../../ats/components/Navbar'
import { useInterview } from '../hooks/useInterview.js'
import '../style/performanceDashboard.scss'

// ── Pure SVG Radar Chart Component ──────────────────────────────────────────
const RadarChart = ({ scores = {} }) => {
    const topics = ["React", "JavaScript", "Node.js", "MongoDB", "Authentication", "Communication", "DSA"];
    const width = 360;
    const height = 300;
    const cx = width / 2;
    const cy = height / 2;
    const R = 90; // max radius
    const gridLevels = [20, 40, 60, 80, 100];
    const angleStep = (2 * Math.PI) / topics.length;

    const candidatePoints = [];
    topics.forEach((topic, i) => {
        const angle = i * angleStep - Math.PI / 2;
        // Map scores. Convert string keys in topicScores Map
        const score = scores[topic] !== undefined ? scores[topic] : 30; // fallback to baseline
        const radius = R * (score / 100);
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);
        candidatePoints.push(`${x},${y}`);
    });

    const candidatePolygon = candidatePoints.join(" ");

    return (
        <div className="radar-chart-container">
            <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="radar-chart-svg">
                {/* Grid Rings */}
                {gridLevels.map((level, idx) => {
                    const ringPoints = [];
                    topics.forEach((_, i) => {
                        const angle = i * angleStep - Math.PI / 2;
                        const r = R * (level / 100);
                        const x = cx + r * Math.cos(angle);
                        const y = cy + r * Math.sin(angle);
                        ringPoints.push(`${x},${y}`);
                    });
                    return (
                        <polygon 
                            key={idx} 
                            points={ringPoints.join(" ")} 
                            fill="none" 
                            stroke="rgba(255, 255, 255, 0.08)" 
                            strokeWidth="1" 
                        />
                    );
                })}

                {/* Axis Lines & Labels */}
                {topics.map((topic, i) => {
                    const angle = i * angleStep - Math.PI / 2;
                    const outerX = cx + R * Math.cos(angle);
                    const outerY = cy + R * Math.sin(angle);
                    const labelX = cx + (R + 24) * Math.cos(angle);
                    const labelY = cy + (R + 12) * Math.sin(angle);
                    
                    return (
                        <g key={i}>
                            <line 
                                x1={cx} 
                                y1={cy} 
                                x2={outerX} 
                                y2={outerY} 
                                stroke="rgba(255, 255, 255, 0.12)" 
                                strokeWidth="1" 
                            />
                            <text 
                                x={labelX} 
                                y={labelY} 
                                textAnchor="middle" 
                                alignmentBaseline="middle"
                                fill="rgba(255,255,255,0.6)"
                                fontSize="10"
                                fontWeight="600"
                            >
                                {topic}
                            </text>
                        </g>
                    );
                })}

                {/* Candidate Filled Area */}
                {candidatePoints.length > 0 && (
                    <polygon 
                        points={candidatePolygon} 
                        fill="rgba(210, 13, 59, 0.22)" 
                        stroke="#d20d3b" 
                        strokeWidth="2.5" 
                    />
                )}
            </svg>
        </div>
    );
};

// ── Pure SVG Progress Line Chart Component ──────────────────────────────────
const ProgressLineChart = ({ progress = [] }) => {
    if (!progress || progress.length === 0) {
        return <p className="no-progress-data">Answer mock questions to render attempts progression history.</p>;
    }

    const width = 500;
    const height = 180;
    const padding = 30;
    const points = [];
    const stepX = (width - 2 * padding) / Math.max(1, progress.length - 1);
    
    progress.forEach((snap, idx) => {
        const x = padding + idx * stepX;
        const y = height - padding - ((snap.overallScore / 100) * (height - 2 * padding));
        points.push(`${x},${y}`);
    });

    return (
        <div className="progress-chart-container">
            <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="progress-line-svg">
                {/* Horizontal Grid Bounds */}
                <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="rgba(255,255,255,0.04)" />
                <line x1={padding} y1={height/2} x2={width - padding} y2={height/2} stroke="rgba(255,255,255,0.04)" />
                <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(255,255,255,0.08)" />

                {/* Line Path */}
                <polyline 
                    fill="none" 
                    stroke="#d20d3b" 
                    strokeWidth="3.5" 
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={points.join(" ")} 
                />

                {/* Nodes & Data Text */}
                {progress.map((snap, idx) => {
                    const [x, y] = points[idx].split(",");
                    return (
                        <g key={idx}>
                            <circle cx={x} cy={y} r="5.5" fill="#ffffff" stroke="#d20d3b" strokeWidth="2.5" />
                            <text x={x} y={parseFloat(y) - 12} textAnchor="middle" fill="#ffffff" fontSize="10.5" fontWeight="700">
                                {snap.overallScore}%
                            </text>
                            <text x={x} y={height - 8} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="9">
                                Attempt {idx + 1}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};

// ── Main Dashboard Component ────────────────────────────────────────────────
const PerformanceDashboard = () => {
    const { interviewId } = useParams()
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const sessionId = searchParams.get("session")

    const { 
        report, getReportById, activeSession, loadSessionById, progressHistory, loadProgress, loading, downloadReportPdf 
    } = useInterview()

    useEffect(() => {
        const loadDashboardData = async () => {
            if (interviewId) {
                await getReportById(interviewId)
                const prog = await loadProgress(interviewId)
                
                if (sessionId) {
                    await loadSessionById(sessionId)
                } else if (prog && prog.length > 0) {
                    // Default to latest completed session
                    await loadSessionById(prog[prog.length - 1].interviewId)
                }
            }
        }
        loadDashboardData()
    }, [interviewId, sessionId])

    if (loading || !report) {
        return (
            <div className="ats-app-container">
                <Navbar />
                <main className='loading-screen-ats'>
                    <div className="spinner"></div>
                    <h1>Loading preparation stats dashboard...</h1>
                </main>
            </div>
        )
    }

    if (!activeSession) {
        return (
            <div className="ats-app-container">
                <Navbar />
                <div className="ats-dashboard-page">
                    <button className="back-btn" onClick={() => navigate(`/interview/${interviewId}`)}>
                        ⬅ Back to Preparation Plan
                    </button>
                    <div className="ats-metric-card text-center" style={{ padding: "4rem 2rem", textAlign: "center" }}>
                        <h2>No Completed Mock Practice Sessions Found</h2>
                        <p style={{ color: "rgba(255,255,255,0.5)", marginBottom: "2rem" }}>
                            You need to start and complete a mock interview practice session first to compile weakness analytics and topic heatmaps.
                        </p>
                        <button className="complete-session-btn" style={{ padding: "0.8rem 2rem" }} onClick={() => navigate(`/interview/${interviewId}`)}>
                            🎙 Start Session Now
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    const {
        overallScore = 0,
        topicScores = {},
        strongAreas = [],
        weakAreas = [],
        topicBreakdown = [],
        heatmapData = [],
        studyPlan = {}
    } = activeSession

    // Convert mongoose Map structure safely
    const normalizedTopicScores = topicScores instanceof Map 
        ? Object.fromEntries(topicScores) 
        : topicScores;

    const readinessColorClass = overallScore >= 80 ? 'high' : overallScore >= 60 ? 'mid' : 'low'

    return (
        <div className="ats-app-container">
            <Navbar />
            <div className="ats-dashboard-page">
                {/* Back Link */}
                <button className="back-btn" onClick={() => navigate(`/interview/${interviewId}`)}>
                    ⬅ Back to Preparation Plan
                </button>

                {/* Dashboard Header */}
                <header className="dashboard-header-ats" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <h1>Readiness & Weakness Analytics Dashboard</h1>
                        <p className="subtitle">Mock Interview Session Attempts analysis, Skill Radar mapping, and AI study guidelines.</p>
                    </div>
                    <button 
                        onClick={() => downloadReportPdf(interviewId)}
                        className="button primary-button"
                        style={{ margin: 0, padding: "0.6rem 1.25rem", borderRadius: "8px", background: "#10b981", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem" }}
                    >
                        <svg height={"0.9rem"} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2v9.67z"/></svg>
                        Download Report
                    </button>
                </header>

                {/* Row 1: Readiness Score & Radar Skill Graph */}
                <div className="dashboard-grid-main">
                    
                    {/* Overall Readiness Card */}
                    <div className="ats-metric-card score-panel">
                        <h2>Interview Readiness</h2>
                        <div className="score-ring-container">
                            <svg className="score-ring" viewBox="0 0 120 120">
                                <circle className="score-ring__bg" cx="60" cy="60" r="54" />
                                <circle 
                                    className={`score-ring__fill ${readinessColorClass}`} 
                                    cx="60" 
                                    cy="60" 
                                    r="54" 
                                    strokeDasharray={2 * Math.PI * 54}
                                    strokeDashoffset={2 * Math.PI * 54 * (1 - overallScore / 100)}
                                />
                            </svg>
                            <div className="score-text">
                                <span className="score-value">{overallScore}</span>
                                <span className="score-percent">%</span>
                            </div>
                        </div>
                        <p className="score-status-text">
                            {overallScore >= 80 ? "Fully Prepared for Technical Sprints!" : overallScore >= 60 ? "Moderate Performance. Practice Gaps." : "Critical Review Needed. Focus on Roadmap."}
                        </p>
                        
                        <div className="session-selection-box">
                            <label htmlFor="sessionSelect">Viewing Practice Run:</label>
                            <select 
                                id="sessionSelect"
                                value={activeSession._id}
                                onChange={(e) => navigate(`/interview/${interviewId}/dashboard?session=${e.target.value}`)}
                            >
                                {progressHistory.map((snap, idx) => (
                                    <option key={snap.interviewId} value={snap.interviewId}>
                                        Attempt #{idx + 1} ({snap.overallScore}%) - {new Date(snap.date).toLocaleDateString()}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Skill Radar Chart Card */}
                    <div className="ats-metric-card radar-panel">
                        <h2>Skills Radar Matrix</h2>
                        <RadarChart scores={normalizedTopicScores} />
                    </div>

                </div>

                {/* Row 2: Weakness Heatmap Grid */}
                <div className="ats-metric-card heatmap-card">
                    <div className="heatmap-header">
                        <h2>Topic weakness Heatmap</h2>
                        <div className="heatmap-legend">
                            <span className="legend-item strong">Strong (80+)</span>
                            <span className="legend-item moderate">Moderate (60-79)</span>
                            <span className="legend-item weak">Weak (40-59)</span>
                            <span className="legend-item critical">Critical (&lt;40)</span>
                        </div>
                    </div>

                    <div className="heatmap-grid">
                        {heatmapData.length > 0 ? (
                            heatmapData.map((item, idx) => (
                                <div key={idx} className={`heatmap-item status--${item.status}`}>
                                    <span className="keyword-name">{item.topic}</span>
                                    <span className="keyword-score">{item.score}%</span>
                                </div>
                            ))
                        ) : (
                            <p className="no-keywords">No heatmap scores aggregated yet.</p>
                        )}
                    </div>
                </div>

                {/* Row 3: Breakdown Table & Progress History */}
                <div className="dashboard-grid-main">
                    
                    {/* Breakdown Table */}
                    <div className="ats-metric-card breakdown-table-card">
                        <h2>Topic Performance Logs</h2>
                        <table className="breakdown-table">
                            <thead>
                                <tr>
                                    <th>Topic Category</th>
                                    <th>Questions Attempted</th>
                                    <th>Average Rating Score</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topicBreakdown.map((row, idx) => (
                                    <tr key={idx}>
                                        <td className="bold">{row.topic}</td>
                                        <td>{row.questionsAttempted}</td>
                                        <td>
                                            <span className={`pill status--${row.averageScore >= 80 ? 'matched' : row.averageScore >= 60 ? 'extra' : 'missing'}`}>
                                                {row.averageScore}%
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Progress Chart */}
                    <div className="ats-metric-card progress-chart-card">
                        <h2>Session Score Growth path</h2>
                        <ProgressLineChart progress={progressHistory} />
                    </div>

                </div>

                {/* Row 4: Strong Areas vs. Weak Areas */}
                <div className="dashboard-grid-main">
                    <div className="ats-metric-card strengths-card">
                        <h2>Strong Areas</h2>
                        <ul className="points-list checkmark">
                            {strongAreas.length > 0 ? (
                                strongAreas.map((topic, idx) => (
                                    <li key={idx}><strong>{topic}</strong>: Consistently high answering efficiency and concept accuracy</li>
                                ))
                            ) : (
                                <li>No clear strong areas identified yet. Practice more questions to list.</li>
                            )}
                        </ul>
                    </div>

                    <div className="ats-metric-card weaknesses-card">
                        <h2>Areas Needing Review</h2>
                        <ul className="points-list warning">
                            {weakAreas.length > 0 ? (
                                weakAreas.map((topic, idx) => (
                                    <li key={idx}><strong>{topic}</strong>: Needs review on technical definitions and details</li>
                                ))
                            ) : (
                                <li>No major review gaps identified. Excellent match work!</li>
                            )}
                        </ul>
                    </div>
                </div>

                {/* Row 5: Study Roadmap & Recommendations */}
                <div className="ats-metric-card study-roadmap-card">
                    <h2>Personalized Study Roadmap</h2>
                    
                    {studyPlan.recommendedTopics && studyPlan.recommendedTopics.length > 0 ? (
                        <div className="study-plan-details">
                            <div className="study-topics-list">
                                <h3>🎯 Recommended Topics to Prioritize:</h3>
                                <div className="skills-badge-flex">
                                    {studyPlan.recommendedTopics.map((topic, idx) => (
                                        <span key={idx} className="topic-suggest-badge">{topic}</span>
                                    ))}
                                </div>
                            </div>

                            <div className="improvement-roadmap-steps">
                                <h3>📈 Optimization Roadmap Path:</h3>
                                {studyPlan.improvementRoadmap && studyPlan.improvementRoadmap.map((road, idx) => (
                                    <div key={idx} className="roadmap-topic-step">
                                        <h4>{road.topic} (Target Score: {road.targetScore}%)</h4>
                                        <ul>
                                            {road.steps.map((step, sIdx) => (
                                                <li key={sIdx}>{step}</li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <p style={{ color: "rgba(255,255,255,0.5)" }}>You have met acceptable readiness thresholds across all topic areas. Complete additional runs to test limits!</p>
                    )}
                </div>

            </div>
        </div>
    )
}

export default PerformanceDashboard
