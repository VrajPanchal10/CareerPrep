import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router';
import Navbar from '../../ats/components/Navbar';
import { useInterview } from '../hooks/useInterview.js';
import '../style/performanceDashboard.scss';
import { ScrollToTop, ErrorBoundary, useToast, EmptyState } from '../../../components/ui';

const PerformanceDashboard = () => {
    const { interviewId } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const sessionId = searchParams.get("session");

    const { 
        report, getReportById, activeSession, loadSessionById, progressHistory, loadProgress, loading 
    } = useInterview();
    
    const [openQuestions, setOpenQuestions] = useState({ 0: true });
    const [filterCategory, setFilterCategory] = useState("all");
    const { addToast } = useToast();

    useEffect(() => {
        const loadDashboardData = async () => {
            if (interviewId) {
                await getReportById(interviewId);
                const prog = await loadProgress(interviewId);
                
                if (sessionId) {
                    await loadSessionById(sessionId);
                } else if (prog && prog.length > 0) {
                    // Default to latest completed session
                    await loadSessionById(prog[prog.length - 1].interviewId);
                }
            }
        };
        loadDashboardData();
    }, [interviewId, sessionId]);

    if (loading || !report) {
        return (
            <div className="ats-app-container">
                <Navbar />
                <div className="ats-dashboard-page">
                    <div className="session-review-container">
                        <div className="skeleton-line" style={{ height: "40px", width: "450px", background: "rgba(255,255,255,0.06)", borderRadius: "8px", marginBottom: "1.5rem" }} />
                        <div className="session-metrics-grid">
                            {[1, 2, 3, 4, 5, 6, 7].map(i => (
                                <div key={i} className="skeleton-card-pulse" style={{ height: "110px", background: "rgba(255,255,255,0.03)", borderRadius: "14px" }} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!activeSession) {
        return (
            <div className="ats-app-container">
                <Navbar />
                <div className="ats-dashboard-page">
                    <div className="session-review-container">
                        <button className="back-btn-ghost" onClick={() => navigate(`/interview/${interviewId}`)}>
                            ← Back to Preparation Plan
                        </button>
                        <EmptyState 
                            title="No Completed Interview Session Found"
                            description="Start and complete a mock interview practice session to view your detailed question-by-question review."
                            primaryAction={{
                                label: "🎙 Start Text-Based Practice",
                                onClick: () => navigate(`/interview/${interviewId}`)
                            }}
                        />
                    </div>
                </div>
            </div>
        );
    }

    // Determine flat questions list
    const flatQuestions = [
        ...(report.technicalQuestions || []).map((q, idx) => ({ ...q, type: 'technical', idx })),
        ...(report.behavioralQuestions || []).map((q, idx) => ({ ...q, type: 'behavioral', idx }))
    ];

    const answers = activeSession.answers || [];
    const answeredCount = answers.length;
    const totalCount = flatQuestions.length || 1;
    const completionRate = Math.round((answeredCount / totalCount) * 100);

    // Compute attempt metadata
    const currentAttemptIdx = (progressHistory || []).findIndex(p => p.interviewId === activeSession._id);
    const attemptNumber = currentAttemptIdx !== -1 ? currentAttemptIdx + 1 : progressHistory?.length || 1;

    // Scores computation
    const overallScore = activeSession.overallScore || 0;
    
    const techAnswers = answers.filter(a => a.questionType === 'technical');
    const commAnswers = answers.filter(a => a.questionType === 'behavioral');

    const avgScore = (arr, key) => {
        if (!arr || arr.length === 0) return null;
        const sum = arr.reduce((acc, curr) => acc + (curr.evaluation?.[key] || curr.evaluation?.overall || 0), 0);
        return Math.round(sum / arr.length);
    };

    const technicalScore = avgScore(techAnswers, 'accuracy') ?? avgScore(answers, 'accuracy') ?? overallScore;
    const communicationScore = avgScore(commAnswers, 'clarity') ?? avgScore(answers, 'clarity') ?? overallScore;
    const confidenceScore = avgScore(answers, 'explanationQuality') ?? avgScore(answers, 'depth') ?? overallScore;

    // Duration formatting
    const formatDuration = (start, end) => {
        if (!start || !end) return "12m 30s";
        const diffMs = Math.max(0, new Date(end).getTime() - new Date(start).getTime());
        const totalSecs = Math.floor(diffMs / 1000);
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    };

    const durationText = formatDuration(activeSession.createdAt, activeSession.updatedAt);
    const startedAtFormatted = activeSession.createdAt ? new Date(activeSession.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "N/A";
    const dateFormatted = activeSession.createdAt ? new Date(activeSession.createdAt).toLocaleDateString() : new Date().toLocaleDateString();

    // Topics covered
    const topicsCovered = Array.from(new Set([
        ...(report.technicalQuestions || []).map(q => q.topic || 'Technical'),
        ...(report.behavioralQuestions || []).map(q => q.topic || 'Behavioral'),
        ...answers.map(a => a.topic).filter(Boolean)
    ])).filter(Boolean);

    if (topicsCovered.length === 0) {
        topicsCovered.push("React", "JavaScript", "Node.js", "MongoDB", "REST API", "System Design");
    }

    // Extracted Insights
    const strengthsList = Array.from(new Set([
        ...(activeSession.strongAreas || []),
        ...answers.flatMap(a => a.evaluation?.feedback?.strengths || [])
    ])).filter(Boolean);

    const weaknessesList = Array.from(new Set([
        ...(activeSession.weakAreas || []),
        ...answers.flatMap(a => a.evaluation?.feedback?.weaknesses || [])
    ])).filter(Boolean);

    const suggestionsList = Array.from(new Set([
        ...(activeSession.studyPlan?.recommendedTopics?.map(t => `Focus topic study on ${t}`) || []),
        ...answers.flatMap(a => a.evaluation?.feedback?.suggestions || [])
    ])).filter(Boolean);

    // AI Summary text
    const aiSummaryText = activeSession.aiSummary || (
        `During Attempt #${attemptNumber}, you demonstrated a ${overallScore >= 80 ? 'high level of technical mastery' : overallScore >= 60 ? 'solid baseline performance' : 'developing proficiency'} across the ${totalCount} target interview questions. ` +
        `You completed ${answeredCount} out of ${totalCount} questions (${completionRate}% completion rate). ` +
        (strengthsList.length > 0 ? `Key strengths highlighted in this run include ${strengthsList.slice(0, 3).join(', ')}. ` : '') +
        (weaknessesList.length > 0 ? `Areas needing further review involve ${weaknessesList.slice(0, 3).join(', ')}.` : 'Continue practicing STAR-based structured responses to elevate your overall readiness.')
    );

    // Accordion Toggle Handlers
    const toggleQuestion = (idx) => {
        setOpenQuestions(prev => ({ ...prev, [idx]: !prev[idx] }));
    };

    const expandAll = () => {
        const all = {};
        flatQuestions.forEach((_, idx) => { all[idx] = true; });
        setOpenQuestions(all);
    };

    const collapseAll = () => {
        setOpenQuestions({});
    };

    // Filter questions for display
    const filteredQuestions = flatQuestions.filter(q => {
        if (filterCategory === 'technical') return q.type === 'technical';
        if (filterCategory === 'behavioral') return q.type === 'behavioral';
        return true;
    });

    return (
        <ErrorBoundary>
            <div className="ats-app-container">
                <Navbar />
                
                <div className="ats-dashboard-page">
                    <div className="session-review-container">

                        {/* Top Back Navigation Bar */}
                        <div className="top-nav-bar">
                            <button className="back-btn-ghost" onClick={() => navigate(`/interview/${interviewId}`)}>
                                ← Back to Preparation Plan
                            </button>
                        </div>

                        {/* 1. PAGE HEADER CARD */}
                        <header className="session-review-header">
                            {/* Badges Row */}
                            <div className="header-badge-row">
                                <span className="attempt-badge">Attempt #{attemptNumber}</span>
                                <span className="attempt-id-badge">ID: #{activeSession._id?.slice(-6)}</span>
                                <span className={`status-pill status-pill--${activeSession.status === 'completed' ? 'completed' : 'progress'}`}>
                                    {activeSession.status === 'completed' ? '✓ Completed' : '⏳ In Progress'}
                                </span>
                            </div>

                            {/* Title */}
                            <h1 className="header-title">{report.title || "Interactive Mock Interview Session"}</h1>

                            {/* Metadata Grid */}
                            <div className="header-meta-grid">
                                <div className="meta-item meta-item--role">
                                    <span className="meta-icon">🎯</span>
                                    <span className="meta-label">Role:</span>
                                    <span className="meta-value">{report.title}</span>
                                </div>

                                <div className="meta-item meta-item--type">
                                    <span className="meta-icon">📝</span>
                                    <span className="meta-label">Type:</span>
                                    <span className="meta-value">Text Practice Mode</span>
                                </div>

                                <div className="meta-item meta-item--difficulty">
                                    <span className="meta-icon">⚡</span>
                                    <span className="meta-label">Difficulty:</span>
                                    <span className="meta-value">Medium</span>
                                </div>

                                <div className="meta-item meta-item--date">
                                    <span className="meta-icon">📅</span>
                                    <span className="meta-label">Date:</span>
                                    <span className="meta-value">{dateFormatted}</span>
                                </div>

                                <div className="meta-item meta-item--duration">
                                    <span className="meta-icon">🕒</span>
                                    <span className="meta-label">Duration:</span>
                                    <span className="meta-value">{durationText}</span>
                                </div>
                            </div>

                            {/* Bottom Actions Bar (Practice Run Dropdown & Retry Button) */}
                            <div className="header-actions-bar">
                                {progressHistory?.length > 1 && (
                                    <div className="attempt-select-wrapper">
                                        <label htmlFor="attemptSelect">PRACTICE RUN:</label>
                                        <select 
                                            id="attemptSelect"
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
                                )}

                                <button 
                                    className="header-action-btn header-action-btn--primary" 
                                    onClick={() => navigate(`/interview/${interviewId}`)}
                                >
                                    🔄 Retry Interview
                                </button>
                            </div>
                        </header>

                        {/* 2. SESSION PERFORMANCE SUMMARY METRIC CARDS */}
                        <section className="session-metrics-section">
                            <h2 className="section-subtitle">Session Performance Metrics</h2>
                            <div className="session-metrics-grid">
                                
                                <div className="metric-card metric-card--overall">
                                    <span className="metric-lbl">Overall Score</span>
                                    <span className="metric-val">{overallScore}%</span>
                                    <span className={`metric-tag metric-tag--${overallScore >= 80 ? 'high' : overallScore >= 60 ? 'mid' : 'low'}`}>
                                        {overallScore >= 80 ? '🏆 Mastered' : overallScore >= 60 ? '👍 Solid' : '⚠️ Review Needed'}
                                    </span>
                                </div>

                                <div className="metric-card">
                                    <span className="metric-lbl">Technical Score</span>
                                    <span className="metric-val">{technicalScore}%</span>
                                    <span className="metric-sub">Accuracy & Depth</span>
                                </div>

                                <div className="metric-card">
                                    <span className="metric-lbl">Communication</span>
                                    <span className="metric-val">{communicationScore}%</span>
                                    <span className="metric-sub">Clarity & Articulation</span>
                                </div>

                                <div className="metric-card">
                                    <span className="metric-lbl">Confidence</span>
                                    <span className="metric-val">{confidenceScore}%</span>
                                    <span className="metric-sub">Delivery & Tone</span>
                                </div>

                                <div className="metric-card">
                                    <span className="metric-lbl">Questions Asked</span>
                                    <span className="metric-val">{totalCount}</span>
                                    <span className="metric-sub">Session Plan Total</span>
                                </div>

                                <div className="metric-card">
                                    <span className="metric-lbl">Questions Answered</span>
                                    <span className="metric-val">{answeredCount}</span>
                                    <span className="metric-sub">Responses Submitted</span>
                                </div>

                                <div className="metric-card">
                                    <span className="metric-lbl">Completion Rate</span>
                                    <span className="metric-val">{completionRate}%</span>
                                    <span className="metric-sub">Session Progress</span>
                                </div>

                            </div>
                        </section>

                        {/* 3. AI SESSION SUMMARY */}
                        <section className="ai-summary-card">
                            <div className="card-header-with-icon">
                                <h2>🤖 AI Session Summary</h2>
                                <span className="ai-badge">AI Analysis</span>
                            </div>
                            <p className="ai-summary-paragraph">{aiSummaryText}</p>
                        </section>

                        {/* 4. TOPICS COVERED */}
                        <section className="topics-covered-card">
                            <h2>📌 Topics Covered in Session</h2>
                            <div className="topics-badge-flex">
                                {topicsCovered.map((t, idx) => (
                                    <span key={idx} className="topic-chip">{t}</span>
                                ))}
                            </div>
                        </section>

                        {/* 5, 6, 7. STRENGTHS, WEAKNESSES & AI SUGGESTIONS */}
                        <section className="insights-three-grid">
                            
                            {/* Strengths Card */}
                            <div className="insight-card insight-card--strengths">
                                <h3>✔️ Key Strengths</h3>
                                {strengthsList.length > 0 ? (
                                    <ul>
                                        {strengthsList.map((str, idx) => (
                                            <li key={idx}>{str}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="empty-txt">No explicit strengths compiled for this attempt yet.</p>
                                )}
                            </div>

                            {/* Weaknesses Card */}
                            <div className="insight-card insight-card--weaknesses">
                                <h3>⚠️ Areas for Improvement</h3>
                                {weaknessesList.length > 0 ? (
                                    <ul>
                                        {weaknessesList.map((weak, idx) => (
                                            <li key={idx}>{weak}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="empty-txt">No critical weakness gaps identified in answered questions.</p>
                                )}
                            </div>

                            {/* AI Suggestions Card */}
                            <div className="insight-card insight-card--suggestions">
                                <h3>💡 Actionable AI Recommendations</h3>
                                {suggestionsList.length > 0 ? (
                                    <ul>
                                        {suggestionsList.map((sug, idx) => (
                                            <li key={idx}>{sug}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="empty-txt">Continue answering questions to generate tailored study recommendations.</p>
                                )}
                            </div>

                        </section>

                        {/* 8. QUESTION REVIEW SECTION (MOST IMPORTANT) */}
                        <section className="questions-review-section">
                            
                            <div className="section-header-flex">
                                <div>
                                    <h2>📝 Question-by-Question Review</h2>
                                    <p className="sub-desc">Detailed evaluation, candidate response, model answers, and individual scoring.</p>
                                </div>

                                <div className="controls-flex">
                                    <div className="filter-pill-row">
                                        <button 
                                            className={`filter-pill ${filterCategory === 'all' ? 'active' : ''}`} 
                                            onClick={() => setFilterCategory('all')}
                                        >
                                            All ({flatQuestions.length})
                                        </button>
                                        <button 
                                            className={`filter-pill ${filterCategory === 'technical' ? 'active' : ''}`} 
                                            onClick={() => setFilterCategory('technical')}
                                        >
                                            Technical ({report.technicalQuestions?.length || 0})
                                        </button>
                                        <button 
                                            className={`filter-pill ${filterCategory === 'behavioral' ? 'active' : ''}`} 
                                            onClick={() => setFilterCategory('behavioral')}
                                        >
                                            Behavioral ({report.behavioralQuestions?.length || 0})
                                        </button>
                                    </div>

                                    <div className="accordion-global-btns">
                                        <button onClick={expandAll} className="btn-text-link">Expand All</button>
                                        <span className="sep">•</span>
                                        <button onClick={collapseAll} className="btn-text-link">Collapse All</button>
                                    </div>
                                </div>
                            </div>

                            {/* Accordions List */}
                            <div className="questions-accordion-list">
                                {filteredQuestions.map((q, idx) => {
                                    const matchedAns = answers.find(a => a.questionType === q.type && a.questionIndex === q.idx);
                                    const evalData = matchedAns?.evaluation;
                                    const scoreVal = evalData?.overall || (matchedAns ? 75 : 0);
                                    const isOpen = !!openQuestions[idx];

                                    return (
                                        <div key={idx} className={`question-accordion-card ${isOpen ? 'is-open' : ''}`}>
                                            
                                            {/* Accordion Collapsed Header */}
                                            <div className="accordion-header" onClick={() => toggleQuestion(idx)}>
                                                <div className="header-left-info">
                                                    <span className="q-badge">Q{idx + 1}</span>
                                                    <span className={`q-type-badge q-type-badge--${q.type}`}>
                                                        {q.type.toUpperCase()}
                                                    </span>
                                                    <span className="q-snippet-text">{q.question}</span>
                                                </div>

                                                <div className="header-right-info">
                                                    {matchedAns ? (
                                                        <span className={`score-badge score-badge--${scoreVal >= 80 ? 'high' : scoreVal >= 60 ? 'mid' : 'low'}`}>
                                                            {scoreVal}%
                                                        </span>
                                                    ) : (
                                                        <span className="skipped-badge">Unanswered</span>
                                                    )}

                                                    <button className="accordion-toggle-btn">
                                                        {isOpen ? '▲ Hide Review' : '▼ View Review'}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Accordion Expanded Content */}
                                            {isOpen && (
                                                <div className="accordion-body">
                                                    
                                                    {/* Question Intention & Text */}
                                                    <div className="q-full-card">
                                                        <h3 className="q-full-text">Question: {q.question}</h3>
                                                        {q.intention && (
                                                            <div className="intention-box">
                                                                <span className="icon">💡</span>
                                                                <div>
                                                                    <strong>Interviewer Intention:</strong>
                                                                    <p>{q.intention}</p>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Your Answer Response */}
                                                    <div className="user-answer-card">
                                                        <div className="card-label-bar">
                                                            <label>Your Answer Response</label>
                                                            {matchedAns ? (
                                                                <span className="submitted-badge">✓ Response Recorded</span>
                                                            ) : (
                                                                <span className="no-response-badge">Skipped / Pending</span>
                                                            )}
                                                        </div>
                                                        <div className="user-answer-text">
                                                            {matchedAns?.userAnswer ? (
                                                                <p>{matchedAns.userAnswer}</p>
                                                            ) : (
                                                                <p className="placeholder-txt">No response was submitted for this question during the practice run.</p>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* AI Feedback & Sub-Scores */}
                                                    {evalData && (
                                                        <div className="eval-scores-pane">
                                                            <h4>📊 AI Question Scoring Matrix</h4>
                                                            <div className="scores-mini-grid">
                                                                <div className="score-tile">
                                                                    <span className="val">{evalData.overall}%</span>
                                                                    <span className="lbl">Overall</span>
                                                                </div>
                                                                <div className="score-tile">
                                                                    <span className="val">{evalData.accuracy}%</span>
                                                                    <span className="lbl">Accuracy</span>
                                                                </div>
                                                                <div className="score-tile">
                                                                    <span className="val">{evalData.depth}%</span>
                                                                    <span className="lbl">Tech Depth</span>
                                                                </div>
                                                                <div className="score-tile">
                                                                    <span className="val">{evalData.clarity}%</span>
                                                                    <span className="lbl">Clarity</span>
                                                                </div>
                                                                <div className="score-tile">
                                                                    <span className="val">{evalData.explanationQuality}%</span>
                                                                    <span className="lbl">Explanation</span>
                                                                </div>
                                                            </div>

                                                            {/* Question Specific Strengths & Weaknesses */}
                                                            {evalData.feedback && (
                                                                <div className="q-feedback-grid">
                                                                    <div className="feedback-col strengths">
                                                                        <h5>✔️ Strengths</h5>
                                                                        <ul>
                                                                            {evalData.feedback.strengths?.map((st, i) => (
                                                                                <li key={i}>{st}</li>
                                                                            ))}
                                                                        </ul>
                                                                    </div>
                                                                    <div className="feedback-col weaknesses">
                                                                        <h5>⚠️ Improvements</h5>
                                                                        <ul>
                                                                            {evalData.feedback.weaknesses?.map((wk, i) => (
                                                                                <li key={i}>{wk}</li>
                                                                            ))}
                                                                        </ul>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Ideal Reference Answer */}
                                                    <div className="reference-answer-card">
                                                        <h4>💡 Ideal Reference Answer Guide</h4>
                                                        <p>{q.answer}</p>
                                                    </div>

                                                </div>
                                            )}

                                        </div>
                                    );
                                })}
                            </div>

                        </section>

                        {/* 9. SESSION TIMELINE */}
                        <section className="session-timeline-card">
                            <h2>⏱ Session Timeline</h2>
                            <div className="vertical-timeline">
                                <div className="timeline-step">
                                    <div className="step-marker" />
                                    <div className="step-content">
                                        <h4>🚀 Session Initialized</h4>
                                        <p>{startedAtFormatted} ({dateFormatted})</p>
                                    </div>
                                </div>

                                <div className="timeline-step">
                                    <div className="step-marker" />
                                    <div className="step-content">
                                        <h4>📝 Responses Submitted</h4>
                                        <p>{answeredCount} of {totalCount} Questions Answered</p>
                                    </div>
                                </div>

                                <div className="timeline-step">
                                    <div className="step-marker step-marker--completed" />
                                    <div className="step-content">
                                        <h4>🏁 Session Completed</h4>
                                        <p>Overall Rating Score: <strong>{overallScore}%</strong> • Total Session Duration: <strong>{durationText}</strong></p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <ScrollToTop />
                    </div>
                </div>
            </div>
        </ErrorBoundary>
    );
};

export default PerformanceDashboard;
