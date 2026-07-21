import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import Navbar from "../../ats/components/Navbar";
import { useGithubDefense } from "../hooks/useGithubDefense";
import { useGithubOAuth } from "../hooks/useGithubOAuth";
import "../style/githubDashboard.scss";
import { 
    LoadingButton, 
    SkeletonDashboard, 
    EmptyState, 
    ScrollToTop, 
    ErrorBoundary, 
    ProgressTimeline, 
    useToast,
    AnalyticsFilters,
    RepositoryHistory
} from "../../../components/ui";
import GitHubStatusBar from "../components/GitHubStatusBar";
import GitHubConnectPanel from "../components/GitHubConnectPanel";
import RepositoryPicker from "../components/RepositoryPicker";
import DevLogger from "../../../utils/devLogger";

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

    const {
        isConnected,
        githubUser,
        repositories,
        reposLoading,
        repoTotal,
        rateLimitStatus,
        statusLoading,
        disconnecting,
        error: oauthError,
        connect,
        disconnect,
        fetchRepositories
    } = useGithubOAuth();

    const [repoUrl, setRepoUrl] = useState("");
    const [selectedAnalysisId, setSelectedAnalysisId] = useState("");
    const [activeTab, setActiveTab] = useState("snapshot");
    const [interviewLength, setInterviewLength] = useState("Quick");
    const [initialLoading, setInitialLoading] = useState(true);
    const [analyzingRepo, setAnalyzingRepo] = useState(null); // fullName of repo being analyzed

    // Large repository confirmation state
    const [largeRepoInfo, setLargeRepoInfo] = useState(null); // { owner, repo, sizeMb, sizeTier }

    // Progress timeline states
    const [scrapeStage, setScrapeStage] = useState("connecting");
    const [filesCount, setFilesCount] = useState(0);
    const [activeFile, setActiveFile] = useState("");
    const [activeFolder, setActiveFolder] = useState("");
    const [isScraping, setIsScraping] = useState(false);
    const { addToast } = useToast();

    const [filters, setFilters] = useState({ dateRange: "all", role: "all", type: "all", repo: "all" });

    const [deletedAnalysisIds, setDeletedAnalysisIds] = useState(() => {
        const saved = localStorage.getItem("careerprep_deleted_analysis_ids");
        return saved ? JSON.parse(saved) : [];
    });


    const handleDeleteAnalysis = (id) => {
        setDeletedAnalysisIds(prev => {
            const next = [...prev, id];
            localStorage.setItem("careerprep_deleted_analysis_ids", JSON.stringify(next));
            return next;
        });
        addToast("Repository analysis log deleted from history", "success");
        DevLogger.log("Repository Analysis", { action: "delete_log", repoId: id });
    };

    const activeAnalyses = (analyses || []).filter(a => !deletedAnalysisIds.includes(a._id));

    // Client-side filtering logic
    const filteredAnalyses = activeAnalyses.filter(item => {
        if (filters.dateRange !== "all") {
            const itemDate = new Date(item.createdAt || Date.now());
            const limit = new Date();
            if (filters.dateRange === "7days") limit.setDate(limit.getDate() - 7);
            else if (filters.dateRange === "30days") limit.setDate(limit.getDate() - 30);
            if (itemDate < limit) return false;
        }
        if (filters.type !== "all" && filters.type !== "github") {
            return false;
        }
        return true;
    });

    useEffect(() => {
        const initDashboard = async () => {
            await loadDashboard();
            setInitialLoading(false);
        };
        initDashboard();
    }, [loadDashboard]);

    // Set first analysis as selected by default when they load
    useEffect(() => {
        if (filteredAnalyses.length > 0 && !selectedAnalysisId) {
            setSelectedAnalysisId(filteredAnalyses[0]._id);
        }
    }, [filteredAnalyses, selectedAnalysisId]);

    const handleAnalyze = async (e, customRepoUrl) => {
        if (e && e.preventDefault) e.preventDefault();
        const targetUrl = customRepoUrl || repoUrl;
        if (!targetUrl) return;
        setIsScraping(true);
        setScrapeStage("connecting");
        setFilesCount(0);
        setActiveFile("");
        setActiveFolder("root/");
        setLargeRepoInfo(null);
        DevLogger.log("Repository Analysis", { action: "scrape_start", repoUrl: targetUrl });

        const timelineTimers = [];
        const setStageTimeout = (stage, delay, count, file, folder) => {
            const timer = setTimeout(() => {
                setScrapeStage(stage);
                if (count !== undefined) setFilesCount(count);
                if (file !== undefined) setActiveFile(file);
                if (folder !== undefined) setActiveFolder(folder);
            }, delay);
            timelineTimers.push(timer);
        };

        setStageTimeout("fetching", 1200, 0, "", "root/git-tree");
        setStageTimeout("reading", 2600, 2, "package.json", "src/");
        setStageTimeout("parsing", 4500, 10, "src/index.js", "src/routes/");
        setStageTimeout("parsing", 6500, 18, "src/controllers/auth.js", "src/controllers/");
        setStageTimeout("ai", 9000, 24, "src/models/user.js", "src/models/");
        setStageTimeout("report", 13000, 32, "Generating architecture graph...", "db/");

        try {
            addToast("Triggering deep repository analysis...", "info");
            // Token is now resolved server-side — never sent from frontend
            const result = await triggerAnalysis({ repoUrl: targetUrl });

            // Handle large repository confirmation
            if (result && result.requiresConfirmation) {
                timelineTimers.forEach(clearTimeout);
                setScrapeStage("connecting");
                setIsScraping(false);
                // Parse owner/repo from URL for force-confirm flow
                const urlMatch = targetUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
                if (urlMatch) {
                    setLargeRepoInfo({ owner: urlMatch[1], repo: urlMatch[2], repoUrl: targetUrl, sizeMb: result.sizeMb, sizeTier: result.sizeTier });
                }
                return;
            }

            timelineTimers.forEach(clearTimeout);
            setScrapeStage("completed");
            setFilesCount(42);
            setActiveFile("");
            setActiveFolder("Completed!");
            
            setSelectedAnalysisId(result._id);
            setRepoUrl("");
            addToast(result.cached ? "Returning cached analysis." : "Auditing complete! Performance snapshot compiled.", "success");
            DevLogger.log("Repository Analysis", { action: "scrape_success", repoId: result._id });
        } catch (err) {
            timelineTimers.forEach(clearTimeout);
            setScrapeStage("connecting");
            addToast(err.message || "Failed to analyze codebase.", "error");
            DevLogger.log("Repository Analysis", { action: "scrape_failed", error: err.message });
        } finally {
            setIsScraping(false);
        }
    };

    // Force analysis on large repo after user confirms
    const handleForceAnalyze = async () => {
        if (!largeRepoInfo) return;
        setLargeRepoInfo(null);
        setIsScraping(true);
        setScrapeStage("connecting");
        try {
            addToast("Proceeding with large repository analysis...", "info");
            const result = await triggerAnalysis({ owner: largeRepoInfo.owner, repo: largeRepoInfo.repo, forceAnalysis: true });
            setScrapeStage("completed");
            setSelectedAnalysisId(result._id);
            addToast("Large repository analysis complete!", "success");
        } catch (err) {
            setScrapeStage("connecting");
            addToast(err.message || "Analysis failed.", "error");
        } finally {
            setIsScraping(false);
        }
    };

    // Called from RepositoryPicker when user clicks Analyze on a connected repo
    const handlePickerAnalyze = async (repo) => {
        if (analyzingRepo) return;
        setAnalyzingRepo(repo.fullName);
        setLargeRepoInfo(null);
        setIsScraping(true);
        setScrapeStage("connecting");
        DevLogger.log("Repository Analysis", { action: "picker_start", repo: repo.fullName });

        const timelineTimers = [];
        const setStageTimeout = (stage, delay) => {
            const timer = setTimeout(() => setScrapeStage(stage), delay);
            timelineTimers.push(timer);
        };
        setStageTimeout("fetching", 800);
        setStageTimeout("reading", 2000);
        setStageTimeout("parsing", 4000);
        setStageTimeout("ai", 7000);
        setStageTimeout("report", 12000);

        try {
            addToast(`Analyzing ${repo.name}...`, "info");
            const result = await triggerAnalysis({ owner: repo.owner, repo: repo.name });

            if (result && result.requiresConfirmation) {
                timelineTimers.forEach(clearTimeout);
                setScrapeStage("connecting");
                setIsScraping(false);
                setAnalyzingRepo(null);
                setLargeRepoInfo({ owner: repo.owner, repo: repo.name, repoUrl: repo.htmlUrl, sizeMb: result.sizeMb, sizeTier: result.sizeTier });
                return;
            }

            timelineTimers.forEach(clearTimeout);
            setScrapeStage("completed");
            setSelectedAnalysisId(result._id);
            addToast(result.cached ? `Returning cached analysis for ${repo.name}.` : `${repo.name} analyzed!`, "success");
            DevLogger.log("Repository Analysis", { action: "picker_success", repoId: result._id });
        } catch (err) {
            timelineTimers.forEach(clearTimeout);
            setScrapeStage("connecting");
            addToast(err.message || `Failed to analyze ${repo.name}.`, "error");
        } finally {
            setIsScraping(false);
            setAnalyzingRepo(null);
        }
    };

    const handleReanalyze = ({ repoUrl }) => {
        handleAnalyze(null, repoUrl);
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

    if (initialLoading) {
        return (
            <div style={{ minHeight: "100vh", background: "#0a0a0a" }}>
                <Navbar />
                <main className="git-dashboard-page" style={{ padding: "2rem" }}>
                    <SkeletonDashboard />
                </main>
            </div>
        );
    }

    return (
        <ErrorBoundary>
            <div style={{ minHeight: "100vh", background: "#0a0a0a" }}>
                <Navbar />
                
                <main className="git-dashboard-page">
                    <header className="git-header">
                        <h1>🛡️ GitHub <span className="highlight">Project Defense</span></h1>
                        <p>Audit repository structures and defend architectural decisions in tough technical mock simulations.</p>
                    </header>

                    <div style={{ padding: "0 2rem", marginBottom: "1.5rem" }}>
                        <AnalyticsFilters onFilterChange={setFilters} />
                    </div>

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
                        {/* Left Sidebar: GitHub OAuth + Repository Picker + History */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>

                            {/* GitHub Status Bar — shown when connected */}
                            {isConnected && githubUser && (
                                <GitHubStatusBar
                                    githubUser={githubUser}
                                    rateLimitStatus={rateLimitStatus}
                                    onDisconnect={disconnect}
                                    disconnecting={disconnecting}
                                />
                            )}

                            {/* Large repository confirmation dialog */}
                            {largeRepoInfo && (
                                <div className="repo-confirm-dialog">
                                    <h4>⚠️ Large Repository ({largeRepoInfo.sizeMb} MB)</h4>
                                    <p>
                                        This repository is larger than usual. Analysis will take longer and use more GitHub API quota. Do you want to proceed?
                                    </p>
                                    <div className="repo-confirm-dialog__actions">
                                        <button
                                            className="repo-confirm-dialog__confirm-btn"
                                            onClick={handleForceAnalyze}
                                            id="confirmLargeRepoBtn"
                                        >
                                            Yes, Analyze Anyway
                                        </button>
                                        <button
                                            className="repo-confirm-dialog__cancel-btn"
                                            onClick={() => setLargeRepoInfo(null)}
                                            id="cancelLargeRepoBtn"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Connected: Repository Picker */}
                            {!statusLoading && isConnected && (
                                <div className="git-card">
                                    <h2>Select Repository</h2>
                                    <RepositoryPicker
                                        repositories={repositories}
                                        loading={reposLoading}
                                        total={repoTotal}
                                        onFetch={fetchRepositories}
                                        onAnalyze={handlePickerAnalyze}
                                        analyzingRepo={analyzingRepo}
                                    />
                                </div>
                            )}

                            {/* Not connected: Connect Panel */}
                            {!statusLoading && !isConnected && (
                                <GitHubConnectPanel
                                    onConnect={connect}
                                    loading={statusLoading}
                                    error={oauthError}
                                />
                            )}

                            {/* Public Repository URL fallback (always available) */}
                            <div className="git-card">
                                <h2>
                                    Public Repository URL
                                    <span style={{ fontSize: "0.7rem", fontWeight: 400, color: "rgba(255,255,255,0.4)", marginLeft: "0.5rem" }}>
                                        No login required
                                    </span>
                                </h2>
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
                                    <LoadingButton 
                                        type="submit" 
                                        loading={loading}
                                        loadingText="Analyzing..."
                                        className="submit-btn" 
                                        id="repoSubmitBtn"
                                    >
                                        🔍 Analyze Repository
                                    </LoadingButton>
                                </form>
                            </div>

                            {isScraping && (
                                <ProgressTimeline 
                                    currentStage={scrapeStage}
                                    filesAnalyzed={filesCount}
                                    currentFile={activeFile}
                                    currentFolder={activeFolder}
                                />
                            )}

                        {/* Analysis History Card */}
                        <div className="git-card micro-interactive-card">
                            <h2>My Repositories</h2>
                            <RepositoryHistory 
                                analyses={filteredAnalyses}
                                selectedAnalysisId={selectedAnalysisId}
                                onSelect={setSelectedAnalysisId}
                                onReanalyze={handleReanalyze}
                                onDelete={handleDeleteAnalysis}
                            />
                        </div>
                        </div>
                        {/* end left sidebar column */}

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
                        {/* end right panel */}
                    </div>
                    {/* end git-grid */}
                </main>
                <ScrollToTop />
            </div>
        </ErrorBoundary>
    );
};

export default GithubDashboard;
