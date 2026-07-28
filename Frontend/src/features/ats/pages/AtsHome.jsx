import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router'
import Navbar from '../components/Navbar'
import { useAts } from '../hooks/useAts'
import '../style/atsHome.scss'
import { useToast, ProgressBar, LoadingButton, SkeletonDashboard, EmptyState, ScrollToTop, ErrorBoundary, HelpTooltip } from '../../../components/ui'
import DevLogger from '../../../utils/devLogger'
import { formatErrorMessage } from '../../../utils/apiClient'

const AtsHome = () => {
    const { loading, generateReport, reports, deleteReport } = useAts()
    const { addToast } = useToast()
    const [jobDescription, setJobDescription] = useState("")
    const [fileName, setFileName] = useState("")
    const [isDragging, setIsDragging] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [uploadStatus, setUploadStatus] = useState("uploading")
    const resumeInputRef = useRef()
    const navigate = useNavigate()

    const handleFileChange = (e) => {
        const file = e.target.files[0]
        if (file) {
            if (file.type !== "application/pdf") {
                addToast("Please upload a PDF file.", "warning")
                return
            }
            setFileName(file.name)
            addToast(`Selected resume: ${file.name}`, "info")
        }
    }

    const handleDragEnter = (e) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(true)
    }

    const handleDragOver = (e) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(true)
    }

    const handleDragLeave = (e) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)
    }

    const handleDrop = (e) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)
        const file = e.dataTransfer.files[0]
        if (file) {
            if (file.type !== "application/pdf") {
                addToast("Please upload a PDF file.", "warning")
                return
            }
            setFileName(file.name)
            if (resumeInputRef.current) {
                const dataTransfer = new DataTransfer()
                dataTransfer.items.add(file)
                resumeInputRef.current.files = dataTransfer.files
            }
            addToast(`Resume uploaded: ${file.name}`, "success")
        }
    }

    const handleAnalyze = async () => {
        const resumeFile = resumeInputRef.current?.files[0]
        if (!resumeFile) {
            addToast("Please upload a resume PDF file.", "warning")
            return
        }
        if (!jobDescription || jobDescription.trim() === "") {
            addToast("Please provide the target Job Description.", "warning")
            return
        }

        setIsUploading(true)
        setUploadProgress(0)
        setUploadStatus("uploading")
        DevLogger.log("Resume Parsing", {
            action: "parse_start",
            fileName: resumeFile.name,
            fileSize: resumeFile.size,
            jobDescriptionLength: jobDescription.length
        });

        try {
            const data = await generateReport({ 
                jobDescription, 
                resumeFile,
                onUploadProgress: (progressEvent) => {
                    const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
                    setUploadProgress(percent)
                    if (percent >= 100) {
                        setUploadStatus("evaluating")
                    }
                }
            })

            if (data && data._id) {
                setUploadStatus("success")
                addToast("ATS Audit complete!", "success")
                navigate(`/ats/${data._id}`)
            } else {
                setUploadStatus("error")
                addToast("Failed to analyze ATS Match. Please try again.", "error")
            }
        } catch (err) {
            setUploadStatus("error")
            addToast(formatErrorMessage(err, "Upload or analysis failed. Check your file size or connection."), "error")
        } finally {
            setIsUploading(false)
        }
    }

    if (loading && !isUploading) {
        return (
            <div className="ats-app-container">
                <Navbar />
                <main className='ats-home-page' style={{ padding: "2rem" }}>
                    <SkeletonDashboard />
                </main>
            </div>
        )
    }

    return (
        <ErrorBoundary>
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
                                    <h2 style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                        Target Job Description
                                        <HelpTooltip term="" text="Paste target job listing requirements to assess keyword overlap and match score." />
                                    </h2>
                                    <span className='badge-ats badge-ats--required'>Required</span>
                                </div>
                                <textarea
                                    value={jobDescription}
                                    onChange={(e) => setJobDescription(e.target.value)}
                                    className='panel-ats__textarea'
                                    placeholder={`Paste the job description or role requirements here...\ne.g. 'We are looking for a Software Engineer proficient in React, Node.js, and AWS Docker deployment...'`}
                                    maxLength={8000}
                                    disabled={isUploading}
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
                                <div 
                                    className={`upload-section-ats ${isDragging ? "upload-section-ats--dragging" : ""}`}
                                    onDragEnter={handleDragEnter}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    style={{
                                        border: isDragging ? "2px dashed #6366f1" : "1px dashed rgba(255,255,255,0.1)",
                                        background: isDragging ? "rgba(99, 102, 241, 0.06)" : "rgba(255,255,255,0.01)",
                                        borderRadius: "12px",
                                        padding: "1.25rem",
                                        transition: "all 0.2s ease"
                                    }}
                                >
                                    <label className='section-label-ats'>
                                        Upload Resume PDF
                                    </label>
                                    <label className='dropzone-ats' htmlFor='resume' style={{ cursor: isUploading ? "not-allowed" : "pointer" }}>
                                        <span className={`dropzone-ats__icon ${isUploading ? "anim-pulse" : ""}`}>
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
                                            disabled={isUploading}
                                        />
                                    </label>

                                    {isUploading && (
                                        <ProgressBar progress={uploadProgress} status={uploadStatus} />
                                    )}
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
                            <LoadingButton
                                onClick={handleAnalyze}
                                loading={isUploading}
                                loadingText="Analyzing ATS compatibility..."
                                className='generate-btn-ats'
                                id="atsSubmitBtn"
                            >
                                ✨ Analyze ATS Compatibility
                            </LoadingButton>
                        </div>
                    </div>

                {/* Recent Reports List */}
                {reports && reports.length > 0 ? (
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
                                        <button
                                            type="button"
                                            className='delete-card-btn'
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                if (window.confirm("Are you sure you want to delete this historical ATS match scan?")) {
                                                    await deleteReport(report._id);
                                                }
                                            }}
                                            title="Delete ATS Scan History"
                                        >
                                            ✕
                                        </button>
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
                ) : (
                    <section className='recent-reports-ats'>
                        <h2>Your Historical ATS Match Scans</h2>
                        <EmptyState 
                            icon="📝"
                            title="No ATS Reports Scanned Yet"
                            description="Upload your resume PDF and enter the target requirements to scan for keyword matching indexes and optimization advice."
                            primaryAction={{
                                label: "Scan Resume Now",
                                onClick: () => resumeInputRef.current?.click()
                            }}
                        />
                    </section>
                )}

                <ScrollToTop />
            </div>
        </div>
    </ErrorBoundary>
    )
}

export default AtsHome
