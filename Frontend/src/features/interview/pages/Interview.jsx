import React, { useState, useEffect } from 'react'
import '../style/interview.scss'
import { useInterview } from '../hooks/useInterview.js'
import { useNavigate, useParams } from 'react-router'
import Navbar from '../../ats/components/Navbar'
import { PdfPreview, useToast, ErrorBoundary, ScrollToTop } from '../../../components/ui'



const NAV_ITEMS = [
    { id: 'technical', label: 'Technical Questions', icon: (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>) },
    { id: 'behavioral', label: 'Behavioral Questions', icon: (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>) },
    { id: 'roadmap', label: 'Road Map', icon: (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11" /></svg>) },
]

// ── Sub-components ────────────────────────────────────────────────────────────
const QuestionCard = ({ item, index }) => {
    const [ open, setOpen ] = useState(false)
    return (
        <div className='q-card'>
            <div className='q-card__header' onClick={() => setOpen(o => !o)}>
                <span className='q-card__index'>Q{index + 1}</span>
                <p className='q-card__question'>{item.question}</p>
                <span className={`q-card__chevron ${open ? 'q-card__chevron--open' : ''}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                </span>
            </div>
            {open && (
                <div className='q-card__body'>
                    <div className='q-card__section'>
                        <span className='q-card__tag q-card__tag--intention'>Intention</span>
                        <p>{item.intention}</p>
                    </div>
                    <div className='q-card__section'>
                        <span className='q-card__tag q-card__tag--answer'>Model Answer</span>
                        <p>{item.answer}</p>
                    </div>
                </div>
            )}
        </div>
    )
}

const RoadMapDay = ({ day }) => (
    <div className='roadmap-day'>
        <div className='roadmap-day__header'>
            <span className='roadmap-day__badge'>Day {day.day}</span>
            <h3 className='roadmap-day__focus'>{day.focus}</h3>
        </div>
        <ul className='roadmap-day__tasks'>
            {day.tasks.map((task, i) => (
                <li key={i}>
                    <span className='roadmap-day__bullet' />
                    {task}
                </li>
            ))}
        </ul>
    </div>
)

// ── Main Component ────────────────────────────────────────────────────────────
const Interview = () => {
    const [ activeNav, setActiveNav ] = useState('technical')
    const { 
        report, getReportById, loading, getResumePdf, downloadReportPdf, generateReport,
        activeSession, startSession, submitAnswer, completeSession, progressHistory, loadSessionById
    } = useInterview()
    const { interviewId } = useParams()
    const navigate = useNavigate()

    const [ currentQIndex, setCurrentQIndex ] = useState(0)
    const [ answerText, setAnswerText ] = useState("")
    const [ localEvaluating, setLocalEvaluating ] = useState(false)
    const [ isPdfPreviewOpen, setIsPdfPreviewOpen] = useState(false)
    const [ showLeaveModal, setShowLeaveModal ] = useState(false)
    const { addToast } = useToast()

    useEffect(() => {
        if (interviewId) {
            getReportById(interviewId)
        }
    }, [ interviewId ])

    const flatQuestions = report ? [
        ...report.technicalQuestions.map((q, idx) => ({ ...q, type: 'technical', idx })),
        ...report.behavioralQuestions.map((q, idx) => ({ ...q, type: 'behavioral', idx }))
    ] : []

    useEffect(() => {
        if (flatQuestions.length > 0 && activeSession) {
            const currentQ = flatQuestions[currentQIndex];
            const ans = activeSession.answers?.find(
                a => a.questionType === currentQ?.type && a.questionIndex === currentQ?.idx
            );
            setAnswerText(ans ? ans.userAnswer : "");
        }
    }, [ currentQIndex, activeSession, report ])

    if (loading || !report) {
        return (
            <div style={{ minHeight: "100vh" }}>
                <Navbar />
                <main className='loading-screen'>
                    <h1>Loading your interview plan...</h1>
                </main>
            </div>
        )
    }

    const scoreColor =
        report.matchScore >= 80 ? 'score--high' :
            report.matchScore >= 60 ? 'score--mid' : 'score--low'

    const handleStartSession = async () => {
        await startSession(report._id)
        setCurrentQIndex(0)
    }

    const handleSubmitAnswer = async () => {
        if (!answerText || answerText.trim() === "") {
            addToast("Please type your answer response first.", "warning");
            return
        }
        setLocalEvaluating(true)
        const currentQ = flatQuestions[currentQIndex];
        await submitAnswer({
            sessionId: activeSession._id,
            questionType: currentQ.type,
            questionIndex: currentQ.idx,
            userAnswer: answerText
        })
        setLocalEvaluating(false)
    }

    const handleCompleteSession = async () => {
        const completed = await completeSession(activeSession._id)
        if (completed) {
            navigate(`/interview/${report._id}/dashboard?session=${completed._id}`)
        }
    }

    // Determine current active question state
    const currentQ = flatQuestions[currentQIndex]
    const activeAnswer = activeSession?.answers?.find(
        a => a.questionType === currentQ?.type && a.questionIndex === currentQ?.idx
    )

    // Render session UI if started
    if (activeSession && activeSession.status === "started") {
        const wordsCount = answerText.trim() ? answerText.trim().split(/\s+/).length : 0;
        const charsCount = answerText.length;
        const speakingTimeSec = Math.ceil((wordsCount / 130) * 60);
        const answeredCount = activeSession.answers?.length || 0;
        const totalCount = flatQuestions.length;
        const progressPct = Math.round((answeredCount / totalCount) * 100);
        const remainingCount = totalCount - answeredCount;

        return (
            <div style={{ minHeight: "100vh", background: "var(--theme-bg, #0b0f19)" }}>
                <Navbar />
                
                <div className="practice-workspace-container">
                    
                    {/* Header Bar */}
                    <header className="practice-workspace-header">
                        <div className="header-meta">
                            <span className="practice-badge">Text-Based Practice Mode</span>
                            <h1 className="header-title">{report.title || "Interactive Mock Session"}</h1>
                            <div className="header-stats-row">
                                <span className="meta-pill">
                                    📄 Q{currentQIndex + 1} of {totalCount}
                                </span>
                                <span className="meta-pill">
                                    🕒 {remainingCount} Remaining
                                </span>
                                <span className="meta-pill accent-pill">
                                    {progressPct}% Completed
                                </span>
                            </div>
                        </div>

                        <div className="header-controls">
                            <div className="workspace-progress-box">
                                <div className="progress-label">
                                    <span>Session Progress</span>
                                    <span>{progressPct}%</span>
                                </div>
                                <div className="progress-track">
                                    <div className="progress-fill" style={{ width: `${progressPct}%` }} />
                                </div>
                            </div>

                            <button className="leave-practice-btn" onClick={() => setShowLeaveModal(true)}>
                                🚪 Leave Practice
                            </button>
                        </div>
                    </header>

                    {/* Main Workspace Grid */}
                    <div className="practice-workspace-body">
                        
                        {/* Question Card */}
                        <div className="practice-card question-card">
                            <div className="q-card-header">
                                <div className="q-tags">
                                    <span className={`q-type-tag q-type-tag--${currentQ?.type}`}>
                                        {(currentQ?.type || '').toUpperCase()} QUESTION
                                    </span>
                                    <span className="q-topic-tag">
                                        Topic: {currentQ?.topic || (currentQ?.type === 'technical' ? 'General Technical' : 'Behavioral')}
                                    </span>
                                </div>
                                <span className="q-number-badge">Q{currentQIndex + 1} of {totalCount}</span>
                            </div>

                            <h2 className="q-text">{currentQ?.question}</h2>
                            
                            <div className="q-intention-box">
                                <span className="intention-icon">💡</span>
                                <div>
                                    <strong>Interviewer Intention:</strong>
                                    <p>{currentQ?.intention}</p>
                                </div>
                            </div>
                        </div>

                        {/* Polished Answer Editor Card */}
                        <div className="practice-card answer-card">
                            <div className="answer-card-header">
                                <label htmlFor="userAnswer">Your Answer Response</label>
                                {answerText.trim() && (
                                    <span className="autosave-badge">
                                        <span className="dot" /> Draft Active
                                    </span>
                                )}
                            </div>

                            <div className="answer-editor-wrapper">
                                <textarea
                                    id="userAnswer"
                                    value={answerText}
                                    onChange={(e) => setAnswerText(e.target.value)}
                                    placeholder="Type your answer in detail here... Use structured points (STAR method: Situation, Task, Action, Result) for clarity."
                                    disabled={localEvaluating}
                                    className="polished-answer-textarea"
                                />
                                
                                <div className="editor-stats-bar">
                                    <div className="stats-group">
                                        <span><strong>{wordsCount}</strong> Words</span>
                                        <span className="dot-sep">•</span>
                                        <span><strong>{charsCount}</strong> Chars</span>
                                        <span className="dot-sep">•</span>
                                        <span><strong>~{speakingTimeSec}s</strong> Verbal Read Time</span>
                                    </div>

                                    <button 
                                        className="submit-eval-btn" 
                                        onClick={handleSubmitAnswer}
                                        disabled={localEvaluating || !answerText.trim()}
                                    >
                                        {localEvaluating ? (
                                            <>
                                                <span className="btn-spinner" /> AI Evaluating...
                                            </>
                                        ) : activeAnswer ? (
                                            "🔄 Re-Evaluate Answer"
                                        ) : (
                                            "✨ Submit & Evaluate"
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Evaluation Display Card */}
                        {activeAnswer && (
                            <div className="practice-card evaluation-card">
                                <div className="eval-card-header">
                                    <h3><i className="fi fi-rr-chart-pie-alt" style={{ color: "#d20d3b" }}></i> Interviewer Evaluation Summary</h3>
                                    <div className="eval-score-badge">
                                        <span>Overall:</span> <strong>{activeAnswer.evaluation.overall}%</strong>
                                    </div>
                                </div>
                                
                                <div className="eval-scores-row">
                                    <div className="score-tile">
                                        <span className="val">{activeAnswer.evaluation.overall}%</span>
                                        <span className="lbl">Overall</span>
                                    </div>
                                    <div className="score-tile">
                                        <span className="val">{activeAnswer.evaluation.accuracy}%</span>
                                        <span className="lbl">Accuracy</span>
                                    </div>
                                    <div className="score-tile">
                                        <span className="val">{activeAnswer.evaluation.depth}%</span>
                                        <span className="lbl">Tech Depth</span>
                                    </div>
                                    <div className="score-tile">
                                        <span className="val">{activeAnswer.evaluation.clarity}%</span>
                                        <span className="lbl">Clarity</span>
                                    </div>
                                    <div className="score-tile">
                                        <span className="val">{activeAnswer.evaluation.explanationQuality}%</span>
                                        <span className="lbl">Explanation</span>
                                    </div>
                                </div>

                                <div className="eval-feedback-grid">
                                    <div className="feedback-col strengths-col">
                                        <h4>✔️ Key Strengths</h4>
                                        <ul>
                                            {activeAnswer.evaluation.feedback?.strengths?.map((str, idx) => (
                                                <li key={idx}>{str}</li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div className="feedback-col weaknesses-col">
                                        <h4>⚠️ Areas for Improvement</h4>
                                        <ul>
                                            {activeAnswer.evaluation.feedback?.weaknesses?.map((weak, idx) => (
                                                <li key={idx}>{weak}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>

                                <details className="reference-answer-expand">
                                    <summary>💡 View Ideal Reference Answer Guide</summary>
                                    <div className="reference-content">
                                        <p>{currentQ?.answer}</p>
                                    </div>
                                </details>
                            </div>
                        )}

                    </div>

                    {/* Navigation Bar Footer */}
                    <div className="practice-footer-nav">
                        <button 
                            className="nav-btn prev-btn"
                            onClick={() => setCurrentQIndex(idx => Math.max(0, idx - 1))}
                            disabled={currentQIndex === 0}
                        >
                            ← Previous Question
                        </button>

                        {activeSession.answers?.length > 0 && (
                            <button className="complete-btn" onClick={handleCompleteSession}>
                                🏁 Complete Mock Session & View Dashboard
                            </button>
                        )}

                        <button 
                            className="nav-btn next-btn"
                            onClick={() => setCurrentQIndex(idx => Math.min(flatQuestions.length - 1, idx + 1))}
                            disabled={currentQIndex === flatQuestions.length - 1}
                        >
                            Next Question →
                        </button>
                    </div>

                </div>

                {/* Exit Confirmation Modal */}
                {showLeaveModal && (
                    <div className="leave-modal-overlay">
                        <div className="leave-modal-card">
                            <h3>Leave Practice Session?</h3>
                            <p>Your submitted question evaluations are saved in history. Any unsaved typed response in the editor will be discarded.</p>
                            <div className="modal-actions">
                                <button className="btn-cancel" onClick={() => setShowLeaveModal(false)}>Cancel</button>
                                <button className="btn-confirm-leave" onClick={() => navigate(0)}>Leave Practice</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    return (
        <ErrorBoundary>
            <div style={{ minHeight: "100vh" }}>
                <Navbar />
                <div className='interview-page'>
                
                {/* Practice Mode Header Banner */}
                <div className="practice-mode-banner">
                    <div className="banner-info">
                        <h3>Mock Interview Practice Mode</h3>
                        <p>Evaluate your response quality, verbal expression, and topic strengths. Start a live text session or a voice-to-voice simulation.</p>
                    </div>
                    <div className="banner-actions">
                        <button className="start-practice-btn start-practice-btn--primary" onClick={handleStartSession}>
                            <svg className="btn-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                            Start Text-Based Practice
                        </button>
                        <button 
                            className="start-practice-btn start-practice-btn--secondary" 
                            onClick={() => navigate(`/voice-interview?reportId=${report._id}`)}
                        >
                            <svg className="btn-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
                            Start Voice Simulation
                        </button>
                    </div>
                </div>

                <div className='interview-layout'>

                    {/* ── Left Nav ── */}
                    <nav className='interview-nav'>
                        <div className="nav-content">
                            <p className='interview-nav__label'>Sections</p>
                            {NAV_ITEMS.map(item => (
                                <button
                                    key={item.id}
                                    className={`interview-nav__item ${activeNav === item.id ? 'interview-nav__item--active' : ''}`}
                                    onClick={() => setActiveNav(item.id)}
                                >
                                    <span className='interview-nav__icon'>{item.icon}</span>
                                    {item.label}
                                </button>
                            ))}
                        </div>
                        <div className="nav-actions">
                            <button
                                onClick={() => { getResumePdf(interviewId) }}
                                className='button primary-button nav-action-btn'
                            >
                                <svg height={"0.8rem"} style={{ marginRight: "0.4rem" }} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M10.6144 17.7956 11.492 15.7854C12.2731 13.9966 13.6789 12.5726 15.4325 11.7942L17.8482 10.7219C18.6162 10.381 18.6162 9.26368 17.8482 8.92277L15.5079 7.88394C13.7092 7.08552 12.2782 5.60881 11.5105 3.75894L10.6215 1.61673C10.2916.821765 9.19319.821767 8.8633 1.61673L7.97427 3.75892C7.20657 5.60881 5.77553 7.08552 3.97685 7.88394L1.63658 8.92277C.868537 9.26368.868536 10.381 1.63658 10.7219L4.0523 11.7942C5.80589 12.5726 7.21171 13.9966 7.99275 15.7854L8.8704 17.7956C9.20776 18.5682 10.277 18.5682 10.6144 17.7956ZM19.4014 22.6899 19.6482 22.1242C20.0882 21.1156 20.8807 20.3125 21.8695 19.8732L22.6299 19.5353C23.0412 19.3526 23.0412 18.7549 22.6299 18.5722L21.9121 18.2532C20.8978 17.8026 20.0911 16.9698 19.6586 15.9269L19.4052 15.3156C19.2285 14.8896 18.6395 14.8896 18.4628 15.3156L18.2094 15.9269C17.777 16.9698 16.9703 17.8026 15.956 18.2532L15.2381 18.5722C14.8269 18.7549 14.8269 19.3526 15.2381 19.5353L15.9985 19.8732C16.9874 20.3125 17.7798 21.1156 18.2198 22.1242L18.4667 22.6899C18.6473 23.104 19.2207 23.104 19.4014 22.6899Z"></path></svg>
                                Download Resume
                            </button>
                            <button
                                onClick={() => setIsPdfPreviewOpen(true)}
                                className='button primary-button nav-action-btn nav-action-btn--ai'
                            >
                                <span style={{ marginRight: "0.4rem" }}>🤖</span>
                                AI Analysis
                            </button>
                        </div>
                    </nav>

                    <div className='interview-divider' />

                    {/* ── Center Content ── */}
                    <main className='interview-content'>
                        {activeNav === 'technical' && (
                            <section>
                                <div className='content-header'>
                                    <h2>Technical Questions</h2>
                                    <span className='content-header__count'>{report.technicalQuestions.length} questions</span>
                                </div>
                                <div className='q-list'>
                                    {report.technicalQuestions.map((q, i) => (
                                        <QuestionCard key={i} item={q} index={i} />
                                    ))}
                                </div>
                            </section>
                        )}

                        {activeNav === 'behavioral' && (
                            <section>
                                <div className='content-header'>
                                    <h2>Behavioral Questions</h2>
                                    <span className='content-header__count'>{report.behavioralQuestions.length} questions</span>
                                </div>
                                <div className='q-list'>
                                    {report.behavioralQuestions.map((q, i) => (
                                        <QuestionCard key={i} item={q} index={i} />
                                    ))}
                                </div>
                            </section>
                        )}

                        {activeNav === 'roadmap' && (
                            <section>
                                <div className='content-header'>
                                    <h2>Preparation Road Map</h2>
                                    <span className='content-header__count'>{report.preparationPlan.length}-day plan</span>
                                </div>
                                <div className='roadmap-list'>
                                    {report.preparationPlan.map((day) => (
                                        <RoadMapDay key={day.day} day={day} />
                                    ))}
                                </div>
                            </section>
                        )}
                    </main>

                    <div className='interview-divider' />

                    {/* ── Right Sidebar ── */}
                    <aside className='interview-sidebar'>

                        {/* Match Score */}
                        <div className='match-score'>
                            <p className='match-score__label'>Match Score</p>
                            <div className={`match-score__ring ${scoreColor}`}>
                                <span className='match-score__value'>{report.matchScore}</span>
                                <span className='match-score__pct'>%</span>
                            </div>
                            <p className='match-score__sub'>Strong match for this role</p>
                        </div>

                        <div className='sidebar-divider' />

                        {/* Skill Gaps */}
                        <div className='skill-gaps'>
                            <p className='skill-gaps__label'>Skill Gaps</p>
                            <div className='skill-gaps__list'>
                                {report.skillGaps.map((gap, i) => (
                                    <span key={i} className={`skill-tag skill-tag--${gap.severity}`}>
                                        {gap.skill}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Session History snapshots logs */}
                        {progressHistory && progressHistory.length > 0 && (
                            <>
                                <div className="sidebar-divider" />
                                <div className="sidebar-history-snapshots">
                                    <p className="sidebar-history-snapshots__label">Practice History</p>
                                    <div className="snapshots-list">
                                        {progressHistory.map((snap, idx) => (
                                            <div 
                                                key={snap.interviewId} 
                                                className="snapshot-item"
                                                onClick={() => navigate(`/interview/${report._id}/dashboard?session=${snap.interviewId}`)}
                                            >
                                                <div className="snap-score">{snap.overallScore}%</div>
                                                <div className="snap-meta">
                                                    <span>Attempt #{idx + 1}</span>
                                                    <span className="date">{new Date(snap.date).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

                    </aside>
                </div>
            </div>

            {isPdfPreviewOpen && (
                <PdfPreview 
                    reportId={interviewId} 
                    onClose={() => setIsPdfPreviewOpen(false)}
                    onRegenerate={async () => {
                        if (!report) return;
                        addToast("Regenerating AI performance card report...", "info");
                        const data = await generateReport({
                            jobDescription: report.jobDescription,
                            selfDescription: report.selfDescription,
                            resumeText: report.resume
                        });
                        if (data && data._id) {
                            addToast("New report compiled successfully!", "success");
                            navigate(`/interview/${data._id}`);
                        }
                    }}
                />
            )}
            <ScrollToTop />
        </div>
    </ErrorBoundary>
    )
}

export default Interview