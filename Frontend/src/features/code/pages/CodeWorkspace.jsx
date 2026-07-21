import React, { useState, useEffect, useCallback, useRef } from "react";
import MonacoEditor from "@monaco-editor/react";
import { Link } from "react-router";
import Navbar from "../../ats/components/Navbar";
import {
    fetchQuestions,
    generateQuestion,
    submitSolution,
    fetchSubmissions,
    runWithCustomInput,
    fetchVisibleTestCases,
    checkEngineHealth,
    fetchSupportedLanguages
} from "../services/code.api";
import "../style/code.scss";
import { HintReveal, useToast, ErrorBoundary, ScrollToTop } from "../../../components/ui";
import { useTheme } from "../../../context/ThemeContext";
import DevLogger from "../../../utils/devLogger";
import IdeBottomPanel from "../components/IdeBottomPanel";

// Boilerplate templates per language
const BOILERPLATE_TEMPLATES = {
    javascript: `// Write your JavaScript solution here\n\nfunction solution() {\n    // your code\n    return;\n}`,
    typescript: `// Write your TypeScript solution here\n\nfunction solution(): any {\n    // your code\n    return;\n}`,
    python: `# Write your Python solution here\n\ndef solution():\n    # your code\n    pass`,
    java: `// Write your Java solution here\npublic class Main {\n    public static void main(String[] args) {\n        // your code\n    }\n}`,
    cpp: `// Write your C++ solution here\n#include <iostream>\nusing namespace std;\n\nint main() {\n    // your code\n    return 0;\n}`,
    c: `// Write your C solution here\n#include <stdio.h>\n\nint main() {\n    // your code\n    return 0;\n}`,
    go: `// Write your Go solution here\npackage main\n\nimport "fmt"\n\nfunc main() {\n    // your code\n    fmt.Println("Hello, World!")\n}`,
    rust: `// Write your Rust solution here\nfn main() {\n    // your code\n    println!("Hello, World!");\n}`,
    kotlin: `// Write your Kotlin solution here\nfun main() {\n    // your code\n    println("Hello, World!")\n}`,
    csharp: `// Write your C# solution here\nusing System;\n\nclass Program {\n    static void Main() {\n        // your code\n    }\n}`
};

const TOPICS = [
    "Arrays", "Strings", "Linked Lists", "Stacks", "Queues",
    "Trees", "Graphs", "Dynamic Programming", "Recursion",
    "Hashing", "Searching", "Sorting", "JavaScript", "React", "Node.js"
];

const LANGUAGES = [
    { value: "javascript", label: "JavaScript" },
    { value: "typescript", label: "TypeScript" },
    { value: "python",     label: "Python" },
    { value: "java",       label: "Java" },
    { value: "cpp",        label: "C++" },
    { value: "c",          label: "C" },
    { value: "go",         label: "Go" },
    { value: "rust",       label: "Rust" },
    { value: "kotlin",     label: "Kotlin" },
    { value: "csharp",     label: "C#" }
];

const CodeWorkspace = () => {
    const [questions, setQuestions] = useState([]);
    const [selectedTopic, setSelectedTopic] = useState("Arrays");
    const [selectedDifficulty, setSelectedDifficulty] = useState("Easy");
    const [activeQuestion, setActiveQuestion] = useState(null);
    const [language, setLanguage] = useState("javascript");
    const [code, setCode] = useState(BOILERPLATE_TEMPLATES.javascript);
    const { theme: activeTheme } = useTheme();
    const theme = activeTheme === "light" ? "vs" : "vs-dark";
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isGeneratingQuestion, setIsGeneratingQuestion] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    
    // IDE state
    const [evaluationResult, setEvaluationResult] = useState(null);
    const [terminalLogs, setTerminalLogs] = useState([]);
    
    const [previousAttempts, setPreviousAttempts] = useState([]);
    const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [visibleTestCases, setVisibleTestCases] = useState([]);
    const [questionPanelTab, setQuestionPanelTab] = useState("description"); // "description" | "tests"
    const [engineStatus, setEngineStatus] = useState(null); // null | { healthy, latencyMs }
    const [availableLanguages, setAvailableLanguages] = useState(LANGUAGES);
    const abortControllerRef = useRef(null);
    const { addToast } = useToast();

    const addTerminalLog = useCallback((text, type = "info") => {
        setTerminalLogs(prev => [...prev, { text, type }]);
    }, []);

    // ── Check Judge0 health on mount ───────────────────────────────────────────
    useEffect(() => {
        setTerminalLogs([
            { text: "CareerPrep IDE Terminal v1.0", type: "system" },
            { text: "Initializing execution engine...", type: "system" }
        ]);

        checkEngineHealth()
            .then(data => {
                setEngineStatus(data.engine);
                if (!data.engine?.healthy) {
                    addTerminalLog("⚠️ Warning: Execution engine is currently offline or unreachable.", "warning");
                } else {
                    addTerminalLog(`✅ Engine online connected (latency: ${data.engine.latencyMs}ms)`, "success");
                }
            })
            .catch(() => {
                setEngineStatus({ healthy: false });
                addTerminalLog("⚠️ Error: Could not reach code execution engine.", "error");
            });

        fetchSupportedLanguages().then(res => {
            if (res.success && res.languages?.length > 0) {
                setAvailableLanguages(res.languages.map(l => ({
                    value: l.key,
                    label: l.name,
                    monacoId: l.monacoId
                })));
            }
        }).catch(() => {});
    }, [addTerminalLog]);

    // ── Load questions on topic selection ─────────────────────────────────────
    useEffect(() => {
        loadQuestions();
    }, [selectedTopic]);

    // ── Restore draft / boilerplate on question or language change ────────────
    useEffect(() => {
        if (!activeQuestion) return;
        const draftKey = `careerprep_draft_${activeQuestion._id}_${language}`;
        const savedDraft = localStorage.getItem(draftKey);
        if (savedDraft) {
            setCode(savedDraft);
            addToast(`Restored draft for "${activeQuestion.title}" (${language.toUpperCase()})`, "success");
        } else {
            setCode(BOILERPLATE_TEMPLATES[language] || "");
        }
    }, [activeQuestion, language]);

    // ── Debounced auto-save ────────────────────────────────────────────────────
    useEffect(() => {
        if (!activeQuestion || !code) return;
        const isBoilerplate = BOILERPLATE_TEMPLATES[language] === code;
        if (isBoilerplate) return;
        const draftKey = `careerprep_draft_${activeQuestion._id}_${language}`;
        const t = setTimeout(() => {
            localStorage.setItem(draftKey, code);
            DevLogger.log("Coding Evaluation", { action: "draft_autosave", questionId: activeQuestion._id, language });
        }, 1500);
        return () => clearTimeout(t);
    }, [code, activeQuestion, language]);

    // ── Load attempts when question changes ───────────────────────────────────
    useEffect(() => {
        if (activeQuestion) {
            loadPreviousAttempts(activeQuestion._id);
            loadVisibleTestCases(activeQuestion._id);
            setEvaluationResult(null);
            setTerminalLogs([{ text: `Loaded challenge: ${activeQuestion.title}`, type: "system" }]);
        }
    }, [activeQuestion]);

    // ── Data loading ───────────────────────────────────────────────────────────
    const loadQuestions = async () => {
        setIsLoadingQuestions(true);
        setErrorMsg("");
        try {
            const data = await fetchQuestions({ topic: selectedTopic });
            if (data.success) setQuestions(data.questions);
        } catch (err) {
            setErrorMsg("Could not fetch coding questions.");
        } finally {
            setIsLoadingQuestions(false);
        }
    };

    const loadPreviousAttempts = async (qId) => {
        try {
            const data = await fetchSubmissions(qId);
            if (data.success) setPreviousAttempts(data.submissions);
        } catch (err) {
            console.error("Failed to load submissions", err);
        }
    };

    const loadVisibleTestCases = async (qId) => {
        try {
            const data = await fetchVisibleTestCases(qId);
            setVisibleTestCases(data.testCases || []);
        } catch (err) {
            setVisibleTestCases([]);
        }
    };

    // ── Actions ────────────────────────────────────────────────────────────────
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
            setErrorMsg("Failed to generate AI coding question. Please try again.");
        } finally {
            setIsGeneratingQuestion(false);
        }
    };

    const handleCopyCode = () => {
        navigator.clipboard.writeText(code);
        addToast("Code copied to clipboard!", "success");
    };

    const handleResetCode = () => {
        if (window.confirm("Reset the editor to the boilerplate template?")) {
            setCode(BOILERPLATE_TEMPLATES[language] || "");
            if (activeQuestion) {
                localStorage.removeItem(`careerprep_draft_${activeQuestion._id}_${language}`);
            }
            addToast("Workspace reset & draft cleared.", "info");
        }
    };

    // ── Execution Flow ──
    const handleRunCode = async (stdin = "") => {
        if (!activeQuestion) return;
        setIsRunning(true);
        setTerminalLogs([{ text: `> Running main.${language}...`, type: "system" }]);
        
        if (stdin) {
            addTerminalLog(`Provided stdin: ${stdin}`, "info");
        }
        
        addTerminalLog("Compiling...", "info");

        abortControllerRef.current = new AbortController();
        try {
            const data = await runWithCustomInput({ language, code, stdin, signal: abortControllerRef.current.signal });
            
            if (data.compileOutput) {
                addTerminalLog(`Compilation Error:\n${data.compileOutput}`, "error");
            } else {
                addTerminalLog("Running...", "info");
                
                if (data.stdout) {
                    addTerminalLog(data.stdout, "stdout");
                }
                if (data.stderr) {
                    addTerminalLog(data.stderr, "stderr");
                }
                
                if (!data.stdout && !data.stderr && data.verdict !== "COMPILATION_ERROR") {
                    addTerminalLog("(No output)", "info");
                }

                // Add nice execution statistics
                addTerminalLog(`----------------------------------------`, "system");
                addTerminalLog(`Exit Status: ${data.statusLabel || data.verdict}`, data.verdict === "ACCEPTED" ? "success" : "warning");
                if (data.timeMs != null) addTerminalLog(`Execution Time: ${data.timeMs}ms`, "info");
                if (data.memoryKb != null) addTerminalLog(`Memory Usage: ${data.memoryKb < 1024 ? data.memoryKb + " KB" : (data.memoryKb / 1024).toFixed(1) + " MB"}`, "info");
            }

        } catch (err) {
            const msg = err.response?.data?.message || "Execution failed.";
            addTerminalLog(`Run failed: ${msg}`, "error");
        } finally {
            setIsRunning(false);
            abortControllerRef.current = null;
        }
    };

    // Full Submit (against test cases)
    const handleSubmitCode = async () => {
        if (!activeQuestion) return;
        setIsSubmitting(true);
        setTerminalLogs([{ text: `> Submitting solution for ${activeQuestion.title}...`, type: "system" }]);
        addTerminalLog("Compiling...", "info");

        abortControllerRef.current = new AbortController();

        try {
            const data = await submitSolution({
                questionId: activeQuestion._id,
                language,
                code,
                signal: abortControllerRef.current.signal
            });

            if (data.success) {
                const exec = data.executionResult;
                
                if (exec.compilationError) {
                    addTerminalLog(`Compilation Error:\n${exec.compilationError}`, "error");
                } else {
                    addTerminalLog("Executing visible tests...", "system");
                    
                    if (exec.visibleTestResults) {
                        exec.visibleTestResults.forEach((tc, i) => {
                            if (tc.passed) {
                                addTerminalLog(`✅ Test ${i + 1} Passed (${tc.timeMs || 0}ms)`, "success");
                            } else {
                                addTerminalLog(`❌ Test ${i + 1} Failed (${tc.verdict || "Wrong Answer"})`, "error");
                                if (tc.input) addTerminalLog(`   Input: ${tc.input}`, "info");
                                addTerminalLog(`   Expected: ${tc.expectedOutput}`, "info");
                                addTerminalLog(`   Got: ${tc.actualOutput || "(empty)"}`, "error");
                                if (tc.stderr) addTerminalLog(`   Stderr: ${tc.stderr.slice(0, 100)}`, "stderr");
                            }
                        });
                    }

                    addTerminalLog(`----------------------------------------`, "system");
                    addTerminalLog(`Executing hidden tests...`, "system");
                    addTerminalLog(`Hidden tests result: ${exec.hiddenTestsPassed}/${exec.hiddenTestsTotal} passed.`, "info");

                    const verdict = exec.verdict || "UNKNOWN";
                    const score = exec.executionScore ?? 0;
                    
                    addTerminalLog(`Final Verdict: ${verdict}`, verdict === "ACCEPTED" ? "success" : "error");
                    addTerminalLog(`Overall Score: ${score}%`, verdict === "ACCEPTED" ? "success" : "warning");
                    
                    if (data.aiMentor) {
                        addTerminalLog(`AI Analysis generated. Check the AI Analysis tab.`, "system");
                    }
                }

                setEvaluationResult({
                    submission: data.submission,
                    executionResult: data.executionResult,
                    aiMentor: data.aiMentor,
                    cached: data.cached
                });

                loadPreviousAttempts(activeQuestion._id);
            }
        } catch (err) {
            const msg = err.response?.data?.message || "Failed to submit solution.";
            addTerminalLog(`Submit failed: ${msg}`, "error");
        } finally {
            setIsSubmitting(false);
            abortControllerRef.current = null;
        }
    };

    const handleStopExecution = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            addTerminalLog("🛑 Execution forcefully terminated by user.", "warning");
            setIsSubmitting(false);
            setIsRunning(false);
        }
    };

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                if (e.shiftKey) {
                    e.preventDefault();
                    if (!isSubmitting && activeQuestion) handleSubmitCode();
                } else {
                    e.preventDefault();
                    if (!isRunning && activeQuestion) handleRunCode();
                }
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isSubmitting, isRunning, activeQuestion, code, language]);

    const getDifficultyClass = (diff) => {
        if (!diff) return "";
        if (diff.toLowerCase() === "easy")   return "badge-diff--easy";
        if (diff.toLowerCase() === "medium") return "badge-diff--medium";
        return "badge-diff--hard";
    };

    const getScoreColor = (sub) => {
        const score = sub.executionScore > 0 ? sub.executionScore : sub.overallScore;
        return score >= 80 ? "#2ecc71" : score >= 60 ? "#f1c40f" : "#e74c3c";
    };

    const getDisplayScore = (sub) => sub.executionScore > 0 ? sub.executionScore : sub.overallScore;

    const getVerdictIcon = (verdict) => {
        const map = { ACCEPTED: "✅", WRONG_ANSWER: "❌", COMPILATION_ERROR: "🔴", RUNTIME_ERROR: "⚠️", TLE: "⏱️" };
        return map[verdict] || "🔵";
    };

    return (
        <ErrorBoundary>
            <div className="code-workspace-container">
                <Navbar />

                <header className="coding-header">
                    <div className="header-left">
                        <h1>Coding Assessment Engine</h1>
                        <p>
                            Write your solution · Run custom cases · Submit for evaluation
                            {engineStatus !== null && (
                                <span
                                    className={`engine-status-badge ${engineStatus.healthy ? "engine-status--online" : "engine-status--offline"}`}
                                    title={engineStatus.healthy ? `Execution engine online (${engineStatus.latencyMs}ms)` : "Execution engine offline"}
                                >
                                    {engineStatus.healthy ? "● Online" : "● Offline"}
                                </span>
                            )}
                        </p>
                    </div>
                    <div className="header-right">
                        <Link to="/code/dashboard" className="dash-link-btn">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
                            Coding Analytics
                        </Link>
                    </div>
                </header>

                {errorMsg && (
                    <div style={{ background: "rgba(192,41,43,0.15)", border: "1px solid #c0392b", color: "#c0392b", margin: "1rem 1.5rem", padding: "0.75rem 1.2rem", borderRadius: "6px", fontSize: "0.88rem" }}>
                        <strong>Error:</strong> {errorMsg}
                    </div>
                )}

                <main className="workspace-layout">
                    {/* ── Left Panel: Question ── */}
                    <section className="question-panel" id="questionPanel">
                        {!activeQuestion ? (
                            <>
                                <div className="question-panel__header">
                                    <div className="topic-selector-container">
                                        <select value={selectedTopic} onChange={e => setSelectedTopic(e.target.value)} id="topicSelect">
                                            {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                        <select value={selectedDifficulty} onChange={e => setSelectedDifficulty(e.target.value)} id="diffSelect">
                                            <option value="Easy">Easy</option>
                                            <option value="Medium">Medium</option>
                                            <option value="Hard">Hard</option>
                                        </select>
                                        <button onClick={handleGenerateAIQuestion} className="generate-ai-btn" disabled={isGeneratingQuestion} id="generateAiQuestionBtn">
                                            {isGeneratingQuestion ? "Generating…" : "Generate AI"}
                                        </button>
                                    </div>
                                </div>
                                <div className="question-panel__body">
                                    <h3 style={{ margin: "0 0 1rem 0", fontSize: "1rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                        {selectedTopic} Challenges
                                    </h3>
                                    {isLoadingQuestions ? (
                                        <p style={{ color: "rgba(255,255,255,0.4)" }}>Loading coding questions…</p>
                                    ) : questions.length === 0 ? (
                                        <p style={{ color: "rgba(255,255,255,0.4)" }}>No questions found. Generate a custom one above!</p>
                                    ) : (
                                        <div className="question-list-selector">
                                            {questions.map(q => (
                                                <button key={q._id} onClick={() => setActiveQuestion(q)} className="question-item-btn" id={`q-item-${q._id}`}>
                                                    <div>
                                                        <div style={{ fontWeight: "700" }}>{q.title}</div>
                                                        <div className="q-meta">
                                                            <span className={`badge-diff ${getDifficultyClass(q.difficulty)}`}>{q.difficulty}</span>
                                                            <span className="badge-topic">{q.topic}</span>
                                                            {q.testCases?.filter(tc => !tc.isHidden).length > 0 && (
                                                                <span className="badge-tests">{q.testCases.filter(tc => !tc.isHidden).length} tests</span>
                                                            )}
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

                                <div className="q-subtabs">
                                    <button
                                        className={`q-subtab ${questionPanelTab === "description" ? "q-subtab--active" : ""}`}
                                        onClick={() => setQuestionPanelTab("description")}
                                    >
                                        Description
                                    </button>
                                    <button
                                        className={`q-subtab ${questionPanelTab === "tests" ? "q-subtab--active" : ""}`}
                                        onClick={() => setQuestionPanelTab("tests")}
                                    >
                                        Test Cases {visibleTestCases.length > 0 && `(${visibleTestCases.length})`}
                                    </button>
                                </div>

                                {questionPanelTab === "description" && (
                                    <>
                                        <div className="q-description" id="questionDescription">{activeQuestion.description}</div>

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
                                        {activeQuestion.constraints?.length > 0 && (
                                            <div className="q-io-block">
                                                <h4>Constraints</h4>
                                                <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.85rem", color: "#e0e0e0" }}>
                                                    {activeQuestion.constraints.map((c, i) => <li key={i}>{c}</li>)}
                                                </ul>
                                            </div>
                                        )}
                                        {activeQuestion.hints?.length > 0 && (
                                            <HintReveal
                                                title={activeQuestion.title}
                                                hints={activeQuestion.hints}
                                            />
                                        )}
                                    </>
                                )}

                                {questionPanelTab === "tests" && (
                                    <div id="visibleTestCasesPanel">
                                        {visibleTestCases.length === 0 ? (
                                            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.85rem" }}>No visible test cases for this question.</p>
                                        ) : (
                                            <div className="visible-test-list">
                                                {visibleTestCases.map((tc, i) => (
                                                    <div key={i} className="visible-test-item" id={`visibleTC_${i + 1}`}>
                                                        <div className="visible-test-label">{tc.label || `Test Case ${i + 1}`}</div>
                                                        {tc.input && (
                                                            <div className="q-io-block">
                                                                <h4>Input</h4>
                                                                <pre>{tc.input}</pre>
                                                            </div>
                                                        )}
                                                        <div className="q-io-block">
                                                            <h4>Expected Output</h4>
                                                            <pre>{tc.expectedOutput}</pre>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Previous Attempts */}
                                <div style={{ marginTop: "2rem" }}>
                                    <h3 style={{ fontSize: "0.88rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px", color: "rgba(255,255,255,0.4)", marginBottom: "0.8rem", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "0.4rem" }}>
                                        Previous Attempts
                                    </h3>
                                    {previousAttempts.length === 0 ? (
                                        <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.4)" }}>No submissions yet.</p>
                                    ) : (
                                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }} id="attemptsList">
                                            {previousAttempts.map(sub => (
                                                <div
                                                    key={sub._id}
                                                    onClick={() => {
                                                        setEvaluationResult({
                                                            submission: sub,
                                                            executionResult: { verdict: sub.executionVerdict, executionScore: sub.executionScore || sub.overallScore },
                                                            aiMentor: sub.aiExplanation ? {
                                                                explanation:       sub.aiExplanation,
                                                                timeComplexity:    sub.timeComplexity,
                                                                spaceComplexity:   sub.spaceComplexity,
                                                                optimizations:     sub.optimizations,
                                                                edgeCases:         sub.edgeCases,
                                                                interviewQuestions: sub.interviewQuestions,
                                                                conceptToStudy:    sub.conceptToStudy,
                                                            } : null,
                                                            cached: false
                                                        });
                                                        setCode(sub.submittedCode);
                                                        setTerminalLogs([{ text: `Restored previous submission from ${new Date(sub.createdAt).toLocaleString()}`, type: "system" }]);
                                                    }}
                                                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "6px", padding: "0.6rem 0.8rem", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", fontSize: "0.85rem" }}
                                                >
                                                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                                                        {sub.executionVerdict && <span title={sub.executionVerdict}>{getVerdictIcon(sub.executionVerdict)}</span>}
                                                        <span style={{ fontWeight: "700", color: getScoreColor(sub) }}>
                                                            {getDisplayScore(sub)}%
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

                    {/* ── Right Panel: IDE Layout ── */}
                    <section className={`ide-panel ${isFullscreen ? "fullscreen" : ""}`} id="idePanel">
                        {/* Toolbar */}
                        <div className="ide-panel__toolbar">
                            <div className="tools-left">
                                <select value={language} onChange={e => setLanguage(e.target.value)} id="languageSelect">
                                    {availableLanguages.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                                </select>
                            </div>
                            <div className="tools-right">
                                <button onClick={handleCopyCode} className="tool-btn" title="Copy to Clipboard">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                    Copy
                                </button>
                                <button onClick={handleResetCode} className="tool-btn" title="Reset Template">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                                    Reset
                                </button>
                                <button
                                    onClick={() => handleRunCode()}
                                    disabled={!activeQuestion || isRunning}
                                    className="ide-run-btn"
                                >
                                    {isRunning ? "Running…" : "▶ Run"}
                                </button>
                                <button
                                    onClick={handleSubmitCode}
                                    disabled={!activeQuestion || isSubmitting}
                                    className="ide-submit-btn"
                                >
                                    {isSubmitting ? "Evaluating…" : "Submit"}
                                </button>
                                {(isRunning || isSubmitting) && (
                                    <button onClick={handleStopExecution} className="tool-btn" style={{color: "#ff4757", borderColor: "#ff4757"}}>Stop</button>
                                )}
                                <button onClick={() => setIsFullscreen(f => !f)} className="tool-btn">
                                    {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                                </button>
                            </div>
                        </div>

                        {/* Monaco Editor (Top Section) */}
                        <div className="ide-panel__editor" id="monacoEditorContainer">
                            <MonacoEditor
                                height="100%"
                                language={availableLanguages.find(l => l.value === language)?.monacoId || language}
                                theme={theme}
                                value={code}
                                onChange={val => setCode(val || "")}
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

                        {/* IDE Bottom Panel (Terminal + AI Analysis) */}
                        <IdeBottomPanel 
                            terminalLogs={terminalLogs}
                            evaluationResult={evaluationResult}
                            onRunWithInput={(stdin) => handleRunCode(stdin)}
                            isRunning={isRunning || isSubmitting}
                        />

                    </section>
                </main>
                <ScrollToTop />
            </div>
        </ErrorBoundary>
    );
};

export default CodeWorkspace;
