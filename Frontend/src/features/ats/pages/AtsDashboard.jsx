import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router'
import Navbar from '../components/Navbar'
import { useAts } from '../hooks/useAts'
import '../style/atsDashboard.scss'
import { 
    KeywordBadge, 
    ErrorBoundary, 
    ScrollToTop, 
    RadialScoreMeter, 
    PdfViewer, 
    DeveloperPanel, 
    useToast 
} from '../../../components/ui'
import api, { getApiBaseUrl } from '../../../utils/apiClient'
import DevLogger from '../../../utils/devLogger'

const AtsDashboard = () => {
    const { atsId } = useParams()
    const navigate = useNavigate()
    const { report, getReportById, loading } = useAts()
    const { addToast } = useToast()
    
    const [heatmapFilter, setHeatmapFilter] = useState("all")
    const [comparisonTab, setComparisonTab] = useState("skills")
    const [pdfPageNumber, setPdfPageNumber] = useState(1)


    useEffect(() => {
        if (report) {
            DevLogger.log("ATS Analysis", {
                action: "load_report",
                reportId: report._id || atsId,
                atsScore: report.atsScore,
                matchedKeywords: report.matchedKeywords || [],
                missingKeywords: report.missingKeywords || [],
                extraKeywords: report.extraKeywords || []
            });
        }
    }, [report]);

    if (loading || !report) {
        return (
            <div className="ats-app-container">
                <Navbar />
                <main className='loading-screen-ats'>
                    <div className="spinner"></div>
                    <h1>Fetching ATS Match results...</h1>
                </main>
            </div>
        )
    }

    const {
        atsScore,
        breakdown = {},
        matchedKeywords = [],
        missingKeywords = [],
        extraKeywords = [],
        heatmap = [],
        comparisons = {},
        recommendations = {},
        strengths = [],
        weaknesses = [],
        diagnostics = {}
    } = report

    const filteredHeatmap = heatmap.filter(item => {
        if (heatmapFilter === "all") return true
        return item.status === heatmapFilter
    })

    const scoreColorClass = atsScore >= 80 ? 'high' : atsScore >= 60 ? 'mid' : 'low'
    
    // Resolve abstract pdf retrieval URL
    const BASE_URL = getApiBaseUrl()
    const pdfUrl = `${BASE_URL}/api/ats/report/${atsId}/resume`

    // Multi-Signal page lookup navigation synchronizer
    const navigateToKeyword = (keyword) => {
        if (!keyword || !report.resumePages || report.resumePages.length === 0) {
            return;
        }

        const normalizedKeyword = keyword.toLowerCase().trim();
        const matchedPage = report.resumePages.find(p => p.text?.toLowerCase().includes(normalizedKeyword));

        if (matchedPage) {
            setPdfPageNumber(matchedPage.pageNum);
            addToast(`Scrolled to page ${matchedPage.pageNum} containing "${keyword}"`, "info");
        } else {
            addToast(`Could not locate "${keyword}" in the resume text.`, "warning");
        }
    };

    // Download/fetch stream helper using credentials and CSRF
    const handleDownloadResume = async () => {
        try {
            const response = await api.get(`/api/ats/report/${atsId}/resume`, {
                responseType: "blob"
            });
            const blob = new Blob([response.data], { type: report.resumeMimetype || "application/pdf" });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", report.resumeName || "resume.pdf");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Failed to download resume file stream:", err);
            addToast("Unable to download resume file.", "error");
        }
    };

    return (
        <ErrorBoundary>
            <div className="ats-app-container">
                <Navbar />
                <div className="ats-dashboard-page">
                    {/* Back Link */}
                    <button className="back-btn" onClick={() => navigate('/ats')}>
                        ⬅ Back to Scans
                    </button>

                    {/* Dashboard Header */}
                    <header className="dashboard-header-ats">
                        <h1>ATS Match Analysis Dashboard</h1>
                        <p className="subtitle">Detailed evaluation of keyword matching density, project alignment, and AI-driven resume recommendations.</p>
                    </header>

                    {/* Side-by-Side Scrolling Grid */}
                    <div className="ats-dashboard-layout">
                        
                        {/* Left Side: PDF Viewscreen & Diagnostics */}
                        <div className="ats-pdf-panel">
                            <PdfViewer 
                                pdfUrl={pdfUrl} 
                                fileName={report.resumeName || "resume.pdf"}
                                pageNumber={pdfPageNumber}
                                onPageChange={setPdfPageNumber}
                                onDownload={handleDownloadResume}
                            />

                            {/* Dev diagnostics pane */}
                            {import.meta.env.DEV && diagnostics && (
                                <DeveloperPanel 
                                    title="ATS PDF Parsing Diagnostics"
                                    data={{
                                        "File Size": `${(diagnostics.fileSize / 1024).toFixed(2)} KB`,
                                        "Page Count": diagnostics.pageCount || 1,
                                        "Text Length": `${diagnostics.characterCount || 0} chars`,
                                        "Time Elapsed": `${diagnostics.parsingDuration || 0} ms`,
                                        "Confidence Score": `${diagnostics.confidenceScore || 0}%`,
                                        "Storage Provider": report.storageProvider || "local"
                                    }}
                                    warnings={diagnostics.warnings || []}
                                />
                            )}
                        </div>

                        {/* Right Side: ATS Results Panel */}
                        <div className="ats-results-panel">
                            
                            {/* Score & Category Breakdown Card */}
                            <div className="ats-metric-card score-panel">
                                <h2>Overall ATS Score</h2>
                                <div className="score-ring-container">
                                    <RadialScoreMeter score={atsScore} size={120} strokeWidth={8} />
                                </div>
                                <p className="score-status-text">
                                    {atsScore >= 80 ? "Excellent Job Description Match!" : atsScore >= 60 ? "Moderate Match, Needs Optimization" : "Low Match, Significant Revision Required"}
                                </p>

                                <div className="potential-badge">
                                    Potential Score: <strong>{recommendations.potentialScore || 0}%</strong> (+{recommendations.estimatedScoreImprovement || 0}% boost)
                                </div>

                                {/* Category Progress Bars */}
                                <div className="breakdown-list">
                                    <h3>Category Weights</h3>
                                    
                                    <div className="progress-group">
                                        <div className="progress-label">
                                            <span>Technical Skills</span>
                                            <span>{breakdown.technicalSkillsMatch || 0}%</span>
                                        </div>
                                        <div className="progress-bar-bg">
                                            <div className="progress-bar-fill" style={{ width: `${breakdown.technicalSkillsMatch || 0}%` }} />
                                        </div>
                                    </div>

                                    <div className="progress-group">
                                        <div className="progress-label">
                                            <span>Experience Fit</span>
                                            <span>{breakdown.experienceMatch || 0}%</span>
                                        </div>
                                        <div className="progress-bar-bg">
                                            <div className="progress-bar-fill" style={{ width: `${breakdown.experienceMatch || 0}%` }} />
                                        </div>
                                    </div>

                                    <div className="progress-group">
                                        <div className="progress-label">
                                            <span>Project Relevance</span>
                                            <span>{breakdown.projectsMatch || 0}%</span>
                                        </div>
                                        <div className="progress-bar-bg">
                                            <div className="progress-bar-fill" style={{ width: `${breakdown.projectsMatch || 0}%` }} />
                                        </div>
                                    </div>

                                    <div className="progress-group">
                                        <div className="progress-label">
                                            <span>Keyword Matches</span>
                                            <span>{breakdown.keywordMatch || 0}%</span>
                                        </div>
                                        <div className="progress-bar-bg">
                                            <div className="progress-bar-fill" style={{ width: `${breakdown.keywordMatch || 0}%` }} />
                                        </div>
                                    </div>

                                    <div className="progress-group">
                                        <div className="progress-label">
                                            <span>Education Match</span>
                                            <span>{breakdown.educationMatch || 0}%</span>
                                        </div>
                                        <div className="progress-bar-bg">
                                            <div className="progress-bar-fill" style={{ width: `${breakdown.educationMatch || 0}%` }} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Recommendations Panel */}
                            <div className="ats-metric-card recommendations-panel">
                                <h2>ATS Optimization Suggestions</h2>
                                
                                <div className="improvement-card">
                                    <h3>🚀 Priority Resume Optimizations</h3>
                                    <ul>
                                        {recommendations.resumeImprovements && recommendations.resumeImprovements.map((imp, idx) => (
                                            <li key={idx}>✅ {imp}</li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="improvement-card">
                                    <h3>🔍 Missing Skills to Incorporate</h3>
                                    <div className="missing-skills-flex">
                                        {recommendations.missingSkills && recommendations.missingSkills.map((skill, idx) => (
                                            <span className="missing-skill-badge" key={idx}>{skill}</span>
                                        ))}
                                    </div>
                                </div>

                                <div className="improvement-card">
                                    <h3>📄 ATS Formatting Suggestions</h3>
                                    <ul>
                                        {recommendations.atsOptimizationSuggestions && recommendations.atsOptimizationSuggestions.map((sug, idx) => (
                                            <li key={idx}>📌 {sug}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            {/* Keyword Heatmap */}
                            <div className="ats-metric-card heatmap-card">
                                <div className="heatmap-header">
                                    <h2>Keyword Heatmap Analysis</h2>
                                    <div className="heatmap-filters">
                                        <button className={heatmapFilter === "all" ? "active" : ""} onClick={() => setHeatmapFilter("all")}>All ({heatmap.length})</button>
                                        <button className={heatmapFilter === "matched" ? "active" : ""} onClick={() => setHeatmapFilter("matched")}>Matched ({matchedKeywords.length})</button>
                                        <button className={heatmapFilter === "missing" ? "active" : ""} onClick={() => setHeatmapFilter("missing")}>Missing ({missingKeywords.length})</button>
                                        <button className={heatmapFilter === "extra" ? "active" : ""} onClick={() => setHeatmapFilter("extra")}>Extra ({extraKeywords.length})</button>
                                    </div>
                                </div>

                                <div className="heatmap-grid">
                                    {filteredHeatmap.length > 0 ? (
                                        filteredHeatmap.map((item, idx) => (
                                            <KeywordBadge 
                                                key={idx}
                                                keyword={item.keyword}
                                                score={item.score}
                                                status={item.status}
                                                onClick={item.status !== "missing" ? () => navigateToKeyword(item.keyword) : null}
                                            />
                                        ))
                                    ) : (
                                        <p className="no-keywords">No keywords found for the selected filter.</p>
                                    )}
                                </div>
                            </div>

                            {/* Strengths vs. Weaknesses */}
                            <div className="dashboard-grid-main">
                                <div className="ats-metric-card strengths-card">
                                    <h2>Strength Areas</h2>
                                    <ul className="points-list checkmark">
                                        {strengths.map((str, idx) => (
                                            <li key={idx}>{str}</li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="ats-metric-card weaknesses-card">
                                    <h2>Weakness / Gap Areas</h2>
                                    <ul className="points-list warning">
                                        {weaknesses.map((weak, idx) => (
                                            <li key={idx}>{weak}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            {/* Comparison Matrices */}
                            <div className="ats-metric-card comparison-card">
                                <div className="comparison-header">
                                    <h2>Resume vs. Job Description Match Gaps</h2>
                                    <div className="tabs">
                                        <button className={comparisonTab === "skills" ? "active" : ""} onClick={() => setComparisonTab("skills")}>Skills Comparisons</button>
                                        <button className={comparisonTab === "projects" ? "active" : ""} onClick={() => setComparisonTab("projects")}>Project Relevance</button>
                                        <button className={comparisonTab === "experience" ? "active" : ""} onClick={() => setComparisonTab("experience")}>Experience Match</button>
                                    </div>
                                </div>

                                <div className="comparison-content">
                                    {comparisonTab === "skills" && (
                                        <table className="comparison-table">
                                            <thead>
                                                <tr>
                                                    <th>Skill / Topic (Click to jump)</th>
                                                    <th>Your Resume Status</th>
                                                    <th>JD Target Expectation</th>
                                                    <th>Identified Gap / Advice</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {comparisons.skillComparisons && comparisons.skillComparisons.map((row, idx) => (
                                                    <tr 
                                                        key={idx} 
                                                        style={{ cursor: "pointer" }} 
                                                        onClick={() => navigateToKeyword(row.skill)}
                                                        title="Click to locate this skill in your PDF"
                                                    >
                                                        <td className="bold">🔍 {row.skill}</td>
                                                        <td><span className={`pill status--${row.resumeStatus.toLowerCase().includes("not mentioned") ? "missing" : "matched"}`}>{row.resumeStatus}</span></td>
                                                        <td>{row.jdRequirement}</td>
                                                        <td>{row.gap}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}

                                    {comparisonTab === "projects" && (
                                        <table className="comparison-table">
                                            <thead>
                                                <tr>
                                                    <th>Project Topic / Area (Click to jump)</th>
                                                    <th>Relevance Level</th>
                                                    <th>Suggested Improvement</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {comparisons.projectComparisons && comparisons.projectComparisons.map((row, idx) => (
                                                    <tr 
                                                        key={idx} 
                                                        style={{ cursor: "pointer" }} 
                                                        onClick={() => navigateToKeyword(row.project)}
                                                        title="Click to locate this topic in your PDF"
                                                    >
                                                        <td className="bold">🔍 {row.project}</td>
                                                        <td>{row.relevance}</td>
                                                        <td>{row.improvement}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}

                                    {comparisonTab === "experience" && (
                                        <table className="comparison-table">
                                            <thead>
                                                <tr>
                                                    <th>Key Responsibilities / Role (Click to jump)</th>
                                                    <th>Relevance Level</th>
                                                    <th>Optimization Guidance</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {comparisons.experienceComparisons && comparisons.experienceComparisons.map((row, idx) => (
                                                    <tr 
                                                        key={idx} 
                                                        style={{ cursor: "pointer" }} 
                                                        onClick={() => navigateToKeyword(row.role)}
                                                        title="Click to locate this role in your PDF"
                                                    >
                                                        <td className="bold">🔍 {row.role}</td>
                                                        <td>{row.relevance}</td>
                                                        <td>{row.improvement}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
                <ScrollToTop />
            </div>
        </ErrorBoundary>
    )
}

export default AtsDashboard;
