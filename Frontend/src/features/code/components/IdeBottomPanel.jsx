import React, { useState, useEffect, useRef } from "react";
import "./executionComponents.scss";

/**
 * HintRevealList component for progressive hints in AI Mentor tab
 */
const HintRevealList = ({ hints }) => {
    const [revealed, setRevealed] = useState(0);
    if (!hints || hints.length === 0) return null;

    return (
        <div className="hint-reveal-list">
            {hints.slice(0, revealed).map((h, i) => (
                <div key={i} className="hint-item">
                    <span className="hint-num">Hint {i + 1}</span>
                    <p>{h}</p>
                </div>
            ))}
            {revealed < hints.length && (
                <button
                    className="hint-reveal-btn"
                    onClick={() => setRevealed(r => r + 1)}
                    id={`revealHint_${revealed + 1}`}
                >
                    💡 Reveal Hint {revealed + 1} of {hints.length}
                </button>
            )}
        </div>
    );
};

/**
 * IdeBottomPanel — Integrated terminal and AI analysis panel for IDE layout.
 * 
 * Props:
 *   terminalLogs    {array}   — Array of log objects: { type, text }
 *   evaluationResult {object} — Result from submit: { aiMentor, submission, executionResult }
 *   onRunWithInput  {fn}      — Callback when user submits custom stdin
 *   isRunning       {boolean} — True if execution is in progress
 */
const IdeBottomPanel = ({ terminalLogs, evaluationResult, onRunWithInput, isRunning }) => {
    const [activeTab, setActiveTab] = useState("terminal");
    const [showInputPrompt, setShowInputPrompt] = useState(false);
    const [stdinValue, setStdinValue] = useState("");
    const terminalEndRef = useRef(null);

    const { aiMentor } = evaluationResult || {};

    // Auto-scroll terminal
    useEffect(() => {
        if (activeTab === "terminal" && terminalEndRef.current) {
            terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [terminalLogs, activeTab, showInputPrompt]);

    // Force terminal tab if AI tab is active but aiMentor disappears
    useEffect(() => {
        if (!aiMentor && activeTab === "ai") {
            setActiveTab("terminal");
        }
    }, [aiMentor, activeTab]);

    // Focus input when prompt opens
    useEffect(() => {
        if (showInputPrompt) {
            document.getElementById("terminalStdinInput")?.focus();
        }
    }, [showInputPrompt]);

    const handleInputSubmit = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            setShowInputPrompt(false);
            onRunWithInput(stdinValue);
            setStdinValue("");
        }
    };

    return (
        <div className="ide-bottom-panel" id="ideBottomPanel">
            <div className="ide-bottom-panel__header">
                <div className="panel-tabs">
                    <button 
                        className={`panel-tab ${activeTab === "terminal" ? "active" : ""}`}
                        onClick={() => setActiveTab("terminal")}
                    >
                        Terminal
                    </button>
                    {aiMentor && (
                        <button 
                            className={`panel-tab ${activeTab === "ai" ? "active" : ""}`}
                            onClick={() => setActiveTab("ai")}
                        >
                            ✨ AI Analysis
                        </button>
                    )}
                </div>
                <div className="panel-actions">
                    {activeTab === "terminal" && !showInputPrompt && (
                        <button 
                            className="terminal-action-btn"
                            onClick={() => setShowInputPrompt(true)}
                            title="Provide stdin before running"
                            disabled={isRunning}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4"/><polyline points="14 2 14 8 20 8"/><path d="M2 15h10"/><path d="M9 18l3-3-3-3"/></svg>
                            Stdin
                        </button>
                    )}
                </div>
            </div>

            <div className="ide-bottom-panel__content">
                {/* ── TERMINAL TAB ── */}
                <div style={{ display: activeTab === "terminal" ? "block" : "none", height: "100%" }}>
                    <div className="ide-terminal">
                        <div className="terminal-header-art" style={{ paddingBottom: "1rem", marginBottom: "1rem", borderBottom: "1px solid rgba(255,255,255,0.1)", color: "#a5b1c2", fontFamily: "monospace" }}>
                            <div>Terminal</div>
                            <div style={{ color: "rgba(255,255,255,0.2)" }}>────────────────────</div>
                            <div style={{ color: "#6366f1", fontWeight: "bold", marginTop: "0.5rem" }}>CareerPrep IDE v1.0</div>
                            <div style={{ color: "#2ecc71" }}>&gt; Initializing...</div>
                        </div>

                        {terminalLogs.length === 0 && !showInputPrompt && (
                            <div className="terminal-empty">Run your code to see output...</div>
                        )}
                        
                        {terminalLogs.map((log, i) => (
                            <div key={i} className={`terminal-line terminal-line--${log.type}`}>
                                {log.text}
                            </div>
                        ))}

                        {showInputPrompt && (
                            <div className="terminal-input-prompt">
                                <span className="prompt-indicator">&gt;</span>
                                <textarea 
                                    id="terminalStdinInput"
                                    value={stdinValue}
                                    onChange={(e) => setStdinValue(e.target.value)}
                                    onKeyDown={handleInputSubmit}
                                    placeholder="Type input and hit Enter to run..."
                                    rows={1}
                                    disabled={isRunning}
                                />
                            </div>
                        )}
                        <div ref={terminalEndRef} />
                    </div>
                </div>

                {/* ── AI MENTOR TAB ── */}
                {activeTab === "ai" && aiMentor && (
                    <div className="ide-ai-analysis">
                        <div className="mentor-card" id="mentorExplanation">
                            <h4>📝 Explanation</h4>
                            <p>{aiMentor.explanation}</p>
                        </div>

                        <div className="mentor-complexity" id="mentorComplexity">
                            <div className="complexity-chip">
                                <span className="chip-label">Time</span>
                                <code>{aiMentor.timeComplexity || "—"}</code>
                            </div>
                            <div className="complexity-chip">
                                <span className="chip-label">Space</span>
                                <code>{aiMentor.spaceComplexity || "—"}</code>
                            </div>
                        </div>

                        {aiMentor.codeQuality && (
                            <div className="mentor-card" id="mentorCodeQuality">
                                <h4>🎨 Code Quality</h4>
                                <p>{aiMentor.codeQuality}</p>
                            </div>
                        )}

                        {aiMentor.optimizations?.length > 0 && (
                            <div className="mentor-card" id="mentorOptimizations">
                                <h4>⚡ Optimizations</h4>
                                <ul>
                                    {aiMentor.optimizations.map((opt, i) => (
                                        <li key={i}>{opt}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {aiMentor.edgeCases?.length > 0 && (
                            <div className="mentor-card" id="mentorEdgeCases">
                                <h4>🔍 Edge Cases to Consider</h4>
                                <ul>
                                    {aiMentor.edgeCases.map((ec, i) => (
                                        <li key={i}>{ec}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {aiMentor.progressiveHints?.length > 0 && (
                            <div className="mentor-card" id="mentorHints">
                                <h4>💡 Progressive Hints</h4>
                                <HintRevealList hints={aiMentor.progressiveHints} />
                            </div>
                        )}

                        {aiMentor.interviewQuestions?.length > 0 && (
                            <div className="mentor-card" id="mentorInterviewQuestions">
                                <h4>🎯 Interview Follow-ups</h4>
                                <ul>
                                    {aiMentor.interviewQuestions.map((q, i) => (
                                        <li key={i}>{q}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {aiMentor.conceptToStudy && (
                            <div className="mentor-concept" id="mentorConceptToStudy">
                                📚 Study this: <strong>{aiMentor.conceptToStudy}</strong>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default IdeBottomPanel;
