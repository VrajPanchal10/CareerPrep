import React, { useState, useRef } from 'react'
import "../style/home.scss"
import { useInterview } from '../hooks/useInterview.js'
import { useNavigate } from 'react-router'
import Navbar from '../../ats/components/Navbar'

const Home = () => {

    const { loading, generateReport,reports } = useInterview()
    const [ jobDescription, setJobDescription ] = useState("")
    const [ selfDescription, setSelfDescription ] = useState("")
    const resumeInputRef = useRef()

    const navigate = useNavigate()

    const handleGenerateReport = async () => {
        const resumeFile = resumeInputRef.current.files[ 0 ]
        const data = await generateReport({ jobDescription, selfDescription, resumeFile })
        navigate(`/interview/${data._id}`)
    }

    if (loading) {
        return (
            <main className='loading-screen'>
                <h1>Loading your interview plan...</h1>
            </main>
        )
    }

    return (
        <div style={{ minHeight: "100vh" }}>
            <Navbar />
            <div className='home-page'>


            {/* Page Header */}
            <header className='page-header'>
                <h1>Prepare Smarter with <span className="highlight">CareerPrep</span></h1>
                <p>AI-powered career preparation platform for resumes, interviews, coding assessments, and project defense practice.</p>
            </header>

            {/* Main Card */}
            <div className='interview-card'>
                <div className='interview-card__body'>

                    {/* Left Panel - Job Description */}
                    <div className='panel panel--left'>
                        <div className='panel__header'>
                            <span className='panel__icon'>
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>
                            </span>
                            <h2>Target Job Description</h2>
                            <span className='badge badge--required'>Required</span>
                        </div>
                        <textarea
                            onChange={(e) => { setJobDescription(e.target.value) }}
                            className='panel__textarea'
                            placeholder={`Paste the full job description here...\ne.g. 'Senior Frontend Engineer at Google requires proficiency in React, TypeScript, and large-scale system design...'`}
                            maxLength={5000}
                        />
                        <div className='char-counter'>0 / 5000 chars</div>
                    </div>

                    {/* Vertical Divider */}
                    <div className='panel-divider' />

                    {/* Right Panel - Profile */}
                    <div className='panel panel--right'>
                        <div className='panel__header'>
                            <span className='panel__icon'>
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                            </span>
                            <h2>Your Profile</h2>
                        </div>

                        {/* Upload Resume */}
                        <div className='upload-section'>
                            <label className='section-label'>
                                Upload Resume
                                <span className='badge badge--best'>Best Results</span>
                            </label>
                            <label className='dropzone' htmlFor='resume'>
                                <span className='dropzone__icon'>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" /><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" /></svg>
                                </span>
                                <p className='dropzone__title'>Click to upload or drag &amp; drop</p>
                                <p className='dropzone__subtitle'>PDF or DOCX (Max 5MB)</p>
                                <input ref={resumeInputRef} hidden type='file' id='resume' name='resume' accept='.pdf,.docx' />
                            </label>
                        </div>

                        {/* OR Divider */}
                        <div className='or-divider'><span>OR</span></div>

                        {/* Quick Self-Description */}
                        <div className='self-description'>
                            <label className='section-label' htmlFor='selfDescription'>Quick Self-Description</label>
                            <textarea
                                onChange={(e) => { setSelfDescription(e.target.value) }}
                                id='selfDescription'
                                name='selfDescription'
                                className='panel__textarea panel__textarea--short'
                                placeholder="Briefly describe your experience, key skills, and years of experience if you don't have a resume handy..."
                            />
                        </div>

                        {/* Info Box */}
                        <div className='info-box'>
                            <span className='info-box__icon'>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" stroke="#1a1f27" strokeWidth="2" /><line x1="12" y1="16" x2="12.01" y2="16" stroke="#1a1f27" strokeWidth="2" /></svg>
                            </span>
                            <p>Either a <strong>Resume</strong> or a <strong>Self Description</strong> is required to generate a personalized plan.</p>
                        </div>
                    </div>
                </div>

                {/* Card Footer */}
                <div className='interview-card__footer'>
                    <span className='footer-info'>AI-Powered Strategy Generation &bull; Approx 30s</span>
                    <button
                        onClick={handleGenerateReport}
                        className='generate-btn'>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" /></svg>
                        Generate My Interview Strategy
                    </button>
                </div>
            </div>

            {/* GitHub Project Defense Promo Banner */}
            <section className="github-defense-promo" style={{
                margin: "2rem auto",
                maxWidth: "1000px",
                background: "linear-gradient(135deg, rgba(210, 13, 59, 0.15), rgba(138, 43, 226, 0.15))",
                border: "1px solid rgba(138, 43, 226, 0.25)",
                borderRadius: "12px",
                padding: "2rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "1.5rem",
                boxShadow: "0 4px 20px rgba(0,0,0,0.15)"
            }}>
                <div style={{ flex: 1 }}>
                    <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.2rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        🛡️ GitHub Project Defense Interview Simulator
                    </h3>
                    <p style={{ margin: 0, fontSize: "0.88rem", color: "rgba(255, 255, 255, 0.7)", lineHeight: "1.5" }}>
                        Audit your public and private repositories, generate a codebase Health Report and Project Snapshot, and defend your architectural, security, and database decisions in professional mock simulations tailored directly to your code!
                    </p>
                </div>
                <button 
                    onClick={() => navigate("/github-defense")} 
                    style={{
                        background: "linear-gradient(135deg, #d20d3b, #8a2be2)",
                        border: "none",
                        color: "#fff",
                        padding: "0.75rem 1.5rem",
                        borderRadius: "6px",
                        fontWeight: "700",
                        fontSize: "0.9rem",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        transition: "opacity 0.2s"
                    }}
                >
                    🛡️ Enter Project Defense
                </button>
            </section>

            {/* Voice Interview Banner Entry Point */}
            <section className="voice-interview-promo" style={{
                margin: "2rem auto",
                maxWidth: "1000px",
                background: "linear-gradient(135deg, rgba(138, 43, 226, 0.15), rgba(210, 13, 59, 0.15))",
                border: "1px solid rgba(210, 13, 59, 0.25)",
                borderRadius: "12px",
                padding: "2rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "1.5rem",
                boxShadow: "0 4px 20px rgba(0,0,0,0.15)"
            }}>
                <div style={{ flex: 1 }}>
                    <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.2rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        🗣️ Voice-to-Voice AI Interview Simulator
                    </h3>
                    <p style={{ margin: 0, fontSize: "0.88rem", color: "rgba(255, 255, 255, 0.7)", lineHeight: "1.5" }}>
                        Practice speaking your answers aloud in a realistic verbal interview simulator. Capture transcriptions automatically, track your response times, answer custom follow-up questions, and receive detailed clarity and communication feedback!
                    </p>
                </div>
                <button 
                    onClick={() => navigate("/voice-interview")} 
                    style={{
                        background: "#d20d3b",
                        border: "none",
                        color: "#fff",
                        padding: "0.75rem 1.5rem",
                        borderRadius: "6px",
                        fontWeight: "700",
                        fontSize: "0.9rem",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        transition: "background 0.2s"
                    }}
                >
                    🎙️ Enter Voice Coach
                </button>
            </section>

            {/* Recent Reports List */}
            {reports.length > 0 && (
                <section className='recent-reports'>
                    <h2>My Recent Interview Plans</h2>
                    <ul className='reports-list'>
                        {reports.map(report => (
                            <li key={report._id} className='report-item' onClick={() => navigate(`/interview/${report._id}`)}>
                                <h3>{report.title || 'Untitled Position'}</h3>
                                <p className='report-meta'>Generated on {new Date(report.createdAt).toLocaleDateString()}</p>
                                <p className={`match-score ${report.matchScore >= 80 ? 'score--high' : report.matchScore >= 60 ? 'score--mid' : 'score--low'}`}>Match Score: {report.matchScore}%</p>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {/* Page Footer */}
            <footer className='page-footer'>
                <a href='#'>Privacy Policy</a>
                <a href='#'>Terms of Service</a>
                <a href='#'>Help Center</a>
            </footer>
        </div>
    </div>
    )
}

export default Home
