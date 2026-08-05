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
import ConfirmationModal from "../../../components/ui/ConfirmationModal/ConfirmationModal";
import GitHubStatusBar from "../components/GitHubStatusBar";
import GitHubConnectPanel from "../components/GitHubConnectPanel";
import RepositoryPicker from "../components/RepositoryPicker";
import DevLogger from "../../../utils/devLogger";
import { Shield, CheckCircle, ArrowLeft, ChevronDown, Cpu, Server, Database, Lock, Layers, Globe, Sparkles } from "lucide-react";

const GithubDashboard = () => {
    const navigate = useNavigate();
    const { addToast } = useToast();

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
        isConnecting,
        disconnecting,
        error: oauthError,
        connect,
        disconnect,
        fetchRepositories
    } = useGithubOAuth({ addToast });

    const [sidebarTab, setSidebarTab] = useState("picker"); // "picker" | "history"
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
            const date = new Date(item.createdAt);
            const now = new Date();
            if (filters.dateRange === "today" && date.toDateString() !== now.toDateString()) return false;
            if (filters.dateRange === "week" && (now - date) > 7 * 24 * 60 * 60 * 1000) return false;
            if (filters.dateRange === "month" && (now - date) > 30 * 24 * 60 * 60 * 1000) return false;
        }
        return true;
    });

    const [showDisconnectModal, setShowDisconnectModal] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        const initDashboard = async () => {
            await loadDashboard();
            setInitialLoading(false);
        };
        initDashboard();
    }, [loadDashboard]);

    const handleConfirmDisconnect = () => {
        setShowDisconnectModal(true);
    };

    const confirmDisconnect = async () => {
        setActionLoading(true);
        try {
            await disconnect();
            setShowDisconnectModal(false);
            addToast("GitHub account disconnected.", "success");
        } catch (err) {
            addToast("Failed to disconnect GitHub account.", "error");
        } finally {
            setActionLoading(false);
        }
    };

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
            <div className="git-dashboard-page">
                <Navbar />

                {/* Page Title Header */}
                <header className="git-header">
                    <div className="header-left">
                        <h1>GitHub <span className="highlight">Project Defense</span></h1>
                        <p>Audit repository structures and defend architectural decisions in tough technical mock simulations.</p>
                    </div>
                    <div className="header-right">
                        <button className="back-btn-ghost" onClick={() => navigate("/")} id="exitGithubDefenseBtn">
                            <ArrowLeft size={16} />
                            <span className="btn-text-full">Exit GitHub Defense</span>
                            <span className="btn-text-short">Exit</span>
                        </button>
                    </div>
                </header>

                {/* Global Analytics Filter Toolbar */}
                <div style={{ marginBottom: "1rem" }}>
                    <AnalyticsFilters filters={filters} onFilterChange={setFilters} />
                </div>

                <main>
                    <div className="git-grid">
                        {/* Unified Left Sidebar Column */}
                        <div className="git-grid__sidebar">

                            {/* GitHub Status Bar — shown when connected */}
                            {isConnected && githubUser && (
                                <GitHubStatusBar
                                    githubUser={githubUser}
                                    rateLimitStatus={rateLimitStatus}
                                    onDisconnect={handleConfirmDisconnect}
                                    disconnecting={disconnecting}
                                />
                            )}

                            {/* Large repository confirmation dialog */}
                            {largeRepoInfo && (
                                <div className="repo-confirm-dialog">
                                    <h4>⚠️ Large Repository ({largeRepoInfo.sizeMb} MB)</h4>
                                    <p>This repository is larger than usual. Proceed with analysis?</p>
                                    <div className="repo-confirm-dialog__actions">
                                        <button className="repo-confirm-dialog__confirm-btn" onClick={handleForceAnalyze} id="confirmLargeRepoBtn">
                                            Yes, Analyze Anyway
                                        </button>
                                        <button className="repo-confirm-dialog__cancel-btn" onClick={() => setLargeRepoInfo(null)} id="cancelLargeRepoBtn">
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Consolidated Repository Navigator Card */}
                            {!statusLoading && isConnected && (
                                <div className="git-card sidebar-nav-card">
                                    <h3 className="sidebar-card-title">Repositories</h3>
                                    <div className="sidebar-nav-tabs" role="tablist">
                                        <button
                                            className={`sidebar-nav-btn ${sidebarTab === "picker" ? "sidebar-nav-btn--active" : ""}`}
                                            onClick={() => setSidebarTab("picker")}
                                            role="tab"
                                            aria-selected={sidebarTab === "picker"}
                                        >
                                            📁 GitHub Repos {repoTotal ? <span className="tab-count-badge">{repoTotal}</span> : null}
                                        </button>
                                        <button
                                            className={`sidebar-nav-btn ${sidebarTab === "history" ? "sidebar-nav-btn--active" : ""}`}
                                            onClick={() => setSidebarTab("history")}
                                            role="tab"
                                            aria-selected={sidebarTab === "history"}
                                        >
                                            📜 History <span className="tab-count-badge">{filteredAnalyses.length}</span>
                                        </button>
                                    </div>

                                    {sidebarTab === "picker" ? (
                                        <RepositoryPicker
                                            repositories={repositories}
                                            loading={reposLoading}
                                            total={repoTotal}
                                            onFetch={fetchRepositories}
                                            onAnalyze={handlePickerAnalyze}
                                            analyzingRepo={analyzingRepo}
                                        />
                                    ) : (
                                        <RepositoryHistory 
                                            analyses={filteredAnalyses}
                                            selectedAnalysisId={selectedAnalysisId}
                                            onSelect={setSelectedAnalysisId}
                                            onReanalyze={handleReanalyze}
                                            onDelete={handleDeleteAnalysis}
                                        />
                                    )}
                                </div>
                            )}

                            {/* Connecting state during OAuth return */}
                            {isConnecting && (
                                <div className="git-card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1.5rem", gap: "0.75rem", textAlign: "center" }}>
                                    <span className="gh-connect-btn__spinner" style={{ width: "24px", height: "24px", borderTopColor: "#10b981", animation: "spin 0.8s linear infinite" }} />
                                    <h4 style={{ margin: 0, color: "#e2e8f0", fontSize: "0.9rem" }}>Connecting GitHub Account...</h4>
                                    <p style={{ margin: 0, fontSize: "0.78rem", color: "rgba(255,255,255,0.5)" }}>Fetching account profile, permissions, and repositories...</p>
                                </div>
                            )}

                            {/* Not connected: Connect Panel */}
                            {!statusLoading && !isConnecting && !isConnected && (
                                <GitHubConnectPanel
                                    onConnect={connect}
                                    loading={statusLoading || isConnecting}
                                    error={oauthError}
                                />
                            )}

                            {/* Public Repository URL Drawer (Compact Accordion) */}
                            <details className="public-repo-drawer git-card">
                                <summary className="public-repo-drawer__summary">
                                    <span>🔗 Public Repository Analyzer</span>
                                    <ChevronDown size={18} className="drawer-chevron-icon" />
                                </summary>
                                <form className="analyze-section" onSubmit={handleAnalyze} style={{ marginTop: "0.65rem" }}>
                                    <div className="form-group" style={{ marginBottom: "0.5rem" }}>
                                        <input 
                                            type="url" 
                                            id="repoUrl" 
                                            placeholder="https://github.com/user/repo" 
                                            value={repoUrl}
                                            onChange={(e) => setRepoUrl(e.target.value)}
                                            required
                                            disabled={loading}
                                            style={{ width: "100%", padding: "0.45rem 0.65rem", fontSize: "0.82rem" }}
                                        />
                                    </div>
                                    <LoadingButton 
                                        type="submit" 
                                        loading={loading}
                                        loadingText="Analyzing..."
                                        className="submit-btn" 
                                        id="repoSubmitBtn"
                                        style={{ width: "100%", padding: "0.45rem", fontSize: "0.82rem" }}
                                    >
                                        🔍 Analyze Repository
                                    </LoadingButton>
                                </form>
                            </details>
                        </div>
                        {/* end left sidebar column */}

                        {/* Right Main Panel: Audit Workspace */}
                        <div className="git-main-panel">

                        {isScraping ? (
                            <ProgressTimeline 
                                currentStage={scrapeStage}
                                filesAnalyzed={filesCount}
                                currentFile={activeFile}
                                currentFolder={activeFolder}
                                repoName={analyzingRepo || repoUrl || "GitHub Repository"}
                            />
                        ) : !selectedAnalysis ? (
                            <div className="git-card" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "380px", textAlign: "center", padding: "2rem" }}>
                                <div>
                                    <span style={{ fontSize: "3rem" }}>🚀</span>
                                    <h3 style={{ margin: "1rem 0 0.5rem 0", fontSize: "1.25rem" }}>Start Codebase Analysis</h3>
                                    <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.9rem", maxWidth: "480px", margin: "0 auto 1.25rem auto", lineHeight: "1.5" }}>
                                        Select any repository from the left panel or provide a GitHub URL to scan project folders, detect frameworks, security standards, and trigger AI Mock Defenses.
                                    </p>
                                    <div style={{ display: "inline-flex", flexDirection: "column", gap: "0.5rem", textAlign: "left", background: "rgba(0,0,0,0.3)", padding: "1rem 1.5rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.08)", fontSize: "0.85rem", color: "rgba(255,255,255,0.85)" }}>
                                        <span>• <strong>Architecture Review</strong>: Framework & module graph analysis</span>
                                        <span>• <strong>Security Audit</strong>: Secret leaks & vulnerability checks</span>
                                        <span>• <strong>Project Defense Q&A</strong>: Tailored technical interview questions</span>
                                        <span>• <strong>Code Quality Score</strong>: Automated codebase health rating</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="git-dashboard-main-content">
                                {/* Section A: 2-Column Responsive Repository Introduction Hero Card */}
                                <div className="git-card repo-hero-card">
                                    {/* Left Column (~70%): Repo Title, GitHub Link, 3-Line Summary */}
                                    <div className="repo-hero-card__left">
                                        <div className="repo-hero-card__header">
                                            <div className="repo-title-group">
                                                <span className="repo-icon">📁</span>
                                                <h3>{selectedAnalysis.repoName}</h3>
                                            </div>
                                            {selectedAnalysis.repoUrl && (
                                                <a href={selectedAnalysis.repoUrl} target="_blank" rel="noreferrer" className="repo-url-link">
                                                    🔗 GitHub Repo
                                                </a>
                                            )}
                                        </div>
                                        <p className="repo-hero-card__summary">{selectedAnalysis.summary}</p>
                                    </div>

                                    {/* Right Column (~30%): Defense Controls (Vertically Aligned) */}
                                    <div className="repo-hero-card__right">
                                        <div className="defense-controls-wrap">
                                            <span className="depth-label">DEFENSE DEPTH</span>
                                            <select 
                                                value={interviewLength} 
                                                onChange={(e) => setInterviewLength(e.target.value)}
                                                className="depth-select"
                                            >
                                                <option value="Quick">Quick Defense (5 Qs)</option>
                                                <option value="Standard">Standard Defense (10 Qs)</option>
                                                <option value="Deep">Deep Defense (15 Qs)</option>
                                            </select>

                                            <button className="cta-btn" onClick={handleStartInterview} disabled={loading}>
                                                <Shield size={16} /> Start Defense Mock
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Section B: Project Audit Tabs (GitHub / VS Code Style) */}
                                <div className="git-card">
                                    <div className="audit-tabs vscode-tabs" role="tablist">
                                        <button 
                                            className={`tab-btn ${activeTab === 'snapshot' ? 'tab-btn--active' : ''}`}
                                            onClick={() => setActiveTab('snapshot')}
                                            role="tab"
                                            aria-selected={activeTab === 'snapshot'}
                                        >
                                            Overview
                                        </button>
                                        <button 
                                            className={`tab-btn ${activeTab === 'health' ? 'tab-btn--active' : ''}`}
                                            onClick={() => setActiveTab('health')}
                                            role="tab"
                                            aria-selected={activeTab === 'health'}
                                        >
                                            Codebase Health
                                        </button>
                                        <button 
                                            className={`tab-btn ${activeTab === 'structure' ? 'tab-btn--active' : ''}`}
                                            onClick={() => setActiveTab('structure')}
                                            role="tab"
                                            aria-selected={activeTab === 'structure'}
                                        >
                                            Architecture & Graph
                                        </button>
                                        <button 
                                            className={`tab-btn ${activeTab === 'trends' ? 'tab-btn--active' : ''}`}
                                            onClick={() => setActiveTab('trends')}
                                            role="tab"
                                            aria-selected={activeTab === 'trends'}
                                        >
                                            Interview Topics
                                        </button>
                                    </div>

                                    {/* Tab 1: Project Snapshot */}
                                    {activeTab === 'snapshot' && (
                                        <div className="audit-tab-panel doc-style-panel">
                                            <div className="doc-section">
                                                <h4>Overview</h4>
                                                <p>{selectedAnalysis.projectSnapshot?.projectSummary || selectedAnalysis.summary || `${selectedAnalysis.repoName} is a software project.`}</p>
                                            </div>
                                            <hr />
                                            <div className="doc-section">
                                                <h4>Architecture Pattern</h4>
                                                <p>{selectedAnalysis.projectSnapshot?.architectureOverview || "Modular application architecture with clean separation of concerns across service modules."}</p>
                                            </div>
                                            <hr />
                                            <div className="doc-section">
                                                <h4>Security Protocols</h4>
                                                <p>{selectedAnalysis.projectSnapshot?.securityOverview || "Authentication and authorization protocols configured with standard API security checks."}</p>
                                            </div>
                                            <hr />
                                            <div className="doc-section">
                                                <h4>Deployment Stack</h4>
                                                <p>{selectedAnalysis.projectSnapshot?.deploymentOverview || "Deployment configured for cloud environment hosting with isolated environment variables."}</p>
                                            </div>
                                            
                                            <div style={{ marginTop: "1.5rem" }}>
                                                <strong>Core Technologies:</strong>
                                                <div className="tech-chips">
                                                    {(selectedAnalysis.projectSnapshot?.techStack?.length > 0
                                                        ? selectedAnalysis.projectSnapshot.techStack
                                                        : Array.from(new Set([
                                                            ...(selectedAnalysis.knowledgeGraph?.frontendStack || []),
                                                            ...(selectedAnalysis.knowledgeGraph?.backendStack || []),
                                                            ...(selectedAnalysis.knowledgeGraph?.database || [])
                                                        ]))
                                                    ).map((t, idx) => (
                                                        <span key={idx}>{t}</span>
                                                    ))}
                                                </div>
                                            </div>

                                            <div style={{ marginTop: "1.5rem" }}>
                                                <strong>Core Features:</strong>
                                                <ul className="core-features">
                                                    {(selectedAnalysis.projectSnapshot?.mainFeatures?.length > 0
                                                        ? selectedAnalysis.projectSnapshot.mainFeatures
                                                        : (selectedAnalysis.knowledgeGraph?.majorFeatures || ["Modular service architecture", "Interactive dashboard interface"])
                                                    ).map((f, idx) => (
                                                        <li key={idx}><CheckCircle size={16} /> {f}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    )}

                                     {/* Tab 2: Health Report */}
                                     {activeTab === 'health' && (
                                         <div className="audit-tab-panel doc-style-panel" style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
                                             <div className="health-item strength doc-section">
                                                 <h4 style={{ color: "#2ecc71" }}>✓ Architectural Strengths</h4>
                                                 <ul>
                                                     {(selectedAnalysis.healthReport?.architectureStrengths?.length > 0
                                                         ? selectedAnalysis.healthReport.architectureStrengths
                                                         : ["Clear modular separation between client UI components and backend service APIs."]
                                                     ).map((item, idx) => (
                                                         <li key={idx}>{item}</li>
                                                     ))}
                                                 </ul>
                                             </div>
                                             <div className="health-item weakness doc-section">
                                                 <h4 style={{ color: "#e67e22" }}>⚠ Architectural Weaknesses & Tech Debt</h4>
                                                 <ul>
                                                     {(selectedAnalysis.healthReport?.architectureWeaknesses?.length > 0
                                                         ? selectedAnalysis.healthReport.architectureWeaknesses
                                                         : ["Opportunity to expand automated integration and end-to-end unit test coverage."]
                                                     ).map((item, idx) => (
                                                         <li key={idx}>{item}</li>
                                                     ))}
                                                 </ul>
                                             </div>
                                             <div className="health-item security doc-section">
                                                 <h4 style={{ color: "#e74c3c" }}>🔒 Security Vulnerabilities & Exposure</h4>
                                                 <ul>
                                                     {(selectedAnalysis.healthReport?.securityConcerns?.length > 0
                                                         ? selectedAnalysis.healthReport.securityConcerns
                                                         : ["Ensure all sensitive credentials and API keys remain strictly isolated within environment variables."]
                                                     ).map((item, idx) => (
                                                         <li key={idx}>{item}</li>
                                                     ))}
                                                 </ul>
                                             </div>
                                             <div className="health-item scalability doc-section">
                                                 <h4 style={{ color: "#3498db" }}>📈 Scalability & Performance Concerns</h4>
                                                 <ul>
                                                     {(selectedAnalysis.healthReport?.scalabilityConcerns?.length > 0
                                                         ? selectedAnalysis.healthReport.scalabilityConcerns
                                                         : ["Monitor database indexing performance and API response caching under high load."]
                                                     ).map((item, idx) => (
                                                         <li key={idx}>{item}</li>
                                                     ))}
                                                 </ul>
                                             </div>
                                             <div className="health-item practices doc-section">
                                                 <h4 style={{ color: "#a855f7" }}>⚙️ Missing Engineering Practices</h4>
                                                 <ul>
                                                     {(selectedAnalysis.healthReport?.missingEngineeringPractices?.length > 0
                                                         ? selectedAnalysis.healthReport.missingEngineeringPractices
                                                         : ["Automated CI/CD testing runners and pull request validation workflows."]
                                                     ).map((item, idx) => (
                                                         <li key={idx}>{item}</li>
                                                     ))}
                                                 </ul>
                                             </div>
                                             <div className="health-item recommendations doc-section">
                                                 <h4 style={{ color: "#38bdf8" }}>📘 Refactoring & Improvement Recommendations</h4>
                                                 <ul>
                                                     {(selectedAnalysis.healthReport?.improvementRecommendations?.length > 0
                                                         ? selectedAnalysis.healthReport.improvementRecommendations
                                                         : ["Enforce strict input schema validation and request sanitization across API routes."]
                                                     ).map((item, idx) => (
                                                         <li key={idx}>{item}</li>
                                                     ))}
                                                 </ul>
                                             </div>
                                         </div>
                                     )}

                                    {/* Tab 3: Structure / Knowledge Graph (Redesigned Cards Grid) */}
                                    {activeTab === 'structure' && (
                                        <div className="audit-tab-panel arch-grid-panel">
                                            <div className="arch-cards-grid">
                                                {/* Card 1: Frontend Stack */}
                                                <div className="arch-card">
                                                    <div className="arch-card-header">
                                                        <Cpu size={16} className="card-icon arch-frontend" />
                                                        <h4>Frontend Layer</h4>
                                                    </div>
                                                    <div className="arch-badges-wrap">
                                                        {selectedAnalysis.knowledgeGraph?.frontendStack?.length > 0 ? (
                                                            selectedAnalysis.knowledgeGraph.frontendStack.map((item, idx) => (
                                                                <span key={idx} className="arch-badge badge-frontend">{item}</span>
                                                            ))
                                                        ) : (
                                                            <span className="arch-badge badge-empty">N/A</span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Card 2: Backend Stack */}
                                                <div className="arch-card">
                                                    <div className="arch-card-header">
                                                        <Server size={16} className="card-icon arch-backend" />
                                                        <h4>Backend Layer</h4>
                                                    </div>
                                                    <div className="arch-badges-wrap">
                                                        {selectedAnalysis.knowledgeGraph?.backendStack?.length > 0 ? (
                                                            selectedAnalysis.knowledgeGraph.backendStack.map((item, idx) => (
                                                                <span key={idx} className="arch-badge badge-backend">{item}</span>
                                                            ))
                                                        ) : (
                                                            <span className="arch-badge badge-empty">N/A</span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Card 3: Database & Schemas */}
                                                <div className="arch-card">
                                                    <div className="arch-card-header">
                                                        <Database size={16} className="card-icon arch-db" />
                                                        <h4>Database & Data Schemas</h4>
                                                    </div>
                                                    <div className="arch-badges-wrap">
                                                        {selectedAnalysis.knowledgeGraph?.database?.length > 0 ? (
                                                            selectedAnalysis.knowledgeGraph.database.map((item, idx) => (
                                                                <span key={idx} className="arch-badge badge-db">{item}</span>
                                                            ))
                                                        ) : null}
                                                        {selectedAnalysis.knowledgeGraph?.models?.length > 0 ? (
                                                            selectedAnalysis.knowledgeGraph.models.map((item, idx) => (
                                                                <span key={`m-${idx}`} className="arch-badge badge-model">Model: {item}</span>
                                                            ))
                                                        ) : null}
                                                        {(!selectedAnalysis.knowledgeGraph?.database?.length && !selectedAnalysis.knowledgeGraph?.models?.length) && (
                                                            <span className="arch-badge badge-empty">N/A</span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Card 4: Authentication & Security */}
                                                <div className="arch-card">
                                                    <div className="arch-card-header">
                                                        <Lock size={16} className="card-icon arch-auth" />
                                                        <h4>Authentication & Security</h4>
                                                    </div>
                                                    <div className="arch-badges-wrap">
                                                        {selectedAnalysis.knowledgeGraph?.authentication?.length > 0 ? (
                                                            selectedAnalysis.knowledgeGraph.authentication.map((item, idx) => (
                                                                <span key={idx} className="arch-badge badge-auth">{item}</span>
                                                            ))
                                                        ) : (
                                                            <span className="arch-badge badge-empty">N/A</span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Card 5: Service Modules */}
                                                <div className="arch-card">
                                                    <div className="arch-card-header">
                                                        <Layers size={16} className="card-icon arch-services" />
                                                        <h4>Service Layers & Business Modules</h4>
                                                    </div>
                                                    <div className="arch-badges-wrap">
                                                        {selectedAnalysis.knowledgeGraph?.services?.length > 0 ? (
                                                            selectedAnalysis.knowledgeGraph.services.map((item, idx) => (
                                                                <span key={idx} className="arch-badge badge-service">{item}</span>
                                                            ))
                                                        ) : (
                                                            <span className="arch-badge badge-empty">N/A</span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Card 6: API Endpoint Groups */}
                                                <div className="arch-card">
                                                    <div className="arch-card-header">
                                                        <Globe size={16} className="card-icon arch-routes" />
                                                        <h4>API Routes & Endpoint Groups</h4>
                                                    </div>
                                                    <div className="arch-badges-wrap">
                                                        {selectedAnalysis.knowledgeGraph?.routes?.length > 0 ? (
                                                            selectedAnalysis.knowledgeGraph.routes.map((item, idx) => (
                                                                <span key={idx} className="arch-badge badge-route">{item}</span>
                                                            ))
                                                        ) : (
                                                            <span className="arch-badge badge-empty">N/A</span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Card 7: External Integrations & Infrastructure */}
                                                <div className="arch-card full-width-card">
                                                    <div className="arch-card-header">
                                                        <Sparkles size={16} className="card-icon arch-external" />
                                                        <h4>External Integrations & Deployment Infrastructure</h4>
                                                    </div>
                                                    <div className="arch-badges-wrap">
                                                        {selectedAnalysis.knowledgeGraph?.externalApis?.length > 0 ? (
                                                            selectedAnalysis.knowledgeGraph.externalApis.map((item, idx) => (
                                                                <span key={idx} className="arch-badge badge-external">{item}</span>
                                                            ))
                                                        ) : null}
                                                        {selectedAnalysis.knowledgeGraph?.deploymentApproach?.length > 0 ? (
                                                            selectedAnalysis.knowledgeGraph.deploymentApproach.map((item, idx) => (
                                                                <span key={`d-${idx}`} className="arch-badge badge-deploy">{item}</span>
                                                            ))
                                                        ) : null}
                                                        {(!selectedAnalysis.knowledgeGraph?.externalApis?.length && !selectedAnalysis.knowledgeGraph?.deploymentApproach?.length) && (
                                                            <span className="arch-badge badge-empty">N/A</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Tab 4: Interview Topics (Study Guide Question Bank) */}
                                    {activeTab === 'trends' && (
                                        <div className="audit-tab-panel arch-grid-panel">
                                            <div className="arch-cards-grid">
                                                {/* Category 1: System Architecture */}
                                                <div className="arch-card">
                                                    <div className="arch-card-header">
                                                        <Cpu size={16} className="card-icon arch-frontend" />
                                                        <h4>🎯 System Architecture</h4>
                                                    </div>
                                                    <ul className="study-guide-list">
                                                        {(selectedAnalysis.interviewTopics?.architecture || [
                                                            `Explain why ${selectedAnalysis.repoName} follows its current folder architecture over a monolithic layout.`,
                                                            `What architectural trade-offs were made between maintainability and system complexity?`,
                                                            `How would you scale ${selectedAnalysis.repoName} if traffic increased 100x?`
                                                        ]).map((q, idx) => (
                                                            <li key={idx}>{q}</li>
                                                        ))}
                                                    </ul>
                                                </div>

                                                {/* Category 2: Frontend Engineering */}
                                                <div className="arch-card">
                                                    <div className="arch-card-header">
                                                        <Sparkles size={16} className="card-icon arch-external" />
                                                        <h4>🎨 Frontend Engineering</h4>
                                                    </div>
                                                    <ul className="study-guide-list">
                                                        {(selectedAnalysis.interviewTopics?.frontend || [
                                                            `Explain your component hierarchy and state management strategy in ${selectedAnalysis.repoName}.`,
                                                            `How do you handle asynchronous API calls, loading indicators, and error boundaries?`,
                                                            `What performance optimization techniques (code-splitting, memoization) were implemented?`
                                                        ]).map((q, idx) => (
                                                            <li key={idx}>{q}</li>
                                                        ))}
                                                    </ul>
                                                </div>

                                                {/* Category 3: Backend & API Design */}
                                                <div className="arch-card">
                                                    <div className="arch-card-header">
                                                        <Server size={16} className="card-icon arch-backend" />
                                                        <h4>⚙️ Backend & API Design</h4>
                                                    </div>
                                                    <ul className="study-guide-list">
                                                        {(selectedAnalysis.interviewTopics?.backend || [
                                                            `Walk me through the authentication flow and request middleware chain in ${selectedAnalysis.repoName}.`,
                                                            `How is error handling and exception logging centralized across backend endpoints?`,
                                                            `What rate-limiting or security hardening measures protect backend services?`
                                                        ]).map((q, idx) => (
                                                            <li key={idx}>{q}</li>
                                                        ))}
                                                    </ul>
                                                </div>

                                                {/* Category 4: Database & Schemas */}
                                                <div className="arch-card">
                                                    <div className="arch-card-header">
                                                        <Database size={16} className="card-icon arch-db" />
                                                        <h4>🗄️ Database & Schemas</h4>
                                                    </div>
                                                    <ul className="study-guide-list">
                                                        {(selectedAnalysis.interviewTopics?.database || [
                                                            `Why was your database & data model structure chosen for ${selectedAnalysis.repoName}?`,
                                                            `How are schema relationships and index keys optimized for query performance?`,
                                                            `How would you handle database migrations or data integrity in production?`
                                                        ]).map((q, idx) => (
                                                            <li key={idx}>{q}</li>
                                                        ))}
                                                    </ul>
                                                </div>

                                                {/* Category 5: Deployment & Security */}
                                                <div className="arch-card">
                                                    <div className="arch-card-header">
                                                        <Lock size={16} className="card-icon arch-auth" />
                                                        <h4>🚀 Deployment & Security</h4>
                                                    </div>
                                                    <ul className="study-guide-list">
                                                        {(selectedAnalysis.interviewTopics?.deploymentAndSecurity || [
                                                            `How are environment variables and sensitive API credentials managed?`,
                                                            `What is your hosting/deployment pipeline and CI/CD strategy for ${selectedAnalysis.repoName}?`,
                                                            `How do you mitigate web security vulnerabilities (XSS, CSRF, Injection)?`
                                                        ]).map((q, idx) => (
                                                            <li key={idx}>{q}</li>
                                                        ))}
                                                    </ul>
                                                </div>

                                                {/* Category 6: GitHub Defense Core */}
                                                <div className="arch-card">
                                                    <div className="arch-card-header">
                                                        <Shield size={16} className="card-icon arch-routes" />
                                                        <h4>🛡️ GitHub Defense Core</h4>
                                                    </div>
                                                    <ul className="study-guide-list">
                                                        {(selectedAnalysis.interviewTopics?.githubDefense || [
                                                            `Why is ${selectedAnalysis.repoName} structured this way, and what would you refactor first?`,
                                                            `What was the single most difficult technical challenge you faced while building ${selectedAnalysis.repoName}?`,
                                                            `What is your primary scalability bottleneck right now?`
                                                        ]).map((q, idx) => (
                                                            <li key={idx}>{q}</li>
                                                        ))}
                                                    </ul>
                                                </div>
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
                
                <ConfirmationModal
                    open={showDisconnectModal}
                    variant="warning"
                    title="Disconnect GitHub account?"
                    description="You will need to reconnect before analyzing private repositories."
                    confirmText="Disconnect"
                    cancelText="Cancel"
                    loading={actionLoading}
                    onConfirm={confirmDisconnect}
                    onCancel={() => setShowDisconnectModal(false)}
                />
            </div>
        </ErrorBoundary>
    );
};

export default GithubDashboard;
