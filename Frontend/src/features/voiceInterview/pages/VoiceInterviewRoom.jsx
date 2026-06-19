import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import Navbar from "../../ats/components/Navbar";
import {
    fetchVoiceSession,
    submitVoiceAnswer,
    completeVoiceSession
} from "../services/voice.api";
import "../style/voice.scss";

// Native Speech Recognition Setup
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const VoiceInterviewRoom = () => {
    const { sessionId } = useParams();
    const navigate = useNavigate();

    // Session State
    const [session, setSession] = useState(null);
    const [currentQIndex, setCurrentQIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState("");

    // TTS Speech Synthesis State
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isPausedTTS, setIsPausedTTS] = useState(false);
    const [speakingRate, setSpeakingRate] = useState(1.0); // 0.8 to 1.5

    // STT Speech Recognition State
    const [isRecording, setIsRecording] = useState(false);
    const [transcript, setTranscript] = useState("");
    const [recognitionSupported, setRecognitionSupported] = useState(false);
    const recognitionRef = useRef(null);

    // Response Time Tracking State
    const [timer, setTimer] = useState(0);
    const [timerActive, setTimerActive] = useState(false);
    const timerIntervalRef = useRef(null);

    // Evaluation State for Current Question
    const [currentEvaluation, setCurrentEvaluation] = useState(null);
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [followUpNotification, setFollowUpNotification] = useState("");

    // Summary Screen State
    const [isSessionCompleted, setIsSessionCompleted] = useState(false);
    const [summaryData, setSummaryData] = useState(null);
    const [isCompleting, setIsCompleting] = useState(false);

    // Initialize Room
    useEffect(() => {
        setRecognitionSupported(!!SpeechRecognition);
        loadSessionDetails();

        return () => {
            // Cleanup speech and timers on unmount
            if (window.speechSynthesis) {
                window.speechSynthesis.cancel();
            }
            stopTimer();
            if (recognitionRef.current) {
                recognitionRef.current.abort();
            }
        };
    }, []);

    // Load active question speech on change
    useEffect(() => {
        if (session && session.questions && session.questions[currentQIndex]) {
            const question = session.questions[currentQIndex];
            
            // Speak question automatically
            setTimeout(() => {
                handleSpeak(question.questionText);
            }, 800);

            // Reset evaluation, timer, transcript for this index
            const existingTranscript = session.transcripts?.find(t => t.questionIndex === currentQIndex);
            const existingEval = session.evaluations?.find(e => e.questionIndex === currentQIndex);
            
            setTranscript(existingTranscript ? existingTranscript.transcriptText : "");
            setCurrentEvaluation(existingEval || null);
            setTimer(existingTranscript ? existingTranscript.responseTime : 0);
            setTimerActive(false);
            setFollowUpNotification("");
        }
    }, [currentQIndex, session]);

    const loadSessionDetails = async () => {
        setIsLoading(true);
        setErrorMsg("");
        try {
            const data = await fetchVoiceSession(sessionId);
            if (data.success) {
                setSession(data.session);
                
                // Set index to the first unanswered question
                const answeredIndexes = data.session.evaluations.map(e => e.questionIndex);
                let nextIdx = 0;
                for (let i = 0; i < data.session.questions.length; i++) {
                    if (!answeredIndexes.includes(i)) {
                        nextIdx = i;
                        break;
                    }
                }
                
                // If all answered but status is started, place at end
                if (answeredIndexes.length === data.session.questions.length) {
                    nextIdx = data.session.questions.length - 1;
                }

                setCurrentQIndex(nextIdx);

                if (data.session.status === "completed") {
                    setIsSessionCompleted(true);
                    setSummaryData(data.session);
                }
            }
        } catch (err) {
            console.error("Failed to load session details", err);
            setErrorMsg("Could not retrieve session details.");
        } finally {
            setIsLoading(false);
        }
    };

    // --- TEXT TO SPEECH (TTS) HELPERS ---
    const handleSpeak = (text) => {
        if (!window.speechSynthesis) return;

        window.speechSynthesis.cancel(); // stop any current speech
        setIsPausedTTS(false);

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = speakingRate;

        utterance.onstart = () => {
            setIsSpeaking(true);
        };

        utterance.onend = () => {
            setIsSpeaking(false);
            // Proactively trigger timer to start counting once question is read
            startTimer();
        };

        utterance.onerror = (e) => {
            console.error("Speech Synthesis Error:", e);
            setIsSpeaking(false);
        };

        window.speechSynthesis.speak(utterance);
    };

    const handlePauseResumeTTS = () => {
        if (!window.speechSynthesis) return;

        if (isSpeaking) {
            if (isPausedTTS) {
                window.speechSynthesis.resume();
                setIsPausedTTS(false);
            } else {
                window.speechSynthesis.pause();
                setIsPausedTTS(true);
            }
        }
    };

    const handleStopTTS = () => {
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
            setIsPausedTTS(false);
        }
    };

    // --- RESPONSE TIMER HELPERS ---
    const startTimer = () => {
        stopTimer();
        setTimerActive(true);
        timerIntervalRef.current = setInterval(() => {
            setTimer(prev => prev + 1);
        }, 1000);
    };

    const stopTimer = () => {
        setTimerActive(false);
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }
    };

    // --- SPEECH TO TEXT (STT) HELPERS ---
    const startSpeechRecognition = () => {
        if (!recognitionSupported) return;

        // Ensure TTS is stopped when user starts speaking
        handleStopTTS();

        if (recognitionRef.current) {
            recognitionRef.current.abort();
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onstart = () => {
            setIsRecording(true);
            startTimer(); // ensure timer is ticking
        };

        recognition.onresult = (event) => {
            let finalResult = "";
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalResult += event.results[i][0].transcript + " ";
                }
            }
            if (finalResult) {
                setTranscript(prev => (prev + " " + finalResult).trim());
            }
        };

        recognition.onerror = (event) => {
            console.error("Speech Recognition Error:", event.error);
            if (event.error !== "no-speech") {
                setIsRecording(false);
            }
        };

        recognition.onend = () => {
            setIsRecording(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
    };

    const stopSpeechRecognition = () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
        setIsRecording(false);
        stopTimer();
    };

    // --- QUESTION SUBMISSION & COMPLETION ---
    const handleSubmitAnswer = async () => {
        if (!transcript || transcript.trim() === "") {
            alert("Please record or type your answer before submitting.");
            return;
        }

        // Stop recording and timers if active
        if (isRecording) {
            stopSpeechRecognition();
        }
        stopTimer();
        handleStopTTS();

        setIsEvaluating(true);
        setErrorMsg("");
        setFollowUpNotification("");
        try {
            const data = await submitVoiceAnswer({
                sessionId,
                questionIndex: currentQIndex,
                userAnswer: transcript,
                responseTime: timer
            });

            if (data.success) {
                setCurrentEvaluation(data.evaluation);
                
                // Check if a follow-up was generated and injected
                if (data.followUpQuestion) {
                    setFollowUpNotification("💡 Follow-up: The AI interviewer has generated a contextual follow-up question based on your answer!");
                    
                    // Update local session object with the injected question
                    setSession(data.session);
                }
            }
        } catch (err) {
            console.error(err);
            setErrorMsg(err.response?.data?.message || "Failed to submit and evaluate your verbal answer.");
        } finally {
            setIsEvaluating(false);
        }
    };

    const handleNextQuestion = () => {
        if (!session || !session.questions) return;
        if (currentQIndex < session.questions.length - 1) {
            setCurrentQIndex(prev => prev + 1);
        }
    };

    const handleCompleteSession = async () => {
        setIsCompleting(true);
        setErrorMsg("");
        handleStopTTS();
        try {
            const data = await completeVoiceSession(sessionId);
            if (data.success) {
                setSummaryData(data.session);
                setIsSessionCompleted(true);
                // Also update local session
                setSession(data.session);
            }
        } catch (err) {
            console.error(err);
            setErrorMsg("Failed to complete voice practice session statistics.");
        } finally {
            setIsCompleting(false);
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    };

    if (isLoading || !session) {
        return (
            <div className="voice-room-container">
                <Navbar />
                <main style={{ padding: "3rem", textAlign: "center", color: "rgba(255,255,255,0.4)" }}>
                    <h2>Connecting to voice simulator room...</h2>
                </main>
            </div>
        );
    }

    const currentQuestion = session.questions[currentQIndex];
    const isLastQuestion = currentQIndex === session.questions.length - 1;

    // RENDER SESSION SUMMARY SCREEN IF COMPLETED
    if (isSessionCompleted && summaryData) {
        const solvedFollowUps = summaryData.questions.filter(q => q.isFollowUp).length;
        
        return (
            <div className="voice-room-container">
                <Navbar />
                <header className="voice-header">
                    <div className="header-left">
                        <h1>Practice Session Summary Report</h1>
                        <p>Detailed performance analytics, score averages, and career coach recommendation.</p>
                    </div>
                    <div className="header-right">
                        <button onClick={() => navigate("/voice-interview")} className="back-btn" id="finishBackBtn">
                            Exit Summary
                        </button>
                    </div>
                </header>

                <main className="room-layout" id="summaryView">
                    <div className="simulator-card summary-layout">
                        <h2 style={{ fontSize: "1.3rem", fontWeight: "800", color: "#fff", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "0.5rem", margin: "0" }}>
                            🎯 Mock Performance Dashboard Card
                        </h2>

                        {/* Scores Grid */}
                        <div className="summary-scores-grid">
                            <div className="score-box overall" id="summaryOverallBox">
                                <h3>Overall Score</h3>
                                <div className="score">{summaryData.overallScore}<span>%</span></div>
                            </div>
                            <div className="score-box comm" id="summaryCommBox">
                                <h3>Communication</h3>
                                <div className="score">{summaryData.communicationScore}<span>%</span></div>
                            </div>
                            <div className="score-box tech" id="summaryTechBox">
                                <h3>Technical Accuracy</h3>
                                <div className="score">{summaryData.technicalScore}<span>%</span></div>
                            </div>
                        </div>

                        {/* Coach recommendation */}
                        <div className="coach-card" id="summaryCoachCard">
                            <h3>🗣️ AI Career Coach Strategic Advice</h3>
                            <p>{summaryData.topRecommendation}</p>
                        </div>

                        {/* Strong/Weak bullet lists */}
                        <div className="summary-bullets-grid">
                            <div className="bullet-card strong" id="summaryStrongCard">
                                <h3>✔️ Strong Topics</h3>
                                <ul>
                                    {summaryData.strongAreas?.map((area, idx) => <li key={idx}>{area}</li>)}
                                    {(!summaryData.strongAreas || summaryData.strongAreas.length === 0) && <li>No specific topic mastered yet.</li>}
                                </ul>
                            </div>
                            <div className="bullet-card weak" id="summaryWeakCard">
                                <h3>⚠️ Needs Practice</h3>
                                <ul>
                                    {summaryData.weakAreas?.map((area, idx) => <li key={idx}>{area}</li>)}
                                    {(!summaryData.weakAreas || summaryData.weakAreas.length === 0) && <li>No significant topic gaps found!</li>}
                                </ul>
                            </div>
                        </div>

                        {/* Session statistics */}
                        <div className="summary-stats-box" id="summaryStatsBox">
                            <h3>Session Statistics</h3>
                            <div className="stats-flex">
                                <div className="stat-item">
                                    <span className="lbl">Difficulty</span>
                                    <span className="val">{summaryData.difficulty}</span>
                                </div>
                                <div className="stat-item">
                                    <span className="lbl">Questions Solved</span>
                                    <span className="val">{summaryData.questions.length} total</span>
                                </div>
                                <div className="stat-item">
                                    <span className="lbl">Follow-Ups Solved</span>
                                    <span className="val">{solvedFollowUps} questions</span>
                                </div>
                                <div className="stat-item">
                                    <span className="lbl">Avg Response Time</span>
                                    <span className="val" id="summaryAvgResponseTime">{summaryData.averageResponseTime}s</span>
                                </div>
                                <div className="stat-item">
                                    <span className="lbl">Total Speaking Time</span>
                                    <span className="val">{formatTime(summaryData.totalDuration)}</span>
                                </div>
                            </div>
                        </div>

                        <div style={{ textAlign: "center", marginTop: "1rem" }}>
                            <button 
                                onClick={() => navigate("/voice-interview")} 
                                className="btn btn--primary"
                                style={{ display: "inline-flex", background: "linear-gradient(135deg, #8a2be2, #d20d3b)", padding: "0.8rem 2.5rem" }}
                            >
                                Return to Voice Dashboard
                            </button>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="voice-room-container">
            <Navbar />

            <header className="voice-header">
                <div className="header-left">
                    <h1 id="roomTitle">Verbal Simulator Workspace</h1>
                    <p>Listen, speak, edit transcriptions, and view detailed evaluations. Fallback keyboard support included.</p>
                </div>
                <div className="header-right">
                    <button 
                        onClick={() => {
                            if (window.confirm("Exit practice session? Unsaved progress will be lost.")) {
                                navigate("/voice-interview");
                            }
                        }} 
                        className="back-btn"
                        id="exitRoomBtn"
                    >
                        Exit Session
                    </button>
                </div>
            </header>

            {errorMsg && (
                <div style={{ background: "rgba(192, 41, 43, 0.15)", border: "1px solid #c0392b", color: "#c0392b", margin: "1.5rem auto 0", maxWidth: "900px", padding: "0.75rem 1.2rem", borderRadius: "6px", fontSize: "0.88rem" }}>
                    <strong>Error:</strong> {errorMsg}
                </div>
            )}

            <main className="room-layout">
                <div className="simulator-card">
                    {/* Session Progress Header */}
                    <div className="session-progress-bar">
                        <div className="bar-text">
                            <span>Questions Practice Progress</span>
                            <span>{currentQIndex + 1} of {session.questions.length}</span>
                        </div>
                        <div className="track">
                            <div 
                                className="fill" 
                                style={{ width: `${((currentQIndex + 1) / session.questions.length) * 100}%` }} 
                            />
                        </div>
                    </div>

                    {/* Question text reading - Speech Synthesis panel */}
                    <div className="speech-synth-card" id="speechSynthesisPanel">
                        <div className={`ai-avatar ${isSpeaking ? "speaking" : ""}`} id="aiAvatar">
                            🤖
                        </div>
                        <h2 className="question-speech-text" id="questionText">
                            {currentQuestion ? currentQuestion.questionText : "Loading question..."}
                        </h2>
                        
                        {/* Audio controls */}
                        <div className="speech-controls">
                            <div className="speed-slider">
                                <span>Speed: {speakingRate}x</span>
                                <input
                                    type="range"
                                    min="0.8"
                                    max="1.5"
                                    step="0.1"
                                    value={speakingRate}
                                    onChange={(e) => setSpeakingRate(parseFloat(e.target.value))}
                                    id="rateSlider"
                                />
                            </div>
                            <button onClick={() => currentQuestion && handleSpeak(currentQuestion.questionText)} className="control-btn" id="replaySpeechBtn">
                                🔊 Replay Question
                            </button>
                            <button onClick={handlePauseResumeTTS} className="control-btn" id="pauseSpeechBtn">
                                {isPausedTTS ? "▶️ Resume" : "⏸️ Pause"}
                            </button>
                            <button onClick={handleStopTTS} className="control-btn" id="stopSpeechBtn">
                                ⏹️ Stop Audio
                            </button>
                        </div>
                    </div>

                    {/* Follow-up question banner notifier */}
                    {followUpNotification && (
                        <div style={{ background: "rgba(138,43,226,0.12)", border: "1px solid rgba(138,43,226,0.3)", color: "#c193f5", padding: "0.8rem 1.2rem", borderRadius: "8px", fontSize: "0.88rem" }} id="followUpNotification">
                            {followUpNotification}
                        </div>
                    )}

                    {/* Recording section - Speech recognition triggers */}
                    <div className="recorder-section" id="recorderSection">
                        {!recognitionSupported && (
                            <div style={{ background: "rgba(243,156,18,0.15)", border: "1px solid #f39c12", color: "#f39c12", padding: "0.5rem 1rem", borderRadius: "6px", fontSize: "0.8rem", textAlign: "center" }}>
                                ⚠️ Web Speech API is not supported in this browser. Please use Google Chrome or type answers manually.
                            </div>
                        )}
                        <div className="mic-button-container">
                            <button
                                onClick={isRecording ? stopSpeechRecognition : startSpeechRecognition}
                                className={`mic-btn ${isRecording ? "recording" : ""}`}
                                disabled={!recognitionSupported}
                                id="micToggleBtn"
                                title={isRecording ? "Stop Recording" : "Start Speaking Answer"}
                            >
                                🎙️
                            </button>
                            {isRecording && <div className="pulse-ring" />}
                        </div>
                        <div className="timer-display" id="timerDisplay">
                            {isRecording && <span className="dot" />}
                            <span>Time elapsed: {formatTime(timer)}</span>
                        </div>
                    </div>

                    {/* Transcript edit panel (Manual answer fallback) */}
                    <div className="transcript-card" id="transcriptCard">
                        <h4>Spoken Transcription / Typed Answer</h4>
                        <textarea
                            value={transcript}
                            onChange={(e) => setTranscript(e.target.value)}
                            placeholder="Your transcribed text will populate here as you speak. Alternatively, you can type your answer manually here..."
                            disabled={isEvaluating}
                            id="transcriptTextarea"
                        />
                    </div>

                    {/* Bottom Action Row */}
                    <div className="action-row">
                        <div className="row-left">
                            <button 
                                onClick={() => setCurrentQIndex(idx => Math.max(0, idx - 1))} 
                                disabled={currentQIndex === 0 || isEvaluating}
                                className="btn btn--secondary"
                                id="prevQuestionBtn"
                            >
                                ⬅ Prev
                            </button>
                            <button
                                onClick={handleNextQuestion}
                                disabled={currentQIndex >= session.questions.length - 1 || !currentEvaluation || isEvaluating}
                                className="btn btn--secondary"
                                id="nextQuestionBtn"
                            >
                                Next ➡
                            </button>
                        </div>

                        {/* Submit solution or Complete interview */}
                        <div style={{ display: "flex", gap: "0.75rem" }}>
                            <button
                                onClick={handleSubmitAnswer}
                                disabled={isEvaluating || !transcript.trim()}
                                className="btn btn--primary"
                                id="submitAnswerBtn"
                            >
                                {isEvaluating ? (
                                    <>
                                        <span className="spinner" style={{ display: "inline-block", width: "12px", height: "12px", border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.6s linear infinite", marginRight: "5px" }} />
                                        Evaluating...
                                    </>
                                ) : (
                                    <>✨ Submit Answer</>
                                )}
                            </button>

                            {/* Show complete button only if they have evaluated at least one answer */}
                            {session.evaluations.length > 0 && (
                                <button
                                    onClick={handleCompleteSession}
                                    disabled={isCompleting || isEvaluating}
                                    className="btn btn--primary"
                                    style={{ background: "linear-gradient(135deg, #8a2be2, #d20d3b)" }}
                                    id="completeSessionBtn"
                                >
                                    {isCompleting ? "Compiling Report..." : "🏁 Finish Interview"}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Question evaluation feedback bullets */}
                    {currentEvaluation && (
                        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", padding: "1.5rem" }} id="questionEvaluationBox">
                            <h3 style={{ margin: "0 0 1rem 0", fontSize: "1rem", color: "#fff", display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "0.5rem" }}>
                                <span>📊 Answer Score Evaluation</span>
                                <span style={{ color: currentEvaluation.overallScore >= 75 ? "#2ecc71" : currentEvaluation.overallScore >= 60 ? "#f1c40f" : "#e74c3c", fontWeight: "800" }}>
                                    {currentEvaluation.overallScore}%
                                </span>
                            </h3>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
                                <div style={{ background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: "6px", padding: "0.6rem", textAlign: "center" }}>
                                    <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.6)", textTransform: "uppercase", display: "block" }}>Comm</span>
                                    <span style={{ fontSize: "1.1rem", fontWeight: "700" }}>{currentEvaluation.communicationScore}%</span>
                                </div>
                                <div style={{ background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: "6px", padding: "0.6rem", textAlign: "center" }}>
                                    <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.6)", textTransform: "uppercase", display: "block" }}>Clarity</span>
                                    <span style={{ fontSize: "1.1rem", fontWeight: "700" }}>{currentEvaluation.clarityScore}%</span>
                                </div>
                                <div style={{ background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: "6px", padding: "0.6rem", textAlign: "center" }}>
                                    <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.6)", textTransform: "uppercase", display: "block" }}>Technical</span>
                                    <span style={{ fontSize: "1.1rem", fontWeight: "700" }}>{currentEvaluation.technicalScore}%</span>
                                </div>
                                <div style={{ background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: "6px", padding: "0.6rem", textAlign: "center" }}>
                                    <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.6)", textTransform: "uppercase", display: "block" }}>Explanation</span>
                                    <span style={{ fontSize: "1.1rem", fontWeight: "700" }}>{currentEvaluation.explanationScore}%</span>
                                </div>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
                                <div>
                                    <h4 style={{ color: "#27ae60", margin: "0 0 0.5rem 0", fontSize: "0.85rem", textTransform: "uppercase" }}>✅ Key Strengths</h4>
                                    <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.82rem", color: "rgba(255,255,255,0.7)" }}>
                                        {currentEvaluation.strengths?.map((s, i) => <li key={i} style={{ marginBottom: "0.3rem" }}>{s}</li>)}
                                    </ul>
                                </div>
                                <div>
                                    <h4 style={{ color: "#e67e22", margin: "0 0 0.5rem 0", fontSize: "0.85rem", textTransform: "uppercase" }}>⚠️ Gaps / Improvements</h4>
                                    <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.82rem", color: "rgba(255,255,255,0.7)" }}>
                                        {currentEvaluation.weaknesses?.map((w, i) => <li key={i} style={{ marginBottom: "0.3rem" }}>{w}</li>)}
                                    </ul>
                                </div>
                            </div>

                            {currentEvaluation.suggestions && currentEvaluation.suggestions.length > 0 && (
                                <div style={{ marginTop: "1rem", borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: "1rem" }}>
                                    <h4 style={{ color: "#3498db", margin: "0 0 0.5rem 0", fontSize: "0.85rem", textTransform: "uppercase" }}>💡 Career Coach Recommendations</h4>
                                    <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.82rem", color: "rgba(255,255,255,0.7)" }}>
                                        {currentEvaluation.suggestions.map((s, i) => <li key={i} style={{ marginBottom: "0.3rem" }}>{s}</li>)}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default VoiceInterviewRoom;
