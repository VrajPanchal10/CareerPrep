import React, { useState, useRef } from 'react';
import "../style/home.scss";
import { useInterview } from '../hooks/useInterview.js';
import { useNavigate } from 'react-router';
import Navbar from '../../ats/components/Navbar';
import { useToast, ProgressBar, LoadingButton, EmptyState, ScrollToTop, ErrorBoundary } from '../../../components/ui';

// Vector SVGs matching Target Reference 1:1
const SVG = {
    JobIcon: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
    ),
    UserIcon: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
    ),
    CloudUpload: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m16 16-4-4-4 4"/></svg>
    ),
    InfoIcon: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
    ),
    ShieldMic: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <path d="M12 7a2 2 0 0 0-2 2v3a2 2 0 0 0 4 0V9a2 2 0 0 0-2-2z"/>
            <path d="M9 11.5a3 3 0 0 0 6 0"/>
            <line x1="12" y1="14.5" x2="12" y2="16.5"/>
        </svg>
    ),
    VoiceHead: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L4 21l3.57-1.02A8.94 8.94 0 0 0 12 21c4.97 0 9-4.03 9-9s-4.03-9-9-9z"/>
            <path d="M15 9a4 4 0 0 1 0 6"/>
            <path d="M17.5 7a7 7 0 0 1 0 10"/>
        </svg>
    ),
    ArrowRight: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
    )
};

const Home = () => {
    const { loading, generateReport, reports } = useInterview();
    const { addToast } = useToast();
    const [jobDescription, setJobDescription] = useState("");
    const [selfDescription, setSelfDescription] = useState("");
    const [selectedFile, setSelectedFile] = useState(null);
    const [fileName, setFileName] = useState("");
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadStatus, setUploadStatus] = useState("uploading");
    const resumeInputRef = useRef();
    const navigate = useNavigate();

    const handleFileChange = (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
            if (file.type !== "application/pdf" && file.type !== "application/vnd.openxmlformats-officedocument.wordprocessingml.document" && file.type !== "text/plain") {
                addToast("Please upload a PDF, DOCX, or TXT file.", "warning");
                return;
            }
            setSelectedFile(file);
            setFileName(file.name);
            addToast(`Selected resume: ${file.name}`, "info");
        }
    };

    const handleDragEnter = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const file = e.dataTransfer.files && e.dataTransfer.files[0];
        if (file) {
            if (file.type !== "application/pdf" && file.type !== "application/vnd.openxmlformats-officedocument.wordprocessingml.document" && file.type !== "text/plain") {
                addToast("Please upload a PDF, DOCX, or TXT file.", "warning");
                return;
            }
            setSelectedFile(file);
            setFileName(file.name);
            if (resumeInputRef.current) {
                try {
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(file);
                    resumeInputRef.current.files = dataTransfer.files;
                } catch (err) {
                    // Fallback handled by selectedFile state
                }
            }
            addToast(`Resume uploaded: ${file.name}`, "success");
        }
    };

    const handleGenerateReport = async () => {
        const resumeFile = selectedFile || (resumeInputRef.current?.files && resumeInputRef.current.files[0]);
        if (!jobDescription || jobDescription.trim() === "") {
            addToast("Please provide the target Job Description.", "warning");
            return;
        }
        if (!resumeFile && (!selfDescription || selfDescription.trim() === "")) {
            addToast("Please provide either a Resume file or a Self Description.", "warning");
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);
        setUploadStatus("uploading");

        try {
            const data = await generateReport({ 
                jobDescription, 
                selfDescription, 
                resumeFile,
                onUploadProgress: (progressEvent) => {
                    const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setUploadProgress(percent);
                    if (percent >= 100) {
                        setUploadStatus("evaluating");
                    }
                }
            });

            if (data && data._id) {
                setUploadStatus("success");
                addToast("Interview Plan generated successfully!", "success");
                navigate(`/interview/${data._id}`);
            } else {
                setUploadStatus("error");
                addToast("Failed to generate Interview Plan. Please try again.", "error");
            }
        } catch (err) {
            console.error("Upload error in Home.jsx:", err);
            setUploadStatus("error");
            const errorMessage = err?.response?.data?.message || err?.message || "Failed to upload files or compile plan.";
            addToast(errorMessage, "error");
        } finally {
            setIsUploading(false);
        }
    };

    const handleRemovePlan = async (reportId, e) => {
        e.stopPropagation();
        if (window.confirm("Are you sure you want to remove this interview plan?")) {
            try {
                // Remove locally from context reports
                const updated = (reports || []).filter(r => r && r._id !== reportId);
                if (typeof setReports === 'function') {
                    setReports(updated);
                } else {
                    window.location.reload();
                }
                addToast("Interview plan removed.", "info");
            } catch (err) {
                addToast("Failed to remove plan.", "error");
            }
        }
    };

    const getStatusConfig = (report) => {
        const status = report.status || (report.matchScore >= 80 ? 'Interview Ready' : 'Resume Optimized');
        switch (status.toLowerCase()) {
            case 'interview ready':
            case 'interview_ready':
                return { label: 'Interview Ready', color: '#3b82f6', textClass: 'text-blue' };
            case 'resume optimized':
            case 'resume_optimized':
                return { label: 'Resume Optimized', color: '#10b981', textClass: 'text-green' };
            case 'needs review':
            case 'needs_review':
                return { label: 'Needs Review', color: '#f59e0b', textClass: 'text-orange' };
            case 'draft':
                return { label: 'Draft', color: '#94a3b8', textClass: 'text-gray' };
            case 'rejected':
                return { label: 'Rejected', color: '#ef4444', textClass: 'text-red' };
            case 'completed':
                return { label: 'Completed', color: '#8b5cf6', textClass: 'text-purple' };
            default:
                return { label: status, color: '#10b981', textClass: 'text-green' };
        }
    };

    return (
        <ErrorBoundary>
            <div style={{ minHeight: "100vh" }}>
                <Navbar />
                <div className="home-dashboard">
                    
                    {/* Top Main Section: Target Job Description & Candidate Profile */}
                    <div className="interview-main-card">
                        <div className="interview-card-body">
                            
                            {/* Left Panel: Target Job Description */}
                            <div className="panel panel-left">
                                <div className="panel-header">
                                    <div className="title-group">
                                        <span className="panel-icon"><SVG.JobIcon /></span>
                                        <h3>Target Job Description</h3>
                                    </div>
                                    <span className="badge badge-required">REQUIRED</span>
                                </div>
                                <div className="textarea-wrapper">
                                    <textarea
                                        value={jobDescription}
                                        onChange={(e) => setJobDescription(e.target.value)}
                                        placeholder={`Paste the full job description here...\ne.g. 'Senior Frontend Engineer at Google requires proficiency in React, TypeScript, and large-scale system design...'`}
                                        maxLength={5000}
                                        disabled={isUploading}
                                    />
                                    <div className="char-count">{jobDescription.length} / 5000 chars</div>
                                </div>
                            </div>

                            {/* Right Panel: Your Profile */}
                            <div className="panel panel-right">
                                <div className="panel-header">
                                    <div className="title-group">
                                        <span className="panel-icon"><SVG.UserIcon /></span>
                                        <h3>Your Profile</h3>
                                    </div>
                                </div>

                                {/* Upload Resume Container */}
                                <div className="upload-container">
                                    <div className="upload-header">
                                        <span className="upload-label">Upload Resume</span>
                                        <span className="badge badge-best">BEST RESULTS</span>
                                    </div>
                                    <div 
                                        className={`dropzone ${isDragging ? 'dragging' : ''}`}
                                        onDragEnter={handleDragEnter}
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                        onClick={() => resumeInputRef.current?.click()}
                                    >
                                        <div className="dropzone-icon">
                                            <SVG.CloudUpload />
                                        </div>
                                        <p className="dropzone-title">Click to upload or drag & drop</p>
                                        <p className="dropzone-subtitle">PDF or DOCX (Max 5MB)</p>
                                        <input 
                                            ref={resumeInputRef} 
                                            hidden 
                                            type='file' 
                                            id='resume-upload' 
                                            name='resume'
                                            accept='.pdf,.docx,.txt' 
                                            onChange={handleFileChange}
                                            disabled={isUploading}
                                        />
                                        {fileName && <div className="selected-file">Selected: {fileName}</div>}
                                    </div>
                                    {isUploading && <ProgressBar progress={uploadProgress} status={uploadStatus} />}
                                </div>

                                {/* OR Divider */}
                                <div className="or-divider"><span>OR</span></div>

                                {/* Quick Self Description */}
                                <div className="self-desc-group">
                                    <label className="section-label">Quick Self-Description</label>
                                    <textarea
                                        value={selfDescription}
                                        onChange={(e) => setSelfDescription(e.target.value)}
                                        className="self-desc-textarea"
                                        placeholder="Briefly describe your experience, key skills, and years of experience if you don't have a resume handy..."
                                        disabled={isUploading}
                                    />
                                </div>

                                {/* Blue Info Box */}
                                <div className="info-box">
                                    <span className="info-icon"><SVG.InfoIcon /></span>
                                    <p>Either a <strong>Resume</strong> or a <strong>Self Description</strong> is required to generate a personalized plan.</p>
                                </div>
                            </div>

                        </div>

                        {/* Top Section Footer Bar */}
                        <div className="interview-card-footer">
                            <span className="footer-meta">AI-Powered Strategy Generation &bull; Approx 30s</span>
                            <LoadingButton
                                onClick={handleGenerateReport}
                                loading={isUploading}
                                className="btn-generate-strategy"
                                id="interviewSubmitBtn"
                            >
                                Generate My Interview Strategy
                            </LoadingButton>
                        </div>
                    </div>

                    {/* Middle Grid: Feature Promos */}
                    <div className="dashboard-grid middle-grid">
                        <div className="dashboard-card promo-card github-promo">
                            <div className="promo-icon-large shield-bg">
                                <SVG.ShieldMic />
                            </div>
                            <div className="promo-content">
                                <h4>Project Defense AI</h4>
                                <p>Practice defending your portfolio projects in AI-simulated interviews. Get real-time feedback.</p>
                            </div>
                            <button className="btn-simulation" onClick={() => navigate("/github-defense")}>Start Simulation</button>
                        </div>

                        <div className="dashboard-card promo-card voice-promo">
                            <div className="promo-icon-large voice-bg">
                                <SVG.VoiceHead />
                            </div>
                            <div className="promo-content">
                                <h4>Voice Simulator AI</h4>
                                <p>Improve your vocal delivery, pace, and tone with advanced speech analysis. Boost confidence.</p>
                            </div>
                            <button className="btn-simulation" onClick={() => navigate("/voice-interview")}>Launch Simulator</button>
                        </div>
                    </div>

                    {/* Bottom Grid: Recent Plans */}
                    <div className="recent-plans-section">
                        <h3>Recent Plans</h3>
                        {(reports || []).length > 0 ? (
                            <div className="plans-grid">
                                {(reports || []).map(report => {
                                    if (!report) return null;
                                    const statusCfg = getStatusConfig(report);
                                    const formattedDate = report.createdAt ? new Date(report.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent';
                                    
                                    return (
                                        <div key={report._id || Math.random()} className="plan-card" onClick={() => navigate(`/interview/${report._id}`)}>
                                            {/* Action Delete Button */}
                                            <button 
                                                className="card-delete-btn"
                                                onClick={(e) => handleRemovePlan(report._id, e)}
                                                title="Delete Plan"
                                                aria-label="Delete Plan"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                            </button>

                                            <div className="card-top-content">
                                                <h4 className="plan-title">{report.title || 'Untitled Position'}</h4>
                                                <div className="plan-meta">
                                                    <p className="last-activity">
                                                        <span className="meta-label">Last activity:</span> <span className="meta-date">{formattedDate}</span>
                                                    </p>
                                                    <p className="plan-status">
                                                        <span className="status-label">Status:</span>
                                                        <span className={`status-badge ${statusCfg.textClass}`}>
                                                            <span className="status-dot" style={{ backgroundColor: statusCfg.color, boxShadow: `0 0 6px ${statusCfg.color}` }}></span>
                                                            <span className="status-text">{statusCfg.label}</span>
                                                        </span>
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Inner Rounded View Plan Button Container */}
                                            <div className="view-plan-btn">
                                                <span className="action-text">View Plan</span>
                                                <span className="arrow-icon"><SVG.ArrowRight /></span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <EmptyState 
                                icon="🎙️"
                                title="No Interview Plans Generated Yet"
                                description="Paste a job description and upload your resume to generate customized interview questions."
                                primaryAction={{
                                    label: "Upload Resume to Start",
                                    onClick: () => resumeInputRef.current?.click()
                                }}
                            />
                        )}
                    </div>
                </div>

                <ScrollToTop />
            </div>
        </ErrorBoundary>
    );
};

export default Home;
