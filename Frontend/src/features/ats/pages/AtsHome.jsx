import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router'
import Navbar from '../components/Navbar'
import { useAts } from '../hooks/useAts'
import '../style/atsHome.scss'

const AtsHome = () => {
    const { loading, generateReport, reports } = useAts()
    const [jobDescription, setJobDescription] = useState("")
    const [fileName, setFileName] = useState("")
    const resumeInputRef = useRef()
    const navigate = useNavigate()

    const handleFileChange = (e) => {
        const file = e.target.files[0]
        if (file) {
            setFileName(file.name)
        }
    }

    const handleAnalyze = async () => {
        const resumeFile = resumeInputRef.current?.files[0]
        if (!resumeFile) {
            alert("Please upload a resume PDF file.")
            return
        }
        if (!jobDescription || jobDescription.trim() === "") {
            alert("Please provide the target Job Description.")
            return
        }

        const data = await generateReport({ jobDescription, resumeFile })
        if (data && data._id) {
            navigate(`/ats/${data._id}`)
        } else {
            alert("Failed to analyze ATS Match. Please try again.")
        }
    }

    if (loading) {
        return (
            <div className="ats-app-container">
                <Navbar />
                <main className='loading-screen-ats'>
                    <div className="spinner"></div>
                    <h1>Evaluating ATS compatibility...</h1>
                    <p>Gemini is scanning your keywords, analyzing experience gaps, and calculating score weights. This takes about 15-30 seconds.</p>
                </main>
            </div>
        )
    }

    return (
        <div className="ats-app-container">
            <Navbar />
            <div className='ats-home-page'>
                {/* Page Header */}
                <header className='page-header-ats'>
                    <h1>Optimize Your Resume for <span className='highlight'>ATS Match</span></h1>
                    <p>Upload your resume and paste the target job description to reveal keyword gaps, match scores, and direct AI optimization feedback.</p>
                </header>

                {/* Main Card */}
                <div className='ats-card'>
                    <div className='ats-card__body'>

                        {/* Left Panel - Job Description */}
                        <div className='panel-ats panel-ats--left'>
                            <div className='panel-ats__header'>
                                <span className='panel-ats__icon'>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>
                                </span>
                                <h2>Target Job Description</h2>
                                <span className='badge-ats badge-ats--required'>Required</span>
                            </div>
                            <textarea
                                value={jobDescription}
                                onChange={(e) => setJobDescription(e.target.value)}
                                className='panel-ats__textarea'
                                placeholder={`Paste the job description or role requirements here...\ne.g. 'We are looking for a Software Engineer proficient in React, Node.js, and AWS Docker deployment...'`}
                                maxLength={8000}
                            />
                            <div className='char-counter-ats'>{jobDescription.length} / 8000 chars</div>
                        </div>

                        {/* Vertical Divider */}
                        <div className='panel-divider-ats' />

                        {/* Right Panel - Resume */}
                        <div className='panel-ats panel-ats--right'>
                            <div className='panel-ats__header'>
                                <span className='panel-ats__icon'>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                </span>
                                <h2>Your Resume</h2>
                                <span className='badge-ats badge-ats--required'>Required</span>
                            </div>

                            {/* Upload Resume */}
                            <div className='upload-section-ats'>
                                <label className='section-label-ats'>
                                    Upload Resume PDF
                                </label>
                                <label className='dropzone-ats' htmlFor='resume'>
                                    <span className='dropzone-ats__icon'>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" /><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" /></svg>
                                    </span>
                                    <p className='dropzone-ats__title'>
                                        {fileName ? `Selected: ${fileName}` : "Click to browse or drag & drop"}
                                    </p>
                                    <p className='dropzone-ats__subtitle'>PDF format only (Max 3MB)</p>
                                    <input
                                        ref={resumeInputRef}
                                        hidden
                                        type='file'
                                        id='resume'
                                        name='resume'
                                        accept='.pdf'
                                        onChange={handleFileChange}
                                    />
                                </label>
                            </div>

                            {/* Info Box */}
                            <div className='info-box-ats'>
                                <span className='info-box-ats__icon'>ℹ️</span>
                                <p>ATS scanners parse content hierarchy, typography structures, and specific skill clusters. Use high-contrast standard text layout PDF files for top-tier indexing accuracy.</p>
                            </div>
                        </div>
                    </div>

                    {/* Card Footer */}
                    <div className='ats-card__footer'>
                        <span className='footer-info-ats'>ATS Match Audit Engine &bull; AI Scoring Model</span>
                        <button
                            onClick={handleAnalyze}
                            className='generate-btn-ats'>
                            ✨ Analyze ATS Compatibility
                        </button>
                    </div>
                </div>

                {/* Recent Reports List */}
                {reports && reports.length > 0 && (
                    <section className='recent-reports-ats'>
                        <h2>Your Historical ATS Match Scans</h2>
                        <div className='reports-grid-ats'>
                            {reports.map(report => {
                                const previewTitle = report.jobDescription
                                    ? report.jobDescription.split('\n')[0].slice(0, 50) + (report.jobDescription.split('\n')[0].length > 50 ? '...' : '')
                                    : 'ATS Match Scan';
                                return (
                                    <div
                                        key={report._id}
                                        className='report-card-ats'
                                        onClick={() => navigate(`/ats/${report._id}`)}
                                    >
                                        <div className='report-card-ats__score-badge'>
                                            <span className={`score-label ${report.atsScore >= 80 ? 'high' : report.atsScore >= 60 ? 'mid' : 'low'}`}>
                                                {report.atsScore}%
                                            </span>
                                        </div>
                                        <div className='report-card-ats__info'>
                                            <h3>{previewTitle}</h3>
                                            <p className='date'>Scanned on {new Date(report.createdAt).toLocaleDateString()}</p>
                                        </div>
                                        <div className='report-card-ats__arrow'>➡️</div>
                                    </div>
                                )
                            })}
                        </div>
                    </section>
                )}
            </div>
        </div>
    )
}

export default AtsHome
