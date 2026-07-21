import React, { useState } from "react";
import "./executionComponents.scss";

/**
 * CustomInputPanel — inline panel for running code with custom stdin.
 * Never saves a submission. Never calls AI. Purely Judge0 execution.
 *
 * Props:
 *   onRun     {(stdin: string) => Promise<void>}  — parent handles the API call
 *   result    {object|null}                        — { verdict, stdout, stderr, timeMs, memoryKb }
 *   isRunning {boolean}
 */
const CustomInputPanel = ({ onRun, result, isRunning }) => {
    const [stdin, setStdin] = useState("");
    const [expanded, setExpanded] = useState(false);

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

    const handleRun = () => {
        if (!expanded) setExpanded(true);
        onRun(stdin);
    };

    const VERDICT_ICON = {
        ACCEPTED:          "✅",
        WRONG_ANSWER:      "❌",
        COMPILATION_ERROR: "🔴",
        RUNTIME_ERROR:     "⚠️",
        TLE:               "⏱️",
        MLE:               "💾"
    };

    return (
        <div className="custom-input-panel" id="customInputPanel">
            <div className="custom-input-panel__header">
                <button
                    className="custom-input-toggle"
                    onClick={() => setExpanded(e => !e)}
                    aria-expanded={expanded}
                    id="toggleCustomInputBtn"
                >
                    {expanded ? "▼" : "▶"} Custom Input
                </button>
                <button
                    className="run-btn"
                    onClick={handleRun}
                    disabled={isRunning}
                    id="runCustomInputBtn"
                    title="Run with custom input (no submission saved)"
                >
                    {isRunning ? (
                        <><span className="btn-spinner" aria-hidden="true" /> Running…</>
                    ) : (
                        <>▶ Run</>
                    )}
                </button>
            </div>

            {expanded && (
                <div className="custom-input-panel__body">
                    <div className="stdin-area">
                        <label htmlFor="customStdin" className="stdin-label">
                            stdin (custom input)
                        </label>
                        <textarea
                            id="customStdin"
                            className="stdin-textarea"
                            value={stdin}
                            onChange={e => setStdin(e.target.value)}
                            placeholder="Enter your custom input here…"
                            rows={4}
                            spellCheck={false}
                        />
                    </div>

                    {result && (
                        <div className="run-result" id="customRunResult" aria-live="polite">
                            <div className="run-result__verdict">
                                <span>{VERDICT_ICON[result.verdict] || "🔵"}</span>
                                <span className="run-verdict-label">{result.statusLabel || result.verdict}</span>
                                {result.timeMs != null && (
                                    <span className="run-meta">{result.timeMs}ms</span>
                                )}
                                {result.memoryKb != null && (
                                    <span className="run-meta">
                                        {result.memoryKb < 1024 ? `${result.memoryKb}KB` : `${(result.memoryKb / 1024).toFixed(1)}MB`}
                                    </span>
                                )}
                            </div>

                            {result.compileOutput && (
                                <div className="run-output run-output--error" id="compileOutputCustom">
                                    <span className="output-label">Compilation Error</span>
                                    <pre>{result.compileOutput}</pre>
                                </div>
                            )}
                            {result.stdout && (
                                <div className="run-output" id="stdoutCustom">
                                    <div className="output-header" style={{display: 'flex', justifyContent: 'space-between'}}>
                                        <span className="output-label">stdout</span>
                                        <div>
                                            <button onClick={() => handleCopy(result.stdout)} style={{background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '0.75rem', marginRight: '8px'}}>Copy</button>
                                            <button onClick={() => handleDownload(result.stdout, "output.txt")} style={{background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '0.75rem'}}>Download</button>
                                        </div>
                                    </div>
                                    <pre>{result.stdout}</pre>
                                </div>
                            )}
                            {result.stderr && (
                                <div className="run-output run-output--error" id="stderrCustom">
                                    <span className="output-label">stderr</span>
                                    <pre>{result.stderr.slice(0, 600)}</pre>
                                </div>
                            )}
                            {!result.stdout && !result.stderr && !result.compileOutput && (
                                <div className="run-output">
                                    <span className="output-label">Output</span>
                                    <pre>(no output)</pre>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default CustomInputPanel;
