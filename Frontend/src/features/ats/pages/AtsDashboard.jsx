import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router'
import Navbar from '../components/Navbar'
import { useAts } from '../hooks/useAts'
import '../style/atsDashboard.scss'

const AtsDashboard = () => {
    const { atsId } = useParams()
    const navigate = useNavigate()
    const { report, getReportById, loading } = useAts()
    const [heatmapFilter, setHeatmapFilter] = useState("all")
    const [comparisonTab, setComparisonTab] = useState("skills")

    useEffect(() => {
        if (atsId) {
            getReportById(atsId)
        }
    }, [atsId])

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
        weaknesses = []
    } = report

    const filteredHeatmap = heatmap.filter(item => {
        if (heatmapFilter === "all") return true
        return item.status === heatmapFilter
    })

    const scoreColorClass = atsScore >= 80 ? 'high' : atsScore >= 60 ? 'mid' : 'low'

    return (
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

                {/* Grid Layout Row 1: Overall Score & Recommendations */}
                <div className="dashboard-grid-main">
                    
                    {/* Score Card */}
                    <div className="ats-metric-card score-panel">
                        <h2>Overall ATS Score</h2>
                        <div className="score-ring-container">
                            <svg className="score-ring" viewBox="0 0 120 120">
                                <circle className="score-ring__bg" cx="60" cy="60" r="54" />
                                <circle 
                                    className={`score-ring__fill ${scoreColorClass}`} 
                                    cx="60" 
                                    cy="60" 
                                    r="54" 
                                    strokeDasharray={2 * Math.PI * 54}
                                    strokeDashoffset={2 * Math.PI * 54 * (1 - atsScore / 100)}
                                />
                            </svg>
                            <div className="score-text">
                                <span className="score-value">{atsScore}</span>
                                <span className="score-percent">%</span>
                            </div>
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
                </div>

                {/* Grid Layout Row 2: Heatmap */}
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
                                <div key={idx} className={`heatmap-item status--${item.status}`}>
                                    <span className="keyword-name">{item.keyword}</span>
                                    <span className="keyword-score">{item.score}% match</span>
                                </div>
                            ))
                        ) : (
                            <p className="no-keywords">No keywords found for the selected filter.</p>
                        )}
                    </div>
                </div>

                {/* Grid Layout Row 3: Strengths vs. Weaknesses */}
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

                {/* Grid Layout Row 4: Comparison Matrices */}
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
                                        <th>Skill / Topic</th>
                                        <th>Your Resume Status</th>
                                        <th>JD Target Expectation</th>
                                        <th>Identified Gap / Advice</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {comparisons.skillComparisons && comparisons.skillComparisons.map((row, idx) => (
                                        <tr key={idx}>
                                            <td className="bold">{row.skill}</td>
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
                                        <th>Project Topic / Area</th>
                                        <th>Relevance Level</th>
                                        <th>Suggested Improvement</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {comparisons.projectComparisons && comparisons.projectComparisons.map((row, idx) => (
                                        <tr key={idx}>
                                            <td className="bold">{row.project}</td>
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
                                        <th>Key Responsibilities / Role</th>
                                        <th>Relevance Level</th>
                                        <th>Optimization Guidance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {comparisons.experienceComparisons && comparisons.experienceComparisons.map((row, idx) => (
                                        <tr key={idx}>
                                            <td className="bold">{row.role}</td>
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
    )
}

export default AtsDashboard
