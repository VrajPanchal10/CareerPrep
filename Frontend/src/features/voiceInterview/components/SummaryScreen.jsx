import React, { memo } from 'react';
import { useNavigate } from 'react-router';
import Navbar from '../../ats/components/Navbar';
import { ScrollToTop } from "../../../components/ui";

export const SummaryScreen = memo(({ summaryData }) => {
    const navigate = useNavigate();
    if (!summaryData) return null;

    const solvedFollowUps = summaryData.questions?.filter(q => q.isFollowUp)?.length || 0;

    return (
        <div className="voice-room-container">
            <ScrollToTop />
            <Navbar />
            
            <header className="voice-header">
                <div className="header-left">
                    <h1>Professional Interview Summary</h1>
                    <p>Detailed performance analytics, score averages, and career coach recommendation.</p>
                </div>
                <div className="header-right">
                    <button onClick={() => navigate("/voice-interview")} className="back-btn">
                        <i className="fi fi-rr-exit"></i> Exit Summary
                    </button>
                </div>
            </header>

            <main className="room-layout">
                <div className="simulator-card summary-layout">
                    <h2 style={{ fontSize: "1.3rem", fontWeight: "800", color: "#fff", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "0.5rem", margin: "0" }}>
                        🎯 Mock Performance Dashboard
                    </h2>
                    
                    <div className="summary-scores-grid">
                        <div className="score-box overall">
                            <h3>Overall Score</h3>
                            <div className="score">{summaryData.overallScore}<span>%</span></div>
                        </div>
                        <div className="score-box comm">
                            <h3>Communication</h3>
                            <div className="score">{summaryData.communicationScore}</div>
                        </div>
                        <div className="score-box tech">
                            <h3>Technical</h3>
                            <div className="score">{summaryData.technicalScore}</div>
                        </div>
                    </div>
                    
                    <div className="summary-scores-grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: "-0.5rem" }}>
                         <div className="score-box clarity">
                            <h3>Clarity</h3>
                            <div className="score">{summaryData.clarityScore}</div>
                        </div>
                        <div className="score-box expl">
                            <h3>Explanation</h3>
                            <div className="score">{summaryData.explanationScore}</div>
                        </div>
                    </div>

                    <div className="summary-stats-box">
                        <h3>Session Statistics</h3>
                        <div className="stats-flex">
                            <div className="stat-item">
                                <span className="lbl"><i className="fi fi-rr-time-fast"></i> Avg. Response Time</span>
                                <span className="val">{summaryData.averageResponseTime} seconds</span>
                            </div>
                            <div className="stat-item">
                                <span className="lbl"><i className="fi fi-rr-lightbulb-on"></i> Follow-Ups Handled</span>
                                <span className="val">{solvedFollowUps} situational deep-dives</span>
                            </div>
                            <div className="stat-item">
                                <span className="lbl"><i className="fi fi-rr-bullseye"></i> Difficulty</span>
                                <span className="val">{summaryData.difficulty}</span>
                            </div>
                        </div>
                    </div>

                    <div className="coach-card">
                        <h3><i className="fi fi-rr-magic-wand"></i> Top AI Recommendation</h3>
                        <p>"{summaryData.topRecommendation}"</p>
                    </div>
                </div>
            </main>
        </div>
    );
});

SummaryScreen.displayName = "SummaryScreen";
