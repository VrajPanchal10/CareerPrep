import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import Navbar from "../../ats/components/Navbar";
import { useGithubDefense } from "../hooks/useGithubDefense";
import "../style/githubDashboard.scss";

const GithubInterviewRoom = () => {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const {
        loading,
        error,
        activeSession,
        loadSession,
        submitAnswer,
        completeInterview
    } = useGithubDefense();

    const [userAnswer, setUserAnswer] = useState("");
    const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [showScorecard, setShowScorecard] = useState(false);
    const [finalResult, setFinalResult] = useState(null);
    const terminalEndRef = useRef(null);

    useEffect(() => {
        if (sessionId) {
            loadSession(sessionId);
        }
    }, [sessionId, loadSession]);

    // Scroll chat window to bottom on new updates
    useEffect(() => {
        terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [activeSession]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!userAnswer.trim() || submitting || !activeSession) return;
        
        setSubmitting(true);
        try {
            await submitAnswer({
                sessionId: activeSession._id,
                questionIndex: activeQuestionIdx,
                userAnswer: userAnswer.trim()
            });
            setUserAnswer("");
        } catch (err) {
            // Error managed in hook
        } finally {
            setSubmitting(false);
        }
    };

    const handleNext = () => {
        if (!activeSession) return;
        if (activeQuestionIdx < activeSession.questions.length - 1) {
            setActiveQuestionIdx(activeQuestionIdx + 1);
        }
    };

    const handlePrev = () => {
        if (activeQuestionIdx > 0) {
            setActiveQuestionIdx(activeQuestionIdx - 1);
        }
    };

    const handleComplete = async () => {
        if (!activeSession) return;
        try {
            const result = await completeInterview(activeSession._id);
            setFinalResult(result);
            setShowScorecard(true);
        } catch (err) {
            // Error managed in hook
        }
    };

    if (loading && !activeSession) {
        return (
            <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", justifyContent: "center", alignItems: "center", color: "#ffffff" }}>
                <h2>Initializing Defense Terminal...</h2>
            </div>
        );
    }

    if (!activeSession) {
        return (
            <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", justifyContent: "center", alignItems: "center", color: "#ffffff" }}>
                <h2>No Session Found</h2>
            </div>
        );
    }

    const currentQuestion = activeSession.questions[activeQuestionIdx];
    const existingAnswer = activeSession.answers.find(a => a.questionIndex === activeQuestionIdx);
    const isCompleted = activeSession.status === "completed";

    // Count answered main questions
    const answeredCount = activeSession.answers.length;
    const totalCount = activeSession.questions.length;

    if (showScorecard && finalResult) {
        return (
            <div style={{ minHeight: "100vh", background: "#0a0a0a" }}>
                <Navbar />
                <main className="git-dashboard-page" style={{ maxWidth: "800px" }}>
                    <header className="git-header">
                        <h1>🏆 Project Defense <span className="highlight">Complete</span></h1>
                        <p>Review your Project Knowledge metrics and feedback scorecard below.</p>
                    </header>

                    <div className="git-card git-card__highlight" style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "1.5rem" }}>
                            <div>
                                <h2 style={{ margin: 0 }}>{finalResult.repoName}</h2>
                                <span style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.4)" }}>Final Evaluation Report</span>
                            </div>
                            <div style={{ fontSize: "2.5rem", fontWeight: "800", color: "#2ecc71" }}>
                                {finalResult.scores.overallMasteryScore}%
                            </div>
                        </div>

                        <div className="scores-grid">
                            <div className="score-bar-card">
                                <span className="score-title">Architecture</span>
                                <span className="score-value">{finalResult.scores.architectureScore}%</span>
                                <div className="bar-track">
                                    <div className="bar-fill" style={{ width: `${finalResult.scores.architectureScore}%` }}></div>
                                </div>
                            </div>
                            <div className="score-bar-card">
                                <span className="score-title">Security</span>
                                <span className="score-value">{finalResult.scores.securityScore}%</span>
                                <div className="bar-track">
                                    <div className="bar-fill" style={{ width: `${finalResult.scores.securityScore}%` }}></div>
                                </div>
                            </div>
                            <div className="score-bar-card">
                                <span className="score-title">Database</span>
                                <span className="score-value">{finalResult.scores.databaseScore}%</span>
                                <div className="bar-track">
                                    <div className="bar-fill" style={{ width: `${finalResult.scores.databaseScore}%` }}></div>
                                </div>
                            </div>
                            <div className="score-bar-card">
                                <span className="score-title">API Design</span>
                                <span className="score-value">{finalResult.scores.apiDesignScore}%</span>
                                <div className="bar-track">
                                    <div className="bar-fill" style={{ width: `${finalResult.scores.apiDesignScore}%` }}></div>
                                </div>
                            </div>
                            <div className="score-bar-card">
                                <span className="score-title">Deployment</span>
                                <span className="score-value">{finalResult.scores.deploymentScore}%</span>
                                <div className="bar-track">
                                    <div className="bar-fill" style={{ width: `${finalResult.scores.deploymentScore}%` }}></div>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", marginTop: "1rem" }}>
                            <div className="audit-tab-panel">
                                <div className="health-item strength">
                                    <h4>✓ Defense Strengths</h4>
                                    <ul>
                                        {finalResult.feedback.strengths.map((s, idx) => (
                                            <li key={idx}>{s}</li>
                                        ))}
                                    </ul>
                                </div>
                                <div className="health-item weakness" style={{ marginTop: "1rem" }}>
                                    <h4>⚠ Defense Gaps</h4>
                                    <ul>
                                        {finalResult.feedback.weaknesses.map((w, idx) => (
                                            <li key={idx}>{w}</li>
                                        ))}
                                    </ul>
                                </div>
                                <div className="health-item scalability" style={{ marginTop: "1rem" }}>
                                    <h4>📘 Interview Preparation Recommendations</h4>
                                    <ul>
                                        {finalResult.feedback.recommendations.map((r, idx) => (
                                            <li key={idx}>{r}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>

                        <button 
                            className="submit-btn" 
                            style={{ width: "fit-content", alignSelf: "center", background: "#d20d3b", border: "none", color: "#fff", padding: "0.8rem 1.5rem", borderRadius: "6px", fontWeight: "700", cursor: "pointer" }}
                            onClick={() => navigate("/github-defense")}
                        >
                            Return to Dashboard
                        </button>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", flexDirection: "column" }}>
            <Navbar />
            
            <main className="git-room-page">
                {error && (
                    <div style={{
                        background: "rgba(231, 76, 60, 0.1)",
                        border: "1px solid #e74c3c",
                        borderRadius: "8px",
                        padding: "0.8rem 1rem",
                        marginBottom: "1rem",
                        color: "#e74c3c",
                        fontSize: "0.85rem"
                    }}>
                        ⚠️ {error}
                    </div>
                )}

                <div className="terminal-container">
                    {/* Header bar */}
                    <div className="terminal-header">
                        <div className="dots">
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                        <div className="title">
                            Defense Terminal: {activeSession.repoName}
                        </div>
                        <div className="badge">
                            Q: {activeQuestionIdx + 1} / {totalCount}
                        </div>
                    </div>

                    {/* Chat Body */}
                    <div className="terminal-body">
                        {/* System prompt info */}
                        <div className="log-entry">
                            <span className="sender system">System</span>
                            <div className="bubble">
                                Scanning codebase finished. Codebase components successfully loaded.
                                Interview Type: {totalCount === 5 ? "Quick Defense" : totalCount === 10 ? "Standard Defense" : "Deep Defense"}
                                Challenges focused on: Architecture, Security, Databases, API layers, and Deployment.
                            </div>
                        </div>

                        {/* Interactive prompt history */}
                        {activeSession.answers.map((ans, idx) => (
                            <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                                <div className="log-entry">
                                    <span className="sender ai">Interviewer</span>
                                    <div className="bubble ai-bubble">{ans.questionText}</div>
                                </div>
                                <div className="log-entry">
                                    <span className="sender user">Candidate</span>
                                    <div className="bubble user-bubble">{ans.userAnswer}</div>
                                </div>
                            </div>
                        ))}

                        {/* Current Question */}
                        {activeQuestionIdx >= activeSession.answers.length && (
                            <div className="log-entry">
                                <span className="sender ai">Interviewer</span>
                                <div className="bubble ai-bubble">
                                    {currentQuestion?.questionText}
                                    {currentQuestion?.isFollowUp && (
                                        <span style={{ display: "block", marginTop: "0.4rem", fontSize: "0.78rem", color: "#e67e22", fontWeight: 700 }}>
                                            [Contextual Follow-Up question triggered]
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                        <div ref={terminalEndRef} />
                    </div>

                    {/* Evaluation Details for current Question (If answered) */}
                    {existingAnswer && (
                        <div className="evaluation-panel">
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <strong style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>Question Grades</strong>
                                <span style={{ fontSize: "1.1rem", fontWeight: "800", color: "#2ecc71" }}>
                                    {existingAnswer.evaluation.overall}%
                                </span>
                            </div>
                            <div className="scores-row">
                                <div className="score-tag">Accuracy: <span>{existingAnswer.evaluation.accuracy}%</span></div>
                                <div className="score-tag">Depth: <span>{existingAnswer.evaluation.depth}%</span></div>
                                <div className="score-tag">Clarity: <span>{existingAnswer.evaluation.clarity}%</span></div>
                                <div className="score-tag">Quality: <span>{existingAnswer.evaluation.explanationQuality}%</span></div>
                            </div>
                            <div className="feedback-box">
                                <div className="list pros">
                                    <h5>✓ Strengths</h5>
                                    <ul>
                                        {existingAnswer.evaluation.feedback.strengths.map((s, idx) => (
                                            <li key={idx}>{s}</li>
                                        ))}
                                    </ul>
                                </div>
                                <div className="list cons">
                                    <h5>⚠ Gaps</h5>
                                    <ul>
                                        {existingAnswer.evaluation.feedback.weaknesses.map((w, idx) => (
                                            <li key={idx}>{w}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Terminal Input */}
                    <div className="terminal-footer">
                        {activeQuestionIdx >= activeSession.answers.length ? (
                            <form className="input-wrapper" onSubmit={handleSubmit}>
                                <textarea
                                    placeholder="Type your defense answer here..."
                                    value={userAnswer}
                                    onChange={(e) => setUserAnswer(e.target.value)}
                                    disabled={submitting}
                                    required
                                />
                                <button className="send-btn" type="submit" disabled={submitting || !userAnswer.trim()}>
                                    {submitting ? "Analyzing..." : "Submit"}
                                </button>
                            </form>
                        ) : (
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.4)" }}>
                                    {activeQuestionIdx + 1 < totalCount ? "Question graded. Proceed to the next question." : "Interview questions completed. Complete your report."}
                                </span>
                                
                                <div style={{ display: "flex", gap: "1rem" }}>
                                    {activeQuestionIdx + 1 < totalCount ? (
                                        <button 
                                            className="send-btn" 
                                            onClick={handleNext}
                                            style={{ background: "#d20d3b" }}
                                        >
                                            Next Question ➔
                                        </button>
                                    ) : (
                                        <button 
                                            className="send-btn" 
                                            onClick={handleComplete}
                                            disabled={loading}
                                            style={{ background: "#27ae60" }}
                                        >
                                            {loading ? "Generating scorecard..." : "Complete & Audit Scorecard"}
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Question index navigation footer */}
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1rem" }}>
                    <button 
                        style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: "0.85rem", fontWeight: "600" }} 
                        onClick={handlePrev}
                        disabled={activeQuestionIdx === 0}
                    >
                        ⏮ Previous Question
                    </button>
                    <span style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.4)" }}>
                        Progress: {answeredCount} / {totalCount} completed
                    </span>
                    <button 
                        style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: "0.85rem", fontWeight: "600" }} 
                        onClick={handleNext}
                        disabled={activeQuestionIdx >= activeSession.questions.length - 1 || activeQuestionIdx >= activeSession.answers.length}
                    >
                        Next Question ⏭
                    </button>
                </div>
            </main>
        </div>
    );
};

export default GithubInterviewRoom;
