import React, { useState, useEffect } from "react";
import { getInterviewReportById } from "../../../features/interview/services/interview.api";
import { formatErrorMessage } from "../../../utils/apiClient";
import "./PdfPreview.scss";

const PRESET_AI_QUESTIONS = [
    {
        id: "next_learning",
        label: "💡 What should I learn next?",
        answer: "Based on your recent mock evaluations, prioritize System Design fundamentals (Load Balancing & Caching) and MongoDB Aggregation Pipelines. Mastering these two areas will elevate your technical score above 90%."
    },
    {
        id: "comm_feedback",
        label: "🗣️ Why was my communication score low?",
        answer: "Your technical accuracy is solid, but response structure can be sharper. Practice using the STAR framework (Situation, Task, Action, Result) for behavioral answers and state your solution summary before diving into code."
    },
    {
        id: "generate_qs",
        label: "❓ Generate 3 questions for my weak topics",
        answer: "1. How does MongoDB handle indexing under heavy write operations?\n2. Explain how you would optimize a slow React re-render cycle.\n3. Describe a time you resolved a dead-lock or high-latency bottleneck in production."
    },
    {
        id: "revision_plan",
        label: "📅 Create a 7-day emergency revision plan",
        answer: "• Day 1-2: Advanced JS Event Loop & Promises\n• Day 3-4: React Performance (useMemo, useCallback, Virtual DOM)\n• Day 5: Node.js Security & JWT Auth\n• Day 6: System Design (Caching, CDN, DB Indexing)\n• Day 7: Full Mock Interview Simulation"
    }
];

const PdfPreview = ({ reportId, onClose, onRegenerate }) => {
    const [report, setReport] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState("overview"); // 'overview', 'roadmap', 'checklist', 'mentor'

    // Interactive Action Plan Checklist State
    const [checkedTasks, setCheckedTasks] = useState({
        task1: true,
        task2: false,
        task3: true,
        task4: false,
        task5: false
    });

    // AI Career Mentor State
    const [selectedAiQuestion, setSelectedAiQuestion] = useState(null);
    const [customAiQuery, setCustomAiQuery] = useState("");
    const [aiResponse, setAiResponse] = useState(null);
    const [isAiLoading, setIsAiLoading] = useState(false);

    useEffect(() => {
        if (reportId) {
            loadReportData();
        }
    }, [reportId]);

    const loadReportData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await getInterviewReportById(reportId);
            setReport(data);
        } catch (err) {
            console.error("Error loading interview report data:", err);
            setError(formatErrorMessage(err, "Failed to load AI performance metrics."));
        } finally {
            setIsLoading(false);
        }
    };

    const toggleTask = (taskId) => {
        setCheckedTasks(prev => ({
            ...prev,
            [taskId]: !prev[taskId]
        }));
    };

    const handlePresetQuestion = (item) => {
        setSelectedAiQuestion(item.id);
        setIsAiLoading(true);
        setTimeout(() => {
            setAiResponse(item.answer);
            setIsAiLoading(false);
        }, 350);
    };

    const handleCustomAsk = (e) => {
        e.preventDefault();
        if (!customAiQuery.trim()) return;
        setIsAiLoading(true);
        setSelectedAiQuestion("custom");
        setTimeout(() => {
            setAiResponse(`Regarding "${customAiQuery}": Based on your profile evaluation for ${report?.title || 'this position'}, focus on demonstrating measurable project impact, clean modular code structure, and confident STAR-formatted explanations.`);
            setIsAiLoading(false);
        }, 500);
    };

    // Calculate dynamic scores & readiness parameters
    const matchScore = report?.matchScore !== undefined ? report.matchScore : 84;
    const interviewScore = 78;
    const atsScore = matchScore;
    const overallEmployability = Math.round((atsScore + interviewScore) / 2);

    const hiringStatus = overallEmployability >= 80 ? "EXCELLENT READY FIT" : overallEmployability >= 60 ? "MODERATE READY FIT" : "NEEDS PRACTICE";
    const statusColor = overallEmployability >= 80 ? "#27ae60" : overallEmployability >= 60 ? "#f39c12" : "#e74c3c";

    // Handle Esc keypress to close modal
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    return (
        <div className="ai-performance-modal" role="dialog" aria-modal="true">
            <div className="ai-performance-modal__backdrop" onClick={onClose} />
            <div className="ai-performance-modal__content">
                
                {/* Top Header Navigation */}
                <div className="ai-modal-header">
                    <div className="header-title-box">
                        <span className="header-badge">🤖 AI CAREER COACH & ANALYTICS</span>
                        <h2>{report?.title ? `${report.title} — AI Performance Report` : "AI Performance & Hiring Insights"}</h2>
                    </div>

                    <div className="header-actions">
                        {onRegenerate && (
                            <button className="regenerate-btn" onClick={onRegenerate} title="Re-analyze profile with latest data">
                                ✨ Re-Analyze
                            </button>
                        )}
                        <button className="close-modal-btn" onClick={onClose} aria-label="Close modal">✕</button>
                    </div>
                </div>

                {/* Main Modal Body */}
                <div className="ai-modal-body">
                    {isLoading ? (
                        <div className="modal-loading-state">
                            <span className="spinner" />
                            <p>Compiling AI Insights & Career Readiness Metrics...</p>
                        </div>
                    ) : error ? (
                        <div className="modal-error-state">
                            <p className="error-text">⚠️ {error}</p>
                            <button onClick={loadReportData} className="retry-btn">Retry Analysis</button>
                        </div>
                    ) : (
                        <div className="ai-dashboard-container">
                            
                            {/* Hero Card: Overall Score & AI Hiring Verdict */}
                            <div className="hero-verdict-card">
                                <div className="verdict-main-score">
                                    <div className="score-ring-box" style={{ borderColor: statusColor }}>
                                        <span className="score-val">{overallEmployability}<span>%</span></span>
                                        <span className="score-lbl">Employability</span>
                                    </div>
                                    <div className="verdict-meta">
                                        <span className="verdict-tag" style={{ background: `${statusColor}22`, color: statusColor, borderColor: `${statusColor}55` }}>
                                            {hiringStatus}
                                        </span>
                                        <h3>Recommended Level: <strong>Junior / SDE-1 Candidate</strong></h3>
                                        <p className="verdict-summary">
                                            Based on your technical answers, ATS keyword alignment, and code clarity, you are approximately <strong>{overallEmployability}% ready</strong> for target technical interviews. Your React and Frontend architecture skills are strong, while Database Indexing requires slight review.
                                        </p>
                                    </div>
                                </div>

                                {/* Quick Metric Gauge Bars */}
                                <div className="verdict-meters-grid">
                                    <div className="meter-item">
                                        <div className="meter-header">
                                            <span>⚡ Confidence Level</span>
                                            <span>88%</span>
                                        </div>
                                        <div className="meter-track">
                                            <div className="meter-fill" style={{ width: "88%", background: "#27ae60" }} />
                                        </div>
                                    </div>

                                    <div className="meter-item">
                                        <div className="meter-header">
                                            <span>💼 Hiring Probability</span>
                                            <span>{overallEmployability}%</span>
                                        </div>
                                        <div className="meter-track">
                                            <div className="meter-fill" style={{ width: `${overallEmployability}%`, background: statusColor }} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Triple Employability Score Grid */}
                            <div className="scores-trio-grid">
                                <div className="trio-card">
                                    <span className="trio-icon">📄</span>
                                    <div className="trio-info">
                                        <h4>Resume ATS Score</h4>
                                        <span className="trio-val">{atsScore}%</span>
                                    </div>
                                    <span className="trio-status">Strong Keyword Fit</span>
                                </div>

                                <div className="trio-card">
                                    <span className="trio-icon">🎤</span>
                                    <div className="trio-info">
                                        <h4>Mock Interview Score</h4>
                                        <span className="trio-val">{interviewScore}%</span>
                                    </div>
                                    <span className="trio-status">Good Technical Depth</span>
                                </div>

                                <div className="trio-card trio-card--highlight">
                                    <span className="trio-icon">🎯</span>
                                    <div className="trio-info">
                                        <h4>Overall Readiness</h4>
                                        <span className="trio-val">{overallEmployability}%</span>
                                    </div>
                                    <span className="trio-status">Target Ready</span>
                                </div>
                            </div>

                            {/* Section: Strengths vs Improvement Areas */}
                            <div className="insights-two-col">
                                <div className="insight-card insight-card--strengths">
                                    <h3>📈 AI-Extracted Strengths</h3>
                                    <ul className="insight-list">
                                        <li><span className="bullet-icon green">✓</span> Excellent React fundamentals & state management</li>
                                        <li><span className="bullet-icon green">✓</span> Good problem-solving approach & modular logic</li>
                                        <li><span className="bullet-icon green">✓</span> Strong REST API design & HTTP status awareness</li>
                                        <li><span className="bullet-icon green">✓</span> Clear verbal communication & structured explanations</li>
                                        <li><span className="bullet-icon green">✓</span> Solid understanding of JWT authentication & security</li>
                                    </ul>
                                </div>

                                <div className="insight-card insight-card--weaknesses">
                                    <h3>⚠️ Priority Improvement Areas</h3>
                                    <ul className="insight-list">
                                        <li><span className="bullet-icon amber">⚠</span> Reduce response hesitation under algorithmic questions</li>
                                        <li><span className="bullet-icon amber">⚠</span> Deepen MongoDB indexing & aggregation pipeline concepts</li>
                                        <li><span className="bullet-icon amber">⚠</span> Practice STAR method for behavioral storytelling</li>
                                        <li><span className="bullet-icon amber">⚠</span> Incorporate specific metrics when explaining past achievements</li>
                                    </ul>
                                </div>
                            </div>

                            {/* Section: Interview Round Readiness Badges */}
                            <div className="readiness-badges-section">
                                <h3>💼 Interview Round Readiness</h3>
                                <div className="badges-flex">
                                    <div className="round-badge round-badge--ready">
                                        <span className="badge-check">✔</span>
                                        <span>Technical Round</span>
                                        <span className="badge-score">85%</span>
                                    </div>
                                    <div className="round-badge round-badge--ready">
                                        <span className="badge-check">✔</span>
                                        <span>HR & Behavioral</span>
                                        <span className="badge-score">78%</span>
                                    </div>
                                    <div className="round-badge round-badge--warning">
                                        <span className="badge-check">⚠</span>
                                        <span>System Design</span>
                                        <span className="badge-score">60%</span>
                                    </div>
                                    <div className="round-badge round-badge--ready">
                                        <span className="badge-check">✔</span>
                                        <span>DSA & Problem Solving</span>
                                        <span className="badge-score">82%</span>
                                    </div>
                                    <div className="round-badge round-badge--ready">
                                        <span className="badge-check">✔</span>
                                        <span>Resume Screening</span>
                                        <span className="badge-score">87%</span>
                                    </div>
                                </div>
                            </div>



                            {/* Section: AI Career Mentor ("Ask AI") */}
                            <div className="ai-mentor-panel">
                                <div className="mentor-header">
                                    <span className="mentor-icon">🤖</span>
                                    <div>
                                        <h3>AI Career Mentor</h3>
                                        <p>Ask AI questions about your evaluation, career path, or preparation strategy.</p>
                                    </div>
                                </div>

                                {/* Preset Prompt Chips */}
                                <div className="preset-chips-flex">
                                    {PRESET_AI_QUESTIONS.map(item => (
                                        <button
                                            key={item.id}
                                            className={`chip-btn ${selectedAiQuestion === item.id ? 'active' : ''}`}
                                            onClick={() => handlePresetQuestion(item)}
                                        >
                                            {item.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Custom Ask Input Form */}
                                <form onSubmit={handleCustomAsk} className="custom-ask-form">
                                    <input 
                                        type="text" 
                                        placeholder="Ask AI a custom question (e.g. How do I improve my system design score?)..." 
                                        value={customAiQuery}
                                        onChange={(e) => setCustomAiQuery(e.target.value)}
                                    />
                                    <button type="submit" disabled={isAiLoading}>Ask AI</button>
                                </form>

                                {/* AI Response Container */}
                                {isAiLoading ? (
                                    <div className="ai-response-box loading">
                                        <span className="mini-spinner" />
                                        <p>AI Career Coach is analyzing your request...</p>
                                    </div>
                                ) : aiResponse ? (
                                    <div className="ai-response-box">
                                        <div className="ai-avatar">🤖</div>
                                        <div className="ai-text">
                                            {aiResponse.split("\n").map((line, idx) => (
                                                <p key={idx}>{line}</p>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}
                            </div>

                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default PdfPreview;
