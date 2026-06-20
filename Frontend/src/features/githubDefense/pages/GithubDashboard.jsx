import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import Navbar from "../../ats/components/Navbar";
import { useGithubDefense } from "../hooks/useGithubDefense";
import "../style/githubDashboard.scss";

const GithubDashboard = () => {
    const navigate = useNavigate();
    const {
        loading,
        error,
        analyses,
        dashboard,
        loadDashboard,
        triggerAnalysis,
        startInterview
    } = useGithubDefense();

    const [repoUrl, setRepoUrl] = useState("");
    const [githubToken, setGithubToken] = useState("");
    const [selectedAnalysisId, setSelectedAnalysisId] = useState("");
    const [activeTab, setActiveTab] = useState("snapshot");
    const [interviewLength, setInterviewLength] = useState("Quick"); // Quick, Standard, Deep

    useEffect(() => {
        loadDashboard();
    }, [loadDashboard]);

    // Set first analysis as selected by default when they load
    useEffect(() => {
        if (analyses.length > 0 && !selectedAnalysisId) {
            setSelectedAnalysisId(analyses[0]._id);
        }
    }, [analyses, selectedAnalysisId]);

    const handleAnalyze = async (e) => {
        e.preventDefault();
        if (!repoUrl) return;
        try {
            const analysis = await triggerAnalysis({ repoUrl, githubToken });
            setSelectedAnalysisId(analysis._id);
            setRepoUrl("");
            setGithubToken("");
        } catch (err) {
            // Error set in hook
        }
    };

    const handleStartInterview = async () => {
        if (!selectedAnalysisId) return;
        try {
            const session = await startInterview({
                repositoryAnalysisId: selectedAnalysisId,
                interviewLength
            });
            navigate(`/github-defense/room/${session._id}`);
        } catch (err) {
            // Error managed in hook
        }
    };

    const selectedAnalysis = analyses.find(a => a._id === selectedAnalysisId);

    // Filter dashboard metrics matching the selected repository
    const getRepoDashboard = () => {
        if (dashboard && selectedAnalysis && dashboard.repoName === selectedAnalysis.repoName) {
            return dashboard;
        }
        return null;
    };
    const currentDashboard = getRepoDashboard();

    return (
        <div style={{ minHeight: "100vh", background: "#0a0a0a" }}>
            <Navbar />
            
            <main className="git-dashboard-page">
                <header className="git-header">
                    <h1>🛡️ GitHub <span className="highlight">Project Defense</span></h1>
                    <p>Audit repository structures and defend architectural decisions in tough technical mock simulations.</p>
                </header>

                {error && (
                    <div style={{
                        background: "rgba(231, 76, 60, 0.1)",
                        border: "1px solid #e74c3c",
                        borderRadius: "8px",
                        padding: "1rem",
                        marginBottom: "2rem",
                        color: "#e74c3c",
                        fontSize: "0.9rem"
                    }}>
                        ⚠️ {error}
                    </div>
                )}

                <div className="git-grid">
                    {/* Left Sidebar: URL Submission & History */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
                        {/* URL Submission Card */}
                        <div className="git-card">
                            <h2>Submit Repository</h2>
                            <form className="analyze-section" onSubmit={handleAnalyze}>
                                <div className="form-group">
                                    <label htmlFor="repoUrl">GitHub URL</label>
                                    <input 
                                        type="url" 
                                        id="repoUrl" 
                                        placeholder="https://github.com/user/repo" 
                                        value={repoUrl}
                                        onChange={(e) => setRepoUrl(e.target.value)}
                                        required
                                        disabled={loading}
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="githubToken">
                                        GitHub Access Token <span style={{fontSize: "0.75rem", color: "rgba(255,255,255,0.3)"}}>(Optional for Private Repos)</span>
                                    </label>
                                    <input 
                                        type="password" 
                                        id="githubToken" 
                                        placeholder="ghp_xxxxxxxxxxxx" 
                                        value={githubToken}
                                        onChange={(e) => setGithubToken(e.target.value)}
                                        disabled={loading}
                                    />
                                </div>
                                <button className="submit-btn" type="submit" disabled={loading}>
                                    {loading ? "Analyzing..." : "🔍 Analyze Repository"}
                                </button>
                            </form>
                        </div>

                        {/* Analysis History Card */}
                        <div className="git-card">
                            <h2>My Repositories</h2>
                            {analyses.length === 0 ? (
                                <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.4)" }}>
                                    No repositories analyzed yet. Submit one above to start!
                                </p>
                            ) : (
                                <ul className="repos-list">
                                    {analyses.map(item => (
                                        <li 
                                            key={item._id}
                                            className={`repo-item ${item._id === selectedAnalysisId ? 'repo-item--active' : ''}`}
                                            onClick={() => setSelectedAnalysisId(item._id)}
                                        >
                                            <div className="repo-info">
                                                <h4>{item.repoName}</h4>
                                                <span>by {item.owner}</span>
                                            </div>
                                            <div className="repo-arrow">➔</div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                    {/* Right Main Panel: Audit & Results */}
                    <div>
                        {!selectedAnalysis ? (
                            <div className="git-card" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "350px", textAlign: "center" }}>
                                <div>
                                    <span style={{ fontSize: "3rem" }}>🚀</span>
                                    <h3 style={{ margin: "1rem 0 0.5rem 0" }}>Start Codebase Analysis</h3>
                                    <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.9rem" }}>Provide a GitHub URL on the left panel to scan project folders, frameworks, security standards, and trigger Mock defenses.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="dashboard-content">
                                {/* Section A: Project Snapshot & Launch Interview */}
                                <div className="git-card git-card__highlight mastery-overview-card">
                                    {currentDashboard ? (
                                        <div className="mastery-score-dial">
                                            <div className="dial-svg">
                                                <svg width="150" height="150" viewBox="0 0 100 100">
                                                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
                                                    <circle 
                                                        cx="50" 
                                                        cy="50" 
                                                        r="40" 
                                                        fill="transparent" 
                                                        stroke="#d20d3b" 
                                                        strokeWidth="6" 
                                                        strokeDasharray={`${currentDashboard.projectMasteryScore * 2.51} 251`}
                                                        strokeLinecap="round"
                                                        transform="rotate(-90 50 50)"
                                                    />
                                                </svg>
                                                <div className="dial-score-text">
                                                    <span className="num">{currentDashboard.projectMasteryScore}%</span>
                                                    <span className="label">Mastery</span>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="mastery-score-dial">
                                            <div className="dial-svg">
                                                <svg width="150" height="150" viewBox="0 0 100 100">
                                                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
                                                </svg>
                                                <div className="dial-score-text">
                                                    <span className="num">--</span>
                                                    <span className="label">No Score</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="mastery-details">
                                        <h3>{selectedAnalysis.repoName}</h3>
                                        <a href={selectedAnalysis.repoUrl} target="_blank" rel="noreferrer" className="repo-url-link">
                                            🔗 {selectedAnalysis.repoUrl}
                                        </a>
                                        <p>{selectedAnalysis.summary}</p>
                                        
                                        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "1.2rem", marginTop: "1rem" }}>
                                            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                                                <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", fontWeight: 700, uppercase: true }}>Defense Depth</span>
                                                <select 
                                                    value={interviewLength} 
                                                    onChange={(e) => setInterviewLength(e.target.value)}
                                                    style={{
                                                        background: "#151515",
                                                        border: "1px solid rgba(255,255,255,0.1)",
                                                        color: "#ffffff",
                                                        padding: "0.4rem 0.8rem",
                                                        borderRadius: "4px",
                                                        fontSize: "0.85rem",
                                                        outline: "none"
                                                    }}
                                                >
                                                    <option value="Quick">Quick Defense (5 Qs)</option>
                                                    <option value="Standard">Standard Defense (10 Qs)</option>
                                                    <option value="Deep">Deep Defense (15 Qs)</option>
                                                </select>
                                            </div>

                                            <button className="cta-btn" onClick={handleStartInterview} disabled={loading} style={{ alignSelf: "flex-end" }}>
                                                🛡️ Start Defense Mock
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Section B: Category Scorebars (If result exists) */}
                                {currentDashboard && (
                                    <div className="git-card">
                                        <h2>Mastery Breakdown</h2>
                                        <div className="scores-grid">
                                            <div className="score-bar-card">
                                                <span className="score-title">Architecture</span>
                                                <span className="score-value">{currentDashboard.architectureScore}%</span>
                                                <div className="bar-track">
                                                    <div className="bar-fill" style={{ width: `${currentDashboard.architectureScore}%` }}></div>
                                                </div>
                                            </div>
                                            <div className="score-bar-card">
                                                <span className="score-title">Security</span>
                                                <span className="score-value">{currentDashboard.securityScore}%</span>
                                                <div className="bar-track">
                                                    <div className="bar-fill" style={{ width: `${currentDashboard.securityScore}%` }}></div>
                                                </div>
                                            </div>
                                            <div className="score-bar-card">
                                                <span className="score-title">Database</span>
                                                <span className="score-value">{currentDashboard.databaseScore}%</span>
                                                <div className="bar-track">
                                                    <div className="bar-fill" style={{ width: `${currentDashboard.databaseScore}%` }}></div>
                                                </div>
                                            </div>
                                            <div className="score-bar-card">
                                                <span className="score-title">API Design</span>
                                                <span className="score-value">{currentDashboard.apiDesignScore}%</span>
                                                <div className="bar-track">
                                                    <div className="bar-fill" style={{ width: `${currentDashboard.apiDesignScore}%` }}></div>
                                                </div>
                                            </div>
                                            <div className="score-bar-card">
                                                <span className="score-title">Deployment</span>
                                                <span className="score-value">{currentDashboard.deploymentScore}%</span>
                                                <div className="bar-track">
                                                    <div className="bar-fill" style={{ width: `${currentDashboard.deploymentScore}%` }}></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Section C: Project Audit tabs */}
                                <div className="git-card">
                                    <div className="audit-tabs">
                                        <button 
                                            className={`tab-btn ${activeTab === 'snapshot' ? 'tab-btn--active' : ''}`}
                                            onClick={() => setActiveTab('snapshot')}
                                        >
                                            Project Snapshot
                                        </button>
                                        <button 
                                            className={`tab-btn ${activeTab === 'health' ? 'tab-btn--active' : ''}`}
                                            onClick={() => setActiveTab('health')}
                                        >
                                            Codebase Health
                                        </button>
                                        <button 
                                            className={`tab-btn ${activeTab === 'structure' ? 'tab-btn--active' : ''}`}
                                            onClick={() => setActiveTab('structure')}
                                        >
                                            Knowledge Graph
                                        </button>
                                        {currentDashboard && (
                                            <button 
                                                className={`tab-btn ${activeTab === 'trends' ? 'tab-btn--active' : ''}`}
                                                onClick={() => setActiveTab('trends')}
                                            >
                                                Strengths & Improvements
                                            </button>
                                        )}
                                    </div>

                                    {/* Tab 1: Project Snapshot */}
                                    {activeTab === 'snapshot' && (
                                        <div className="audit-tab-panel">
                                            <p><strong>Overview:</strong> {selectedAnalysis.projectSnapshot?.projectSummary}</p>
                                            <p><strong>Architecture Pattern:</strong> {selectedAnalysis.projectSnapshot?.architectureOverview}</p>
                                            <p><strong>Security Protocols:</strong> {selectedAnalysis.projectSnapshot?.securityOverview}</p>
                                            <p><strong>Deployment Stack:</strong> {selectedAnalysis.projectSnapshot?.deploymentOverview}</p>
                                            
                                            <div style={{ marginTop: "1rem" }}>
                                                <strong>Core Technologies:</strong>
                                                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.5rem" }}>
                                                    {selectedAnalysis.projectSnapshot?.techStack?.map((t, idx) => (
                                                        <span key={idx} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", fontSize: "0.78rem", padding: "0.25rem 0.6rem", borderRadius: "4px" }}>{t}</span>
                                                    ))}
                                                </div>
                                            </div>

                                            <div style={{ marginTop: "1.2rem" }}>
                                                <strong>Core Features:</strong>
                                                <ul style={{ marginTop: "0.4rem" }}>
                                                    {selectedAnalysis.projectSnapshot?.mainFeatures?.map((f, idx) => (
                                                        <li key={idx}>✓ {f}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    )}

                                    {/* Tab 2: Health Report */}
                                    {activeTab === 'health' && (
                                        <div className="audit-tab-panel" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                                            <div className="health-item strength">
                                                <h4>✓ Architectural Strengths</h4>
                                                <ul>
                                                    {selectedAnalysis.healthReport?.architectureStrengths?.map((item, idx) => (
                                                        <li key={idx}>{item}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                            <div className="health-item weakness">
                                                <h4>⚠ Architectural Weaknesses</h4>
                                                <ul>
                                                    {selectedAnalysis.healthReport?.architectureWeaknesses?.map((item, idx) => (
                                                        <li key={idx}>{item}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                            <div className="health-item security">
                                                <h4>🛑 Security Gaps</h4>
                                                <ul>
                                                    {selectedAnalysis.healthReport?.securityConcerns?.map((item, idx) => (
                                                        <li key={idx}>{item}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                            <div className="health-item scalability">
                                                <h4>⚡ Scalability Gaps</h4>
                                                <ul>
                                                    {selectedAnalysis.healthReport?.scalabilityConcerns?.map((item, idx) => (
                                                        <li key={idx}>{item}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    )}

                                    {/* Tab 3: Structure / Knowledge Graph */}
                                    {activeTab === 'structure' && (
                                        <div className="audit-tab-panel">
                                            <p><strong>Frontend stack:</strong> {selectedAnalysis.knowledgeGraph?.frontendStack?.join(", ") || "N/A"}</p>
                                            <p><strong>Backend stack:</strong> {selectedAnalysis.knowledgeGraph?.backendStack?.join(", ") || "N/A"}</p>
                                            <p><strong>Databases:</strong> {selectedAnalysis.knowledgeGraph?.database?.join(", ") || "N/A"}</p>
                                            <p><strong>Authentication:</strong> {selectedAnalysis.knowledgeGraph?.authentication?.join(", ") || "N/A"}</p>
                                            <p><strong>Services:</strong> {selectedAnalysis.knowledgeGraph?.services?.join(", ") || "N/A"}</p>
                                            <p><strong>API Routes:</strong> {selectedAnalysis.knowledgeGraph?.routes?.join(", ") || "N/A"}</p>
                                            <p><strong>Schemas/Models:</strong> {selectedAnalysis.knowledgeGraph?.models?.join(", ") || "N/A"}</p>
                                            <p><strong>External Integrations:</strong> {selectedAnalysis.knowledgeGraph?.externalApis?.join(", ") || "N/A"}</p>
                                            
                                            <div style={{ marginTop: "1rem" }}>
                                                <strong>Folder Layout:</strong>
                                                <pre style={{
                                                    background: "rgba(0,0,0,0.3)",
                                                    border: "1px solid rgba(255,255,255,0.05)",
                                                    padding: "0.75rem",
                                                    borderRadius: "6px",
                                                    fontSize: "0.8rem",
                                                    overflowX: "auto",
                                                    maxHeight: "200px"
                                                }}>{selectedAnalysis.knowledgeGraph?.folderStructure}</pre>
                                            </div>
                                        </div>
                                    )}

                                    {/* Tab 4: Mastery Feedback (Strengths/Weaknesses/Recs) */}
                                    {activeTab === 'trends' && currentDashboard && (
                                        <div className="audit-tab-panel" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                                            <div className="health-item strength">
                                                <h4>✓ Defense Strengths</h4>
                                                <ul>
                                                    {currentDashboard.feedback?.strengths?.map((item, idx) => (
                                                        <li key={idx}>{item}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                            <div className="health-item weakness">
                                                <h4>⚠ Defense Gaps</h4>
                                                <ul>
                                                    {currentDashboard.feedback?.weaknesses?.map((item, idx) => (
                                                        <li key={idx}>{item}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                            <div className="health-item scalability">
                                                <h4>📘 Interview Recommendations</h4>
                                                <ul>
                                                    {currentDashboard.feedback?.recommendations?.map((item, idx) => (
                                                        <li key={idx}>{item}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default GithubDashboard;
