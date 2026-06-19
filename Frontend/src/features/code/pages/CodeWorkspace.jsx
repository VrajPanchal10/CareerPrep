import React, { useState, useEffect } from "react";
import MonacoEditor from "@monaco-editor/react";
import { Link } from "react-router";
import Navbar from "../../ats/components/Navbar";
import {
    fetchQuestions,
    fetchQuestionById,
    generateQuestion,
    submitSolution,
    fetchSubmissions
} from "../services/code.api";
import "../style/code.scss";

// Boilerplate templates per language to improve user experience
const BOILERPLATE_TEMPLATES = {
    javascript: `// Write your JavaScript solution here\n\nfunction solution() {\n    // your code\n    return;\n}`,
    typescript: `// Write your TypeScript solution here\n\nfunction solution(): any {\n    // your code\n    return;\n}`,
    python: `# Write your Python solution here\n\ndef solution():\n    # your code\n    pass`,
    java: `// Write your Java solution here\n\npublic class Solution {\n    public static void main(String[] args) {\n        // your code\n    }\n}`,
    cpp: `// Write your C++ solution here\n#include <iostream>\nusing namespace std;\n\nint main() {\n    // your code\n    return 0;\n}`,
    c: `// Write your C solution here\n#include <stdio.h>\n\nint main() {\n    // your code\n    return 0;\n}`
};

const TOPICS = [
    "Arrays",
    "Strings",
    "Linked Lists",
    "Stacks",
    "Queues",
    "Trees",
    "Graphs",
    "Dynamic Programming",
    "Recursion",
    "Hashing",
    "Searching",
    "Sorting",
    "JavaScript",
    "React",
    "Node.js"
];

const CodeWorkspace = () => {
    const [questions, setQuestions] = useState([]);
    const [selectedTopic, setSelectedTopic] = useState("Arrays");
    const [selectedDifficulty, setSelectedDifficulty] = useState("Easy");
    const [activeQuestion, setActiveQuestion] = useState(null);
    const [language, setLanguage] = useState("javascript");
    const [code, setCode] = useState(BOILERPLATE_TEMPLATES.javascript);
    const [theme, setTheme] = useState("vs-dark");
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isGeneratingQuestion, setIsGeneratingQuestion] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [evaluationResult, setEvaluationResult] = useState(null);
    const [showHints, setShowHints] = useState(false);
    const [previousAttempts, setPreviousAttempts] = useState([]);
    const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    // Load questions on topic selection
    useEffect(() => {
        loadQuestions();
    }, [selectedTopic]);

    // Update boilerplate when language changes, if the editor is untouched
    useEffect(() => {
        const isUntouched = Object.values(BOILERPLATE_TEMPLATES).some(tpl => tpl.trim() === code.trim());
        if (isUntouched || code === "") {
            setCode(BOILERPLATE_TEMPLATES[language] || "");
        }
    }, [language]);

    // Load attempts for active question
    useEffect(() => {
        if (activeQuestion) {
            loadPreviousAttempts(activeQuestion._id);
            setShowHints(false);
            setEvaluationResult(null);
        }
    }, [activeQuestion]);

    const loadQuestions = async () => {
        setIsLoadingQuestions(true);
        setErrorMsg("");
        try {
            const data = await fetchQuestions({ topic: selectedTopic });
            if (data.success) {
                setQuestions(data.questions);
            }
        } catch (err) {
            console.error("Failed to load questions", err);
            setErrorMsg("Could not fetch coding questions.");
        } finally {
            setIsLoadingQuestions(false);
        }
    };

    const loadPreviousAttempts = async (qId) => {
        try {
            const data = await fetchSubmissions(qId);
            if (data.success) {
                setPreviousAttempts(data.submissions);
            }
        } catch (err) {
            console.error("Failed to load submissions", err);
        }
    };

    const handleGenerateAIQuestion = async () => {
        setIsGeneratingQuestion(true);
        setErrorMsg("");
        try {
            const data = await generateQuestion(selectedTopic, selectedDifficulty);
            if (data.success) {
                setQuestions(prev => [data.question, ...prev]);
                setActiveQuestion(data.question);
            }
        } catch (err) {
            console.error(err);
            setErrorMsg("Failed to generate AI coding question. Please try again.");
        } finally {
            setIsGeneratingQuestion(false);
        }
    };

    const handleCopyCode = () => {
        navigator.clipboard.writeText(code);
        alert("Code copied to clipboard!");
    };

    const handleResetCode = () => {
        if (window.confirm("Are you sure you want to reset the editor to the boilerplate?")) {
            setCode(BOILERPLATE_TEMPLATES[language] || "");
        }
    };

    const handleSubmitCode = async () => {
        if (!activeQuestion) return;
        setIsSubmitting(true);
        setErrorMsg("");
        try {
            const data = await submitSolution({
                questionId: activeQuestion._id,
                language,
                code
            });
            if (data.success) {
                setEvaluationResult(data.submission);
                loadPreviousAttempts(activeQuestion._id); // reload history list
            }
        } catch (err) {
            console.error(err);
            setErrorMsg(err.response?.data?.message || "Failed to submit and evaluate solution.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const getDifficultyClass = (diff) => {
        if (!diff) return "";
        if (diff.toLowerCase() === "easy") return "badge-diff--easy";
        if (diff.toLowerCase() === "medium") return "badge-diff--medium";
        return "badge-diff--hard";
    };

    return (
        <div className="code-workspace-container">
            <Navbar />
            
            <header className="coding-header">
                <div className="header-left">
                    <h1>Monaco Code Editor Evaluator</h1>
                    <p>Select a coding challenge or generate one, write your solution, and receive instant AI grading.</p>
                </div>
                <div className="header-right">
                    <Link to="/code/dashboard" className="dash-link-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
                        Coding Analytics Dashboard
                    </Link>
                </div>
            </header>

            {errorMsg && (
                <div style={{ background: "rgba(192, 41, 43, 0.15)", border: "1px solid #c0392b", color: "#c0392b", margin: "1rem 1.5rem", padding: "0.75rem 1.2rem", borderRadius: "6px", fontSize: "0.88rem" }}>
                    <strong>Error:</strong> {errorMsg}
                </div>
            )}

            <main className="workspace-layout">
                {/* Left Panel: Question Panel */}
                <section className="question-panel" id="questionPanel">
                    {!activeQuestion ? (
                        <>
                            <div className="question-panel__header">
                                <div className="topic-selector-container">
                                    <select
                                        value={selectedTopic}
                                        onChange={(e) => setSelectedTopic(e.target.value)}
                                        id="topicSelect"
                                    >
                                        {TOPICS.map(topic => (
                                            <option key={topic} value={topic}>{topic}</option>
                                        ))}
                                    </select>
                                    <select
                                        value={selectedDifficulty}
                                        onChange={(e) => setSelectedDifficulty(e.target.value)}
                                        id="diffSelect"
                                    >
                                        <option value="Easy">Easy</option>
                                        <option value="Medium">Medium</option>
                                        <option value="Hard">Hard</option>
                                    </select>
                                    <button 
                                        onClick={handleGenerateAIQuestion} 
                                        className="generate-ai-btn"
                                        disabled={isGeneratingQuestion}
                                        id="generateAiQuestionBtn"
                                    >
                                        {isGeneratingQuestion ? "Generating..." : "Generate AI"}
                                    </button>
                                </div>
                            </div>
                            <div className="question-panel__body">
                                <h3 style={{ margin: "0 0 1rem 0", fontSize: "1rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                    {selectedTopic} Challenges
                                </h3>
                                {isLoadingQuestions ? (
                                    <p style={{ color: "rgba(255,255,255,0.4)" }}>Loading coding questions...</p>
                                ) : questions.length === 0 ? (
                                    <p style={{ color: "rgba(255,255,255,0.4)" }}>No questions found in this category. Generate a custom one with the AI button above!</p>
                                ) : (
                                    <div className="question-list-selector">
                                        {questions.map(q => (
                                            <button
                                                key={q._id}
                                                onClick={() => setActiveQuestion(q)}
                                                className="question-item-btn"
                                                id={`q-item-${q._id}`}
                                            >
                                                <div>
                                                    <div style={{ fontWeight: "700" }}>{q.title}</div>
                                                    <div className="q-meta">
                                                        <span className={`badge-diff ${getDifficultyClass(q.difficulty)}`}>{q.difficulty}</span>
                                                        <span className="badge-topic">{q.topic}</span>
                                                    </div>
                                                </div>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="question-panel__body active-question">
                            <button onClick={() => setActiveQuestion(null)} className="back-to-list-btn" id="backToQuestionsBtn">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                                Back to challenges
                            </button>

                            <div className="q-badges">
                                <span className={`badge-diff ${getDifficultyClass(activeQuestion.difficulty)}`}>{activeQuestion.difficulty}</span>
                                <span className="badge-topic">{activeQuestion.topic}</span>
                            </div>

                            <h2 className="q-title" id="questionTitle">{activeQuestion.title}</h2>
                            
                            <div className="q-description" id="questionDescription">
                                {activeQuestion.description}
                            </div>

                            {activeQuestion.sampleInput && (
                                <div className="q-io-block">
                                    <h4>Sample Input</h4>
                                    <pre>{activeQuestion.sampleInput}</pre>
                                </div>
                            )}

                            {activeQuestion.sampleOutput && (
                                <div className="q-io-block">
                                    <h4>Sample Output</h4>
                                    <pre>{activeQuestion.sampleOutput}</pre>
                                </div>
                            )}

                            {activeQuestion.constraints && activeQuestion.constraints.length > 0 && (
                                <div className="q-io-block">
                                    <h4>Constraints</h4>
                                    <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.85rem", color: "#e0e0e0" }}>
                                        {activeQuestion.constraints.map((c, i) => <li key={i}>{c}</li>)}
                                    </ul>
                                </div>
                            )}

                            {/* Collapsible Hints Section */}
                            {activeQuestion.hints && activeQuestion.hints.length > 0 && (
                                <div className="q-hints-section">
                                    <button 
                                        onClick={() => setShowHints(!showHints)} 
                                        className="hint-header"
                                        id="revealHintBtn"
                                    >
                                        <span>💡 progressive hints</span>
                                        <span>{showHints ? "Hide" : "Show"}</span>
                                    </button>
                                    {showHints && (
                                        <div className="hint-content" id="hintsPanel">
                                            <ol>
                                                {activeQuestion.hints.map((hint, idx) => (
                                                    <li key={idx}>{hint}</li>
                                                ))}
                                            </ol>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Previous Attempts Section */}
                            <div style={{ marginTop: "2rem" }}>
                                <h3 style={{ fontSize: "0.88rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px", color: "rgba(255,255,255,0.4)", marginBottom: "0.8rem", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "0.4rem" }}>
                                    Previous Attempts
                                </h3>
                                {previousAttempts.length === 0 ? (
                                    <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.4)" }}>No submissions logged for this challenge yet.</p>
                                ) : (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }} id="attemptsList">
                                        {previousAttempts.map(sub => (
                                            <div 
                                                key={sub._id} 
                                                onClick={() => {
                                                    setEvaluationResult(sub);
                                                    setCode(sub.submittedCode);
                                                }}
                                                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "6px", padding: "0.6rem 0.8rem", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", fontSize: "0.85rem" }}
                                            >
                                                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                                                    <span style={{ fontWeight: "700", color: sub.overallScore >= 75 ? "#2ecc71" : sub.overallScore >= 60 ? "#f1c40f" : "#e74c3c" }}>
                                                        {sub.overallScore}%
                                                    </span>
                                                    <span style={{ color: "rgba(255,255,255,0.4)" }}>({sub.language})</span>
                                                </div>
                                                <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)" }}>
                                                    {new Date(sub.createdAt).toLocaleDateString()}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </section>

                {/* Right Panel: Monaco Code Editor */}
                <section className={`editor-panel ${isFullscreen ? "fullscreen" : ""}`} id="editorPanel">
                    <div className="editor-panel__toolbar">
                        <div className="tools-left">
                            <select
                                value={language}
                                onChange={(e) => setLanguage(e.target.value)}
                                id="languageSelect"
                            >
                                <option value="javascript">JavaScript</option>
                                <option value="typescript">TypeScript</option>
                                <option value="python">Python</option>
                                <option value="java">Java</option>
                                <option value="cpp">C++</option>
                                <option value="c">C</option>
                            </select>
                            <select
                                value={theme}
                                onChange={(e) => setTheme(e.target.value)}
                                id="themeSelect"
                            >
                                <option value="vs-dark">Dark Theme</option>
                                <option value="light">Light Theme</option>
                            </select>
                        </div>
                        <div className="tools-right">
                            <button onClick={handleCopyCode} className="tool-btn" id="copyCodeBtn" title="Copy to Clipboard">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                Copy
                            </button>
                            <button onClick={handleResetCode} className="tool-btn" id="resetCodeBtn" title="Reset Code Template">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                                Reset
                            </button>
                            <button onClick={() => setIsFullscreen(!isFullscreen)} className="tool-btn" id="fullscreenToggleBtn">
                                {isFullscreen ? (
                                    <>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7"/></svg>
                                        Exit
                                    </>
                                ) : (
                                    <>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3M10 21V10H21"/></svg>
                                        Fullscreen
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="editor-panel__editor-container" id="monacoEditorContainer">
                        <MonacoEditor
                            height="100%"
                            language={language}
                            theme={theme}
                            value={code}
                            onChange={(val) => setCode(val || "")}
                            options={{
                                automaticLayout: true,
                                fontSize: 14,
                                fontFamily: "'Fira Code', 'Consolas', monospace",
                                minimap: { enabled: false },
                                scrollBeyondLastLine: false,
                                lineNumbers: "on",
                                wordWrap: "on"
                            }}
                        />
                    </div>

                    <div className="editor-panel__footer">
                        <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.4)" }}>
                            {activeQuestion ? `Solving: ${activeQuestion.title}` : "Select a question first"}
                        </div>
                        <button
                            onClick={handleSubmitCode}
                            disabled={!activeQuestion || isSubmitting}
                            className="submit-btn"
                            id="submitSolutionBtn"
                        >
                            {isSubmitting ? (
                                <>
                                    <span className="spinner" style={{ display: "inline-block", width: "12px", height: "12px", border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.6s linear infinite", marginRight: "5px" }} />
                                    AI Evaluating...
                                </>
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                    Submit Code
                                </>
                            )}
                        </button>
                    </div>

                    {/* AI Evaluation Report Panel */}
                    {evaluationResult && (
                        <div className="evaluation-overlay" id="evaluationOverlay">
                            <div className="evaluation-overlay__header">
                                <h3>AI Code Evaluation Report</h3>
                                <button onClick={() => setEvaluationResult(null)} className="close-btn" id="closeEvaluationBtn">×</button>
                            </div>
                            <div className="evaluation-overlay__body">
                                <div className="eval-grid">
                                    <div className="overall-score-circle">
                                        <div className="radial-gauge">
                                            <svg width="130" height="130">
                                                <circle className="bg-circle" cx="65" cy="65" r="60" />
                                                <circle 
                                                    className="fill-circle" 
                                                    cx="65" 
                                                    cy="65" 
                                                    r="60" 
                                                    strokeDashoffset={377 - (377 * evaluationResult.overallScore) / 100}
                                                />
                                            </svg>
                                            <div className="score-text" id="overallScoreText">{evaluationResult.overallScore}%</div>
                                        </div>
                                        <div className="status-label">Overall Score</div>
                                    </div>
                                    <div className="breakdown-bars">
                                        <div className="bar-item">
                                            <div className="bar-label">
                                                <span>Correctness</span>
                                                <span id="correctnessScoreText">{evaluationResult.correctnessScore}%</span>
                                            </div>
                                            <div className="bar-track">
                                                <div className="bar-fill" style={{ width: `${evaluationResult.correctnessScore}%` }} />
                                            </div>
                                        </div>
                                        <div className="bar-item">
                                            <div className="bar-label">
                                                <span>Readability & Structure</span>
                                                <span id="readabilityScoreText">{evaluationResult.readabilityScore}%</span>
                                            </div>
                                            <div className="bar-track">
                                                <div className="bar-fill" style={{ width: `${evaluationResult.readabilityScore}%` }} />
                                            </div>
                                        </div>
                                        <div className="bar-item">
                                            <div className="bar-label">
                                                <span>Time & Space Complexity</span>
                                                <span id="complexityScoreText">{evaluationResult.complexityScore}%</span>
                                            </div>
                                            <div className="bar-track">
                                                <div className="bar-fill" style={{ width: `${evaluationResult.complexityScore}%` }} />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="feedback-lists">
                                        <div className="list-card strengths" id="strengthsList">
                                            <h4>✅ Strengths</h4>
                                            <ul>
                                                {evaluationResult.strengths?.map((str, idx) => <li key={idx}>{str}</li>)}
                                                {(!evaluationResult.strengths || evaluationResult.strengths.length === 0) && <li>No specific strengths logged.</li>}
                                            </ul>
                                        </div>
                                        <div className="list-card weaknesses" id="weaknessesList">
                                            <h4>⚠️ Weaknesses</h4>
                                            <ul>
                                                {evaluationResult.weaknesses?.map((weak, idx) => <li key={idx}>{weak}</li>)}
                                                {(!evaluationResult.weaknesses || evaluationResult.weaknesses.length === 0) && <li>No critical weaknesses found.</li>}
                                            </ul>
                                        </div>
                                        <div className="list-card suggestions" id="suggestionsList">
                                            <h4>💡 Suggestions</h4>
                                            <ul>
                                                {evaluationResult.suggestions?.map((sug, idx) => <li key={idx}>{sug}</li>)}
                                                {(!evaluationResult.suggestions || evaluationResult.suggestions.length === 0) && <li>No specific optimizations suggested.</li>}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
};

export default CodeWorkspace;
