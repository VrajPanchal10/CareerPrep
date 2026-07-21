import React, { useState } from "react";
import "./executionComponents.scss";

/**
 * ExecutionResultPanel — two-section results display after code submission.
 *
 * Section 1: Judge0 objective results (verdict, test cases, runtime, memory)
 * Section 2: Gemini AI mentor report (coaching, complexity, hints, interview Qs)
 *
 * Props:
 *   result  {object}  — Full API response: { executionResult, aiMentor, submission }
 *   onClose {fn}
 */

const VERDICT_CONFIG = {
    ACCEPTED:          { icon: "✅", label: "Accepted",             cls: "verdict--accepted" },
    WRONG_ANSWER:      { icon: "❌", label: "Wrong Answer",         cls: "verdict--wrong" },
    COMPILATION_ERROR: { icon: "🔴", label: "Compilation Error",    cls: "verdict--compile" },
    RUNTIME_ERROR:     { icon: "⚠️", label: "Runtime Error",        cls: "verdict--runtime" },
    TLE:               { icon: "⏱️", label: "Time Limit Exceeded",  cls: "verdict--tle" },
    MLE:               { icon: "💾", label: "Memory Limit Exceeded",cls: "verdict--mle" },
    NO_TESTS:          { icon: "🔵", label: "No Tests Available",   cls: "verdict--info" },
    INTERNAL_ERROR:    { icon: "🛑", label: "Internal Error",       cls: "verdict--compile" }
};

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

const ExecutionResultPanel = ({ result, onClose }) => {
    const [activeTab, setActiveTab] = useState("execution");

    const handleCopy = (text) => {
        navigator.clipboard.writeText(text);
    };

    const handleDownload = (text, filename) => {
        const blob = new Blob([text], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (!result) return null;

    const { executionResult, aiMentor, submission, cached } = result;
    const verdict = executionResult?.verdict;
    const cfg     = VERDICT_CONFIG[verdict] || { icon: "🔵", label: verdict || "Unknown", cls: "verdict--info" };

    const formatMemory = (kb) => {
        if (!kb) return "—";
        return kb < 1024 ? `${kb} KB` : `${(kb / 1024).toFixed(1)} MB`;
    };

    return (
        <div className="exec-result-panel" id="executionResultPanel" role="dialog" aria-label="Code Evaluation Report">
            <div className="exec-result-panel__header">
                <div className="exec-result-panel__title-row">
                    <h3>Evaluation Report</h3>
                    {cached && <span className="cached-badge" title="Returned from cache">⚡ Cached</span>}
                </div>
                <button className="close-btn" onClick={onClose} id="closeResultPanelBtn" aria-label="Close">×</button>
            </div>

            {/* Tabs */}
            <div className="exec-result-tabs" role="tablist">
                <button
                    role="tab"
                    aria-selected={activeTab === "execution"}
                    className={`exec-tab ${activeTab === "execution" ? "exec-tab--active" : ""}`}
                    onClick={() => setActiveTab("execution")}
                    id="tabExecution"
                >
                    ⚙️ Execution
                </button>
                <button
                    role="tab"
                    aria-selected={activeTab === "mentor"}
                    className={`exec-tab ${activeTab === "mentor" ? "exec-tab--active" : ""}`}
                    onClick={() => setActiveTab("mentor")}
                    id="tabMentor"
                >
                    🤖 AI Mentor
                </button>
            </div>

            <div className="exec-result-panel__body">

                {/* ── EXECUTION TAB ─────────────────────────────────────────── */}
                {activeTab === "execution" && (
                    <div className="exec-section">
                        {/* Verdict Banner */}
                        <div className={`verdict-banner ${cfg.cls}`} role="status" aria-live="polite">
                            <span className="verdict-icon">{cfg.icon}</span>
                            <div>
                                <div className="verdict-label">{cfg.label}</div>
                                <div className="verdict-score">
                                    Execution Score: <strong>{executionResult?.executionScore ?? 0}%</strong>
                                </div>
                            </div>
                        </div>

                        {/* Compilation Error */}
                        {executionResult?.compilationError && (
                            <div className="compile-error-block" id="compileErrorBlock">
                                <h4>Compilation Error</h4>
                                <pre>{executionResult.compilationError}</pre>
                            </div>
                        )}

                        {/* Runtime Stats */}
                        {!executionResult?.compilationError && (
                            <div className="exec-stats-row" aria-label="Execution statistics">
                                <div className="exec-stat">
                                    <span className="stat-label">Avg Runtime</span>
                                    <span className="stat-value" id="avgRuntimeStat">
                                        {executionResult?.avgRuntimeMs ? `${executionResult.avgRuntimeMs}ms` : "—"}
                                    </span>
                                </div>
                                <div className="exec-stat">
                                    <span className="stat-label">Avg Memory</span>
                                    <span className="stat-value" id="avgMemoryStat">
                                        {formatMemory(executionResult?.avgMemoryKb)}
                                    </span>
                                </div>
                                <div className="exec-stat">
                                    <span className="stat-label">Visible Tests</span>
                                    <span className="stat-value" id="visibleTestsStat">
                                        {executionResult?.visibleTestsPassed}/{executionResult?.visibleTestsTotal}
                                    </span>
                                </div>
                                {executionResult?.hiddenTestsTotal > 0 && (
                                    <div className="exec-stat">
                                        <span className="stat-label">Hidden Tests</span>
                                        <span className="stat-value" id="hiddenTestsStat">
                                            {executionResult?.hiddenTestsPassed}/{executionResult?.hiddenTestsTotal}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Visible Test Case Results */}
                        {(executionResult?.visibleTestResults || []).length > 0 && (
                            <div className="test-results" id="visibleTestResults">
                                <h4>Visible Test Cases</h4>
                                <div className="test-table">
                                    {(executionResult.visibleTestResults).map((tc, i) => (
                                        <div
                                            key={i}
                                            className={`test-row ${tc.passed ? "test-row--pass" : "test-row--fail"}`}
                                            id={`testCase_${i + 1}`}
                                        >
                                            <div className="test-row__header">
                                                <span className="test-status">
                                                    {tc.passed ? "✅" : "❌"} {tc.label || `Test ${i + 1}`}
                                                </span>
                                                <div className="test-meta">
                                                    {tc.timeMs && <span>{tc.timeMs}ms</span>}
                                                    {tc.memoryKb && <span>{formatMemory(tc.memoryKb)}</span>}
                                                    <span className={`tc-verdict tc-verdict--${tc.verdict?.toLowerCase()}`}>
                                                        {tc.statusLabel}
                                                    </span>
                                                </div>
                                            </div>
                                            {!tc.passed && (
                                                <div className="test-row__details">
                                                    {tc.input && (
                                                        <div className="io-block">
                                                            <span className="io-label">Input</span>
                                                            <pre>{tc.input}</pre>
                                                        </div>
                                                    )}
                                                    <div className="io-block">
                                                        <span className="io-label">Expected</span>
                                                        <pre>{tc.expectedOutput || "(empty)"}</pre>
                                                    </div>
                                                    <div className="io-block io-block--got">
                                                        <div className="output-header" style={{display: 'flex', justifyContent: 'space-between'}}>
                                                            <span className="io-label">Got</span>
                                                            <div>
                                                                <button onClick={() => handleCopy(tc.actualOutput || "")} style={{background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '0.75rem', marginRight: '8px'}}>Copy</button>
                                                                <button onClick={() => handleDownload(tc.actualOutput || "", `test_${i+1}_output.txt`)} style={{background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '0.75rem'}}>Download</button>
                                                            </div>
                                                        </div>
                                                        <pre>{tc.actualOutput || "(no output)"}</pre>
                                                    </div>
                                                    {tc.stderr && (
                                                        <div className="io-block io-block--error">
                                                            <span className="io-label">StdErr</span>
                                                            <pre>{tc.stderr.slice(0, 400)}</pre>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                {/* Hidden test summary */}
                                {executionResult?.hiddenTestsTotal > 0 && (
                                    <div className="hidden-tests-summary" aria-label="Hidden test results summary">
                                        🔒 Hidden Tests: <strong>{executionResult.hiddenTestsPassed}/{executionResult.hiddenTestsTotal}</strong> passed
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Legacy score bars (backward compat display) */}
                        {submission && (
                            <div className="legacy-scores" id="legacyScores">
                                <h4>Score Breakdown</h4>
                                <div className="score-bars">
                                    {[
                                        { label: "Correctness", value: submission.correctnessScore },
                                        { label: "Readability", value: submission.readabilityScore },
                                        { label: "Complexity",  value: submission.complexityScore }
                                    ].map(({ label, value }) => (
                                        <div className="score-bar-item" key={label}>
                                            <div className="bar-label-row">
                                                <span>{label}</span>
                                                <span id={`${label.toLowerCase()}Score`}>{value}%</span>
                                            </div>
                                            <div className="bar-track">
                                                <div className="bar-fill" style={{ width: `${value}%` }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="overall-score-row">
                                    Overall: <strong id="overallScoreText">{submission.overallScore}%</strong>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── AI MENTOR TAB ─────────────────────────────────────────── */}
                {activeTab === "mentor" && (
                    <div className="mentor-section">
                        {!aiMentor ? (
                            <p className="mentor-unavailable">AI mentor report unavailable.</p>
                        ) : (
                            <>
                                {/* Explanation */}
                                <div className="mentor-card" id="mentorExplanation">
                                    <h4>📝 Explanation</h4>
                                    <p>{aiMentor.explanation}</p>
                                </div>

                                {/* Complexity */}
                                <div className="mentor-complexity" id="mentorComplexity">
                                    <div className="complexity-chip">
                                        <span className="chip-label">Time</span>
                                        <code id="timeComplexity">{aiMentor.timeComplexity || "—"}</code>
                                    </div>
                                    <div className="complexity-chip">
                                        <span className="chip-label">Space</span>
                                        <code id="spaceComplexity">{aiMentor.spaceComplexity || "—"}</code>
                                    </div>
                                </div>

                                {/* Code Quality */}
                                {aiMentor.codeQuality && (
                                    <div className="mentor-card" id="mentorCodeQuality">
                                        <h4>🎨 Code Quality</h4>
                                        <p>{aiMentor.codeQuality}</p>
                                    </div>
                                )}

                                {/* Optimizations */}
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

                                {/* Edge Cases */}
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

                                {/* Progressive Hints */}
                                {aiMentor.progressiveHints?.length > 0 && (
                                    <div className="mentor-card" id="mentorHints">
                                        <h4>💡 Progressive Hints</h4>
                                        <HintRevealList hints={aiMentor.progressiveHints} />
                                    </div>
                                )}

                                {/* Interview Questions */}
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

                                {/* Concept to Study */}
                                {aiMentor.conceptToStudy && (
                                    <div className="mentor-concept" id="mentorConceptToStudy">
                                        📚 Study this: <strong>{aiMentor.conceptToStudy}</strong>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ExecutionResultPanel;
