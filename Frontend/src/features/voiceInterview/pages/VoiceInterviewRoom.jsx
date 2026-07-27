import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import Navbar from "../../ats/components/Navbar";
import { useToast, VolumeIndicator, HelpTooltip } from "../../../components/ui";
import { useInterviewSession } from "../hooks/useInterviewSession";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import { usePlayback } from "../hooks/usePlayback";
import { useTimer } from "../hooks/useTimer";
import { useTranslation } from "../hooks/useTranslation";
import { QuestionCard } from "../components/QuestionCard";
import { AudioControls } from "../components/AudioControls";
import { RecordingControls } from "../components/RecordingControls";
import { TranscriptPanel } from "../components/TranscriptPanel";
import { EvaluationPanel } from "../components/EvaluationPanel";
import { SummaryScreen } from "../components/SummaryScreen";
import { ProgressBar } from "../components/ProgressBar";
import { VoiceInterviewErrorBoundary } from "../components/ErrorService";
import "../style/voice.scss";

const VoiceInterviewRoomContent = () => {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const evaluationRef = useRef(null);

    // ── STATE MACHINE (Strictly replacing boolean chaos) ────────────────
    const [status, setStatus] = useState("LOADING");
    const [transcript, setTranscript] = useState("");
    
    // ── SETTINGS ────────────────────────────────────────────────────────
    const [speakingRate, setSpeakingRate] = useState(() => parseFloat(localStorage.getItem("careerprep_speaking_rate") || "1.0"));
    const [voiceLanguage, setVoiceLanguage] = useState(() => localStorage.getItem("careerprep_voice_language") || "en-IN");
    const [voiceSpeaker, setVoiceSpeaker] = useState(() => {
        const saved = localStorage.getItem("careerprep_voice_speaker") || "shreya";
        return saved === "meera" ? "shreya" : saved;
    });
    const [assistantVolume, setAssistantVolume] = useState(1.0);

    const [suggestedTranscript, setSuggestedTranscript] = useState("");
    const [showDiffDialog, setShowDiffDialog] = useState(false);

    // ── HOOKS ───────────────────────────────────────────────────────────
    const {
        session, currentQIndex, summaryData, resumeData,
        handleResumeSession, handleDiscardResume, nextQuestion, submitAnswer, completeSession
    } = useInterviewSession(sessionId, (loadedSession, nextIdx) => {
        if (loadedSession.status === "completed") {
            setStatus("COMPLETED");
        } else {
            setStatus("READY");
            const existingTranscript = loadedSession.transcripts?.find(t => t.questionIndex === nextIdx);
            if (existingTranscript) {
                setTranscript(existingTranscript.transcriptText);
                setStatus("EVALUATED");
            }
        }
    }, (error) => {
        addToast(error, "error");
        setStatus("IDLE");
    });

    const { displayQuestion, displayEvaluation, displayFollowUpNotification } = useTranslation(session, currentQIndex, voiceLanguage);
    const { timer, startTimer, pauseTimer, resetTimer } = useTimer();

    const { playQuestion, stopPlayback, pausePlayback, resumePlayback, preloadNext, currentAudio } = usePlayback();
    
    const { startRecording, pauseRecording, resumeRecording, stopRecordingResources, mediaStream, browserConfidence } = useSpeechRecognition({
        voiceLanguage,
        onStateChange: (recState) => {
            if (recState === "QUESTION_READY") setStatus("READY");
            else if (recState === "PAUSED_RECORDING") setStatus("PAUSED");
            else setStatus(recState);
        },
        onError: (err) => {
            addToast(err, "error");
            setStatus("READY");
        },
        onTranscriptUpdate: setTranscript,
        onRecordingStart: startTimer,
        onBackendTranscriptReady: (backendSttText) => {
            if (transcript.trim() !== backendSttText.trim() && backendSttText.trim().length > 0) {
                setSuggestedTranscript(backendSttText);
                setShowDiffDialog(true);
            }
        }
    });

    // ── LANGUAGE SYNC ───────────────────────────────────────────────────
    useEffect(() => {
        localStorage.setItem("careerprep_voice_language", voiceLanguage);
        stopPlayback();
    }, [voiceLanguage, stopPlayback]);

    // ── SPEAKER SYNC ────────────────────────────────────────────────────
    useEffect(() => {
        localStorage.setItem("careerprep_voice_speaker", voiceSpeaker);
        stopPlayback();
    }, [voiceSpeaker, stopPlayback]);

    // ── SPEED SYNC ──────────────────────────────────────────────────────
    useEffect(() => {
        localStorage.setItem("careerprep_speaking_rate", speakingRate.toString());
        stopPlayback();
    }, [speakingRate, stopPlayback]);

    // ── VOLUME SYNC ─────────────────────────────────────────────────────
    useEffect(() => {
        if (currentAudio) {
            currentAudio.volume = assistantVolume;
        }
    }, [currentAudio, assistantVolume]);

    // ── AUTO SCROLL TO EVALUATION ───────────────────────────────────────
    useEffect(() => {
        if (status === "EVALUATED" && evaluationRef.current) {
            // Delay slightly to ensure layout has updated and DOM rendered
            setTimeout(() => {
                evaluationRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 100);
        }
    }, [status]);

    // ── ACTION HANDLERS ─────────────────────────────────────────────────
    const onPlay = useCallback(() => {
        setStatus("PROCESSING");
        playQuestion({
            text: displayQuestion,
            voiceLanguage,
            voiceSpeaker,
            speakingRate,
            currentQIndex,
            onStart: () => setStatus("PLAYING"),
            onEnd: () => setStatus("READY"),
            onError: (err) => {
                addToast(err, "error");
                setStatus("READY");
            }
        });
    }, [displayQuestion, voiceLanguage, voiceSpeaker, speakingRate, currentQIndex, playQuestion, addToast]);

    const onRecordStart = useCallback(() => {
        setTranscript("");
        resetTimer(0);
        const nextQText = session?.questions[currentQIndex + 1]?.questionText;
        if (nextQText) {
            preloadNext({ nextQText, nextQIndex: currentQIndex + 1, voiceLanguage, voiceSpeaker, speakingRate });
        }
        startRecording("");
    }, [resetTimer, session, currentQIndex, startRecording, preloadNext, voiceLanguage, voiceSpeaker, speakingRate]);

    const onSubmit = useCallback(async () => {
        if (!transcript || transcript.trim() === "") {
            addToast("Please provide an answer before submitting.", "warning");
            return;
        }
        
        setStatus("PROCESSING");
        stopRecordingResources();
        pauseTimer();

        const result = await submitAnswer({ transcript, timer, voiceLanguage });
        if (result.success) {
            if (result.hasFollowUp) {
                addToast("A contextual follow-up question was generated!", "info");
            }
            if (result.languageMismatchWarning) {
                addToast(result.languageMismatchWarning, "warning");
            }
            setStatus("EVALUATED");
        } else {
            addToast(result.error, "error");
            setStatus("READY");
        }
    }, [transcript, stopRecordingResources, pauseTimer, submitAnswer, timer, voiceLanguage, addToast]);

    const onNext = useCallback(() => {
        if (nextQuestion()) {
            setTranscript("");
            resetTimer(0);
            setStatus("READY");
        }
    }, [nextQuestion, resetTimer]);

    const onComplete = useCallback(async () => {
        setStatus("PROCESSING");
        stopPlayback();
        const res = await completeSession();
        if (res.success) {
            setStatus("COMPLETED");
        } else {
            addToast(res.error, "error");
            setStatus("EVALUATED");
        }
    }, [completeSession, stopPlayback, addToast]);

    const acceptResume = () => {
        const res = handleResumeSession();
        if (res) {
            setTranscript(res.transcript || "");
            resetTimer(res.timer || 0);
            setStatus(res.interviewState || "READY");
        }
    };

    // ── RENDER ──────────────────────────────────────────────────────────
    if (status === "LOADING" || status === "IDLE" || !session) {
        return (
            <div className="voice-room-container">
                <Navbar />
                <main style={{ padding: "3rem", textAlign: "center", color: "rgba(255,255,255,0.4)" }}>
                    <h2>Connecting to voice simulator room...</h2>
                </main>
            </div>
        );
    }

    if (resumeData) {
        return (
            <div className="voice-room-container">
                <Navbar />
                <div className="resume-banner" style={{ textAlign: "center", padding: "2rem", color: "#fff" }}>
                    <p>You have an unsaved session in progress.</p>
                    <div style={{ display: "flex", justifyContent: "center", gap: "1rem", marginTop: "1rem" }}>
                        <button onClick={acceptResume} className="btn btn--primary">Resume</button>
                        <button onClick={handleDiscardResume} className="btn btn--secondary">Discard</button>
                    </div>
                </div>
            </div>
        );
    }

    if (status === "COMPLETED") {
        return <SummaryScreen summaryData={summaryData} />;
    }

    const currentQ = session.questions[currentQIndex];

    return (
        <div className="voice-room-container">
            <Navbar />
            <header className="voice-header">
                <div className="header-left">
                    <h1>
                        <span className="title-full">AI Technical Interview</span>
                        <span className="title-short">AI Interview</span>
                    </h1>
                    <p>Voice-enabled interactive session. Answer verbally for the best experience.</p>
                </div>
                <div className="header-right">
                    <button className="back-btn-ghost" onClick={onComplete} disabled={status === "PROCESSING"} id="exitInterviewSessionBtn">
                        <ArrowLeft size={16} strokeWidth={2.5} />
                        <span className="btn-text-full">Exit Session</span>
                        <span className="btn-text-short">Exit</span>
                    </button>
                </div>
            </header>

            <main className="room-layout">
                {displayFollowUpNotification && (
                    <div style={{ background: "rgba(241, 196, 15, 0.1)", border: "1px solid rgba(241, 196, 15, 0.3)", padding: "1rem", borderRadius: "8px", color: "#f1c40f", marginBottom: "1.5rem" }}>
                        {displayFollowUpNotification}
                    </div>
                )}
                
                <ProgressBar currentQIndex={currentQIndex} totalQuestions={session.questions.length} />

                <div className="simulator-card">
                    <QuestionCard 
                        questionIndex={currentQIndex}
                        totalQuestions={session.questions.length}
                        displayQuestion={displayQuestion}
                        isFollowUp={currentQ.isFollowUp}
                        intention={currentQ.intention}
                        voiceLanguage={voiceLanguage}
                        interviewState={status}
                    >
                        <AudioControls 
                            interviewState={status}
                            onPlay={onPlay}
                            onPause={() => { pausePlayback(); setStatus("PAUSED"); }}
                            onResume={() => { resumePlayback(); setStatus("PLAYING"); }}
                            onStop={() => { stopPlayback(); setStatus("READY"); }}
                            speakingRate={speakingRate}
                            setSpeakingRate={setSpeakingRate}
                            voiceLanguage={voiceLanguage}
                            setVoiceLanguage={setVoiceLanguage}
                            voiceSpeaker={voiceSpeaker}
                            setVoiceSpeaker={setVoiceSpeaker}
                        >
                            <div className="assistant-volume-card">
                                <div className="volume-control-header">
                                    <span className="section-title">Assistant Volume</span>
                                    <span className="volume-percent-badge">{Math.round(assistantVolume * 100)}%</span>
                                </div>
                                <div className="volume-slider-row">
                                    <input 
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.05"
                                        value={assistantVolume}
                                        onChange={(e) => setAssistantVolume(parseFloat(e.target.value))}
                                        className="voice-slider-full"
                                    />
                                </div>
                                <div className="volume-status-row">
                                    <VolumeIndicator 
                                        audio={currentAudio} 
                                        isSpeaking={status === "PLAYING"} 
                                        isPaused={status === "PAUSED"} 
                                    />
                                </div>
                            </div>
                        </AudioControls>
                    </QuestionCard>



                    <RecordingControls 
                        interviewState={status}
                        onRecordStart={onRecordStart}
                        onRecordPause={() => { pauseRecording(); pauseTimer(); }}
                        onRecordResume={() => { resumeRecording(transcript); startTimer(); }}
                        onSubmit={onSubmit}
                        timer={timer}
                    />

                    <TranscriptPanel 
                        transcript={transcript}
                        onTranscriptChange={setTranscript}
                        interviewState={status}
                        timer={timer}
                        browserConfidence={browserConfidence}
                        voiceLanguage={voiceLanguage}
                    />

                    <div ref={evaluationRef}>
                        <EvaluationPanel evaluation={displayEvaluation} voiceLanguage={voiceLanguage} />
                    </div>

                    <div className="action-row">
                        <div className="action-left">
                            <button onClick={() => {}} className="btn btn--secondary nav-btn" disabled={true}>
                                <i className="fi fi-rr-arrow-left"></i> Previous
                            </button>
                        </div>

                        <div className="action-right">
                            {status === "PROCESSING" ? (
                                <button 
                                    className="btn btn--primary nav-btn"
                                    disabled={true}
                                >
                                    <span style={{
                                        display: "inline-block",
                                        width: "14px",
                                        height: "14px",
                                        border: "2px solid rgba(255,255,255,0.3)",
                                        borderTop: "2px solid #fff",
                                        borderRadius: "50%",
                                        animation: "inline-spin 1s linear infinite"
                                    }} />
                                    Evaluating...
                                </button>
                            ) : status === "EVALUATED" ? (
                                currentQIndex >= session.questions.length - 1 ? (
                                    <button onClick={onComplete} className="btn btn--primary nav-btn">
                                        <i className="fi fi-rr-check"></i> Finish Interview
                                    </button>
                                ) : (
                                    <button onClick={onNext} className="btn btn--primary nav-btn">
                                        Next Question <i className="fi fi-rr-arrow-right"></i>
                                    </button>
                                )
                            ) : (
                                <button 
                                    onClick={onSubmit}
                                    className="btn btn--primary nav-btn"
                                    disabled={!transcript || transcript.trim() === ""}
                                >
                                    <i className="fi fi-rr-magic-wand"></i> Submit Answer
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Diff Dialog for Backend STT verification */}
                {showDiffDialog && (
                    <div style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: "rgba(0,0,0,0.8)",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        zIndex: 9999,
                        padding: "1rem"
                    }}>
                        <div style={{
                            background: "#181824",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: "12px",
                            padding: "2rem",
                            maxWidth: "600px",
                            width: "100%"
                        }}>
                            <h3 style={{ color: "#fff", marginBottom: "1rem" }}>We detected a cleaner audio transcription</h3>
                            
                            <div style={{ background: "rgba(255,255,255,0.03)", padding: "1rem", borderRadius: "8px", color: "rgba(255,255,255,0.6)", fontSize: "0.9rem", marginBottom: "1rem" }}>
                                <strong style={{ color: "#fff" }}>Your Edited Text:</strong>
                                <p style={{ marginTop: "0.5rem" }}>{transcript}</p>
                            </div>

                            <div style={{ background: "rgba(39, 174, 96, 0.1)", border: "1px solid rgba(39, 174, 96, 0.3)", padding: "1rem", borderRadius: "8px", color: "#27ae60", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
                                <strong>Suggested Text (Backend STT):</strong>
                                <p style={{ marginTop: "0.5rem" }}>{suggestedTranscript}</p>
                            </div>

                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem" }}>
                                <button onClick={() => setShowDiffDialog(false)} className="btn btn--secondary" style={{ padding: "0.6rem 1.2rem" }}>
                                    Keep Mine
                                </button>
                                <button onClick={() => { setTranscript(suggestedTranscript); setShowDiffDialog(false); }} className="btn btn--primary" style={{ padding: "0.6rem 1.2rem", background: "#27ae60" }}>
                                    Replace
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default function VoiceInterviewRoom() {
    return (
        <VoiceInterviewErrorBoundary>
            <VoiceInterviewRoomContent />
        </VoiceInterviewErrorBoundary>
    );
}
