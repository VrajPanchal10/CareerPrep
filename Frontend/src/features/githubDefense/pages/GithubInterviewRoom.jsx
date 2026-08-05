import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import Navbar from "../../ats/components/Navbar";
import { useGithubDefense } from "../hooks/useGithubDefense";
import { 
    Shield, 
    Send, 
    ArrowLeft, 
    ArrowRight, 
    CheckCircle2, 
    AlertTriangle, 
    HelpCircle, 
    X, 
    Terminal as TerminalIcon, 
    Sparkles, 
    Loader2, 
    Award,
    RotateCcw,
    Layers,
    Cpu,
    Lock,
    Database,
    Globe,
    Server
} from "lucide-react";
import ConfirmationModal from "../../../components/ui/ConfirmationModal/ConfirmationModal";
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
    const [showExitModal, setShowExitModal] = useState(false);
    const terminalEndRef = useRef(null);

    useEffect(() => {
        if (sessionId) {
            loadSession(sessionId);
        }
    }, [sessionId, loadSession]);

    // Scroll chat window to bottom on new updates
    useEffect(() => {
        terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [activeSession, submitting, activeQuestionIdx]);

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
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
        const targetLimit = activeSession.targetQuestionCount || (activeSession.interviewLength === "Deep" ? 15 : activeSession.interviewLength === "Standard" ? 10 : 5);
        const limitCount = Math.min(activeSession.questions.length, targetLimit);
        if (activeQuestionIdx < limitCount - 1) {
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

    // Keyboard Shortcuts Support
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Ctrl+Enter or Cmd+Enter -> Submit
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                if (userAnswer.trim() && !submitting && activeSession && activeQuestionIdx >= activeSession.answers.length) {
                    e.preventDefault();
                    handleSubmit();
                }
            }
            // Ctrl+Left -> Previous
            else if ((e.ctrlKey || e.metaKey) && e.key === "ArrowLeft") {
                if (activeQuestionIdx > 0) {
                    e.preventDefault();
                    handlePrev();
                }
            }
            // Ctrl+Right -> Next
            else if ((e.ctrlKey || e.metaKey) && e.key === "ArrowRight") {
                if (activeSession && activeQuestionIdx < activeSession.questions.length - 1 && activeQuestionIdx < activeSession.answers.length) {
                    e.preventDefault();
                    handleNext();
                }
            }
            // Escape -> Toggle Exit Modal
            else if (e.key === "Escape") {
                setShowExitModal((prev) => !prev);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [userAnswer, submitting, activeQuestionIdx, activeSession]);

    if (loading && !activeSession) {
        return (
            <div className="room-loading-overlay">
                <div className="loader-box">
                    <Loader2 className="spinner-icon" size={36} />
                    <h3>Initializing Defense Terminal...</h3>
                    <p>Loading codebase knowledge graph & session context...</p>
                </div>
            </div>
        );
    }

    if (!activeSession) {
        return (
            <div className="room-loading-overlay">
                <div className="loader-box error-box">
                    <AlertTriangle size={40} className="error-icon" />
                    <h2>No Session Found</h2>
                    <p>The requested interview session does not exist or has expired.</p>
                    <button className="cta-btn-return" onClick={() => navigate("/github-defense")}>
                        Return to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    const currentQuestion = activeSession.questions[activeQuestionIdx];
    const existingAnswer = activeSession.answers.find(a => a.questionIndex === activeQuestionIdx);
    const answeredCount = activeSession.answers.length;
    
    // Single source of truth for Defense Mode & Target Question Count
    const mode = activeSession.interviewLength || (activeSession.targetQuestionCount === 15 ? "Deep" : activeSession.targetQuestionCount === 10 ? "Standard" : "Quick");
    const targetCount = activeSession.targetQuestionCount || (mode === "Quick" ? 5 : mode === "Standard" ? 10 : 15);
    // Hard cap totalCount at targetCount (5 for Quick, 10 for Standard, 15 for Deep)
    const totalCount = Math.min(activeSession.questions.length, targetCount);
    const modeLabel = `${mode} Defense (${targetCount} Qs)`;

    // Progress Formula: answeredCount / totalCount (0% -> 20% -> 40% -> 60% -> 80% -> 100%)
    const progressPercent = Math.min(100, Math.round((answeredCount / totalCount) * 100));
    const remainingCount = Math.max(0, totalCount - answeredCount);

    const getTopicBadge = (topic) => {
        switch (topic) {
            case "Architecture":
                return { label: "Architecture", icon: Cpu, styleClass: "topic-arch" };
            case "Security":
                return { label: "Security", icon: Lock, styleClass: "topic-sec" };
            case "Database":
                return { label: "Database", icon: Database, styleClass: "topic-db" };
            case "API Design":
                return { label: "API Design", icon: Globe, styleClass: "topic-api" };
            case "Deployment":
                return { label: "Deployment", icon: Server, styleClass: "topic-deploy" };
            default:
                return { label: topic || "Engineering", icon: Layers, styleClass: "topic-default" };
        }
    };

    // Render Final Scorecard View
    if (showScorecard && finalResult) {
        return (
            <div className="git-room-wrapper">
                <Navbar />
                <main className="git-dashboard-page scorecard-page">
                    <header className="git-header">
                        <div className="header-left">
                            <h1>🏆 Project Defense <span className="highlight">Complete</span></h1>
                            <p>Review your Project Knowledge metrics and AI feedback scorecard below.</p>
                        </div>
                    </header>

                    <div className="git-card scorecard-card">
                        <div className="scorecard-header-row">
                            <div className="scorecard-repo-info">
                                <span className="repo-badge">📁 {finalResult.repoName}</span>
                                <h2>Evaluation Scorecard</h2>
                                <span className="sub-date">Generated on {new Date(finalResult.createdAt || Date.now()).toLocaleDateString()}</span>
                            </div>
                            <div className="scorecard-overall-badge">
                                <div className="score-val">{finalResult.scores.overallMasteryScore}%</div>
                                <div className="score-lbl">Overall Defense Mastery</div>
                            </div>
                        </div>

                        {/* Breakdown Metrics Grid */}
                        <div className="scores-grid">
                            <div className="score-bar-card">
                                <div className="score-bar-top">
                                    <span className="score-title"><Cpu size={14} /> Architecture</span>
                                    <span className="score-value">{finalResult.scores.architectureScore}%</span>
                                </div>
                                <div className="bar-track">
                                    <div className="bar-fill" style={{ width: `${finalResult.scores.architectureScore}%` }}></div>
                                </div>
                            </div>
                            <div className="score-bar-card">
                                <div className="score-bar-top">
                                    <span className="score-title"><Lock size={14} /> Security</span>
                                    <span className="score-value">{finalResult.scores.securityScore}%</span>
                                </div>
                                <div className="bar-track">
                                    <div className="bar-fill" style={{ width: `${finalResult.scores.securityScore}%` }}></div>
                                </div>
                            </div>
                            <div className="score-bar-card">
                                <div className="score-bar-top">
                                    <span className="score-title"><Database size={14} /> Database</span>
                                    <span className="score-value">{finalResult.scores.databaseScore}%</span>
                                </div>
                                <div className="bar-track">
                                    <div className="bar-fill" style={{ width: `${finalResult.scores.databaseScore}%` }}></div>
                                </div>
                            </div>
                            <div className="score-bar-card">
                                <div className="score-bar-top">
                                    <span className="score-title"><Globe size={14} /> API Design</span>
                                    <span className="score-value">{finalResult.scores.apiDesignScore}%</span>
                                </div>
                                <div className="bar-track">
                                    <div className="bar-fill" style={{ width: `${finalResult.scores.apiDesignScore}%` }}></div>
                                </div>
                            </div>
                            <div className="score-bar-card">
                                <div className="score-bar-top">
                                    <span className="score-title"><Server size={14} /> Deployment</span>
                                    <span className="score-value">{finalResult.scores.deploymentScore}%</span>
                                </div>
                                <div className="bar-track">
                                    <div className="bar-fill" style={{ width: `${finalResult.scores.deploymentScore}%` }}></div>
                                </div>
                            </div>
                        </div>

                        {/* Qualitative AI Feedback Section */}
                        <div className="feedback-sections-grid">
                            <div className="health-item strength">
                                <h4><CheckCircle2 size={16} /> Defense Strengths</h4>
                                <ul>
                                    {finalResult.feedback.strengths.map((s, idx) => (
                                        <li key={idx}>{s}</li>
                                    ))}
                                </ul>
                            </div>
                            <div className="health-item weakness">
                                <h4><AlertTriangle size={16} /> Defense Gaps</h4>
                                <ul>
                                    {finalResult.feedback.weaknesses.map((w, idx) => (
                                        <li key={idx}>{w}</li>
                                    ))}
                                </ul>
                            </div>
                            <div className="health-item scalability">
                                <h4><Sparkles size={16} /> Actionable Preparation Recommendations</h4>
                                <ul>
                                    {finalResult.feedback.recommendations.map((r, idx) => (
                                        <li key={idx}>{r}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        <button 
                            className="cta-btn-return" 
                            onClick={() => navigate("/github-defense")}
                        >
                            Return to Dashboard
                        </button>
                    </div>
                </main>
            </div>
        );
    }

    const currentBadge = currentQuestion ? getTopicBadge(currentQuestion.topic) : null;
    const TopicIcon = currentBadge ? currentBadge.icon : Layers;

    const getQuestionText = (q) => {
        if (!q) return null;
        const txt = q.questionText || q.question || q.text || q.content;
        return txt && typeof txt === "string" && txt.trim().length > 0 ? txt.trim() : null;
    };

    return (
        <div className="git-room-wrapper">
            <Navbar />
            
            <main className="git-room-page">
                {/* Error Banner */}
                {error && (
                    <div className="alert-banner error-banner">
                        <AlertTriangle size={16} />
                        <span>{error}</span>
                    </div>
                )}

                {/* Progress Header Card */}
                <div className="room-progress-card">
                    <div className="progress-top-row">
                        <div className="progress-title-group">
                            <Shield size={18} className="shield-icon" />
                            <span className="repo-name-text">{activeSession.repoName}</span>
                            <span className="type-tag">{modeLabel}</span>
                        </div>
                        <div className="progress-numbers">
                            <span className="current-step">Question <strong>{Math.min(activeQuestionIdx + 1, totalCount)}</strong> of <strong>{totalCount}</strong></span>
                            <span className="percent-badge">{progressPercent}% Completed</span>
                        </div>
                    </div>
                    <div className="progress-track-wrapper">
                        <div className="progress-fill-bar" style={{ width: `${progressPercent}%` }}></div>
                    </div>
                </div>

                {/* Main Interactive Terminal Window */}
                <div className="terminal-container">
                    {/* Terminal Top Window Header Bar */}
                    <div className="terminal-header">
                        <div className="mac-dots">
                            <span className="dot red"></span>
                            <span className="dot yellow"></span>
                            <span className="dot green"></span>
                        </div>
                        <div className="terminal-title">
                            <TerminalIcon size={14} />
                            <span>Defense Terminal — {activeSession.repoName}</span>
                        </div>
                        <div className="header-actions">
                            <button className="exit-btn-ghost" onClick={() => setShowExitModal(true)} title="Exit Session (Esc)">
                                <X size={15} /> Exit
                            </button>
                        </div>
                    </div>

                    {/* Chat Body Log */}
                    <div className="terminal-body">
                        {/* System Greeting Entry */}
                        <div className="log-entry system-entry">
                            <span className="sender-badge system">System</span>
                            <div className="bubble system-bubble">
                                💻 Codebase components loaded. {modeLabel} session active.
                                Focus areas: Architecture, Security, Databases, API layers, and Deployment.
                            </div>
                        </div>

                        {/* Previously Answered Questions Log */}
                        {activeSession.answers.map((ans, idx) => (
                            <div key={idx} className="qa-history-pair">
                                <div className="log-entry ai-entry">
                                    <span className="sender-badge ai">Interviewer</span>
                                    <div className="bubble ai-bubble">{getQuestionText(ans) || "Technical defense question evaluated."}</div>
                                </div>
                                <div className="log-entry user-entry">
                                    <span className="sender-badge user">Candidate</span>
                                    <div className="bubble user-bubble">{ans.userAnswer}</div>
                                </div>
                            </div>
                        ))}

                        {/* Current Active Question Display */}
                        {activeQuestionIdx >= activeSession.answers.length && (
                            <div className="log-entry ai-entry current-active-question">
                                <div className="ai-sender-row">
                                    <span className="sender-badge ai">Interviewer</span>
                                    {currentBadge && (
                                        <span className={`topic-badge ${currentBadge.styleClass}`}>
                                            <TopicIcon size={12} /> {currentBadge.label}
                                        </span>
                                    )}
                                </div>
                                <div className="bubble ai-bubble active-bubble">
                                    {getQuestionText(currentQuestion) ? (
                                        <p className="question-text">{getQuestionText(currentQuestion)}</p>
                                    ) : (
                                        <div className="generating-question-placeholder flex-column-gap">
                                            <div className="loader-inline-row">
                                                <Loader2 size={16} className="spinner-icon" />
                                                <span>Generating next interview question...</span>
                                            </div>
                                            <button 
                                                type="button" 
                                                className="btn-sync-retry" 
                                                onClick={() => loadSession(sessionId)}
                                                title="Click to reload session from server if question generation is delayed"
                                            >
                                                <RotateCcw size={12} /> Refresh Question Session
                                            </button>
                                        </div>
                                    )}
                                    {currentQuestion?.isFollowUp && (
                                        <span className="followup-alert">
                                            ⚡ Contextual Follow-Up question triggered based on your response
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Evaluation Loading State */}
                        {submitting && (
                            <div className="evaluating-state-card">
                                <Loader2 className="spinner-icon" size={20} />
                                <div>
                                    <h4>⚡ AI Evaluator is analyzing your response...</h4>
                                    <p>Assessing technical accuracy, depth, and architectural justification...</p>
                                </div>
                            </div>
                        )}

                        <div ref={terminalEndRef} />
                    </div>

                    {/* Evaluation Details for current Question (If answered) */}
                    {existingAnswer && (
                        <div className="evaluation-panel">
                            <div className="panel-header">
                                <div className="header-left-title">
                                    <CheckCircle2 size={16} className="check-icon" />
                                    <span>Question Evaluation Grade</span>
                                </div>
                                <div className="overall-score-tag">
                                    Overall: <strong>{existingAnswer.evaluation.overall}%</strong>
                                </div>
                            </div>
                            <div className="scores-row">
                                <div className="score-tag">Accuracy: <span>{existingAnswer.evaluation.accuracy}%</span></div>
                                <div className="score-tag">Depth: <span>{existingAnswer.evaluation.depth}%</span></div>
                                <div className="score-tag">Clarity: <span>{existingAnswer.evaluation.clarity}%</span></div>
                                <div className="score-tag">Quality: <span>{existingAnswer.evaluation.explanationQuality}%</span></div>
                            </div>
                            <div className="feedback-box">
                                <div className="list pros">
                                    <h5><CheckCircle2 size={13} /> Strengths</h5>
                                    <ul>
                                        {existingAnswer.evaluation.feedback.strengths.map((s, idx) => (
                                            <li key={idx}>{s}</li>
                                        ))}
                                    </ul>
                                </div>
                                <div className="list cons">
                                    <h5><AlertTriangle size={13} /> Gaps to Address</h5>
                                    <ul>
                                        {existingAnswer.evaluation.feedback.weaknesses.map((w, idx) => (
                                            <li key={idx}>{w}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Terminal Input Controls Footer */}
                    <div className="terminal-footer">
                        {activeQuestionIdx >= activeSession.answers.length ? (
                            <form className="input-wrapper" onSubmit={handleSubmit}>
                                <div className="input-row">
                                    <textarea
                                        placeholder="Type your technical defense answer here... Provide architectural rationale and design trade-offs."
                                        value={userAnswer}
                                        onChange={(e) => setUserAnswer(e.target.value)}
                                        disabled={submitting}
                                        maxLength={2000}
                                        required
                                    />
                                    <button className="send-btn" type="submit" disabled={submitting || !userAnswer.trim()}>
                                        {submitting ? (
                                            <>
                                                <Loader2 size={16} className="spinner-icon" /> Analyzing...
                                            </>
                                        ) : (
                                            <>
                                                <Send size={16} /> Submit Answer
                                            </>
                                        )}
                                    </button>
                                </div>
                                <div className="input-meta-bar">
                                    <span className="shortcut-hint">💡 Shortcut: <strong>Ctrl + Enter</strong> to submit</span>
                                    <span className="char-counter">{userAnswer.length} / 2000 chars</span>
                                </div>
                            </form>
                        ) : (
                            <div className="graded-next-bar">
                                <span className="graded-status-text">
                                    {activeQuestionIdx + 1 < totalCount ? "✅ Question graded. Click Next Question to continue." : "🏆 All interview questions completed. Click Complete & Audit to view final report."}
                                </span>
                                
                                <div className="next-action-buttons">
                                    {activeQuestionIdx + 1 < totalCount ? (
                                        <button 
                                            className="cta-next-btn" 
                                            onClick={handleNext}
                                        >
                                            Next Question <ArrowRight size={16} />
                                        </button>
                                    ) : (
                                        <button 
                                            className="cta-complete-btn" 
                                            onClick={handleComplete}
                                            disabled={loading}
                                        >
                                            {loading ? (
                                                <>
                                                    <Loader2 size={16} className="spinner-icon" /> Generating Scorecard...
                                                </>
                                            ) : (
                                                <>
                                                    <Award size={16} /> Complete & Audit Scorecard
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Question Navigation Bar Footer */}
                <div className="room-nav-footer">
                    <button 
                        className="nav-step-btn"
                        onClick={handlePrev}
                        disabled={activeQuestionIdx === 0}
                        title="Previous Question (Ctrl + ←)"
                    >
                        <ArrowLeft size={14} /> Previous Question
                    </button>
                    <div className="nav-center-counter">
                        <span>Answered: <strong>{answeredCount}</strong> / {totalCount}</span>
                        {remainingCount > 0 && <span className="rem-tag">{remainingCount} remaining</span>}
                    </div>
                    <button 
                        className="nav-step-btn"
                        onClick={handleNext}
                        disabled={activeQuestionIdx >= totalCount - 1 || activeQuestionIdx >= activeSession.answers.length}
                        title="Next Question (Ctrl + →)"
                    >
                        Next Question <ArrowRight size={14} />
                    </button>
                </div>
            </main>

            {/* Exit Confirmation Modal */}
            <ConfirmationModal
                open={showExitModal}
                variant="warning"
                title="Exit Project Defense Interview?"
                description="Your session progress will be saved in MongoDB. You can return and resume this defense interview at any time from your dashboard."
                confirmText="Yes, Exit to Dashboard"
                cancelText="Continue Interview"
                onConfirm={() => navigate("/github-defense")}
                onCancel={() => setShowExitModal(false)}
            />
        </div>
    );
};

export default GithubInterviewRoom;
