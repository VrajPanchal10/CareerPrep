import { useState, useRef, useCallback, useEffect } from 'react';
import { transcribeVoiceAudio } from '../services/voice.api';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export function useSpeechRecognition({
    voiceLanguage,
    onStateChange,
    onError,
    onTranscriptUpdate,
    onRecordingStart,
    onBackendTranscriptReady
}) {
    const mediaRecorderRef = useRef(null);
    const recognitionRef = useRef(null);
    const audioChunksRef = useRef([]);
    const baseTranscriptRef = useRef("");
    const isMountedRef = useRef(true);
    const [mediaStream, setMediaStream] = useState(null);
    const [browserConfidence, setBrowserConfidence] = useState(1.0);
    const startTimeRef = useRef(null);
    const liveTranscriptRef = useRef("");

    // Keep stable references for callbacks/closures
    const callbacksRef = useRef({ onStateChange, onError, onTranscriptUpdate, onRecordingStart, onBackendTranscriptReady, voiceLanguage });
    useEffect(() => {
        callbacksRef.current = { onStateChange, onError, onTranscriptUpdate, onRecordingStart, onBackendTranscriptReady, voiceLanguage };
    }, [onStateChange, onError, onTranscriptUpdate, onRecordingStart, onBackendTranscriptReady, voiceLanguage]);

    const stopRecordingResources = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            try { mediaRecorderRef.current.stop(); } catch (_) {}
        }
        if (recognitionRef.current) {
            try { recognitionRef.current.stop(); } catch (_) {}
        }
        // Do NOT stop tracks synchronously here. Let mediaRecorder.onstop do it.
    }, []);

    const startRecording = useCallback(async (currentTranscript) => {
        const { onStateChange, onError, onTranscriptUpdate, onRecordingStart, voiceLanguage } = callbacksRef.current;
        stopRecordingResources();
        baseTranscriptRef.current = currentTranscript || "";
        liveTranscriptRef.current = currentTranscript || "";

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setMediaStream(stream);
            
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunksRef.current.push(event.data);
            };

            if (SpeechRecognition) {
                const recognition = new SpeechRecognition();
                recognitionRef.current = recognition;
                recognition.continuous = true;
                recognition.interimResults = true;
                recognition.lang = voiceLanguage === 'hi-IN' ? 'hi-IN' : (voiceLanguage === 'gu-IN' ? 'gu-IN' : 'en-IN');
                
                recognition.onresult = (event) => {
                    let finalT = "";
                    let interimT = "";
                    let totalConfidence = 0;
                    let countConfidence = 0;

                    for (let i = 0; i < event.results.length; ++i) {
                        const segment = event.results[i][0].transcript;
                        const conf = event.results[i][0].confidence;
                        if (conf > 0) {
                            totalConfidence += conf;
                            countConfidence++;
                        }
                        if (event.results[i].isFinal) finalT += segment;
                        else interimT += segment;
                    }

                    if (countConfidence > 0) {
                        setBrowserConfidence(totalConfidence / countConfidence);
                    }

                    const currentSpeech = (finalT + interimT).trim();
                    const previousText = baseTranscriptRef.current.trim();
                    const fullText = previousText ? `${previousText} ${currentSpeech}` : currentSpeech;
                    liveTranscriptRef.current = fullText;
                    if (callbacksRef.current.onTranscriptUpdate) {
                        callbacksRef.current.onTranscriptUpdate(fullText);
                    }
                };
                
                // Intentionally swallowed
                try { recognition.start(); } catch(e) {}
            }

            mediaRecorder.onstart = () => {
                startTimeRef.current = Date.now();
                if (onRecordingStart) onRecordingStart();
                if (onStateChange) onStateChange("RECORDING");
            };

            mediaRecorder.onstop = async () => {
                // Safely clean up the stream tracks inside the asynchronous stop callback
                if (stream) {
                    try { stream.getTracks().forEach(track => track.stop()); } catch (_) {}
                }
                setMediaStream(null);

                if (!isMountedRef.current) return;
                
                if (recognitionRef.current) {
                    try { recognitionRef.current.stop(); } catch(e){}
                }
                
                const mimeType = mediaRecorderRef.current?.mimeType || "audio/webm";
                const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
                const duration = startTimeRef.current ? (Date.now() - startTimeRef.current) / 1000 : 0;

                

                if (audioBlob.size < 500 && duration < 0.5) {
                    const hasBrowserText = liveTranscriptRef.current.trim().length > 0;
                    if (!hasBrowserText) {
                        if (isMountedRef.current && onError) {
                            onError("Recording was too short or empty. Please try again or type your answer.");
                        }
                        if (isMountedRef.current && onStateChange) onStateChange("QUESTION_READY");
                        return;
                    }
                }

                if (isMountedRef.current && onStateChange) onStateChange("PROCESSING");

                try {
                    const formData = new FormData();
                    const ext = mimeType.includes("wav") ? "wav" : "webm";
                    formData.append("file", audioBlob, `user_response.${ext}`);
                    formData.append("languageCode", callbacksRef.current.voiceLanguage);
                    formData.append("duration", duration.toString());
                    
                    const res = await transcribeVoiceAudio(formData);
                    if (res.success && res.transcript && isMountedRef.current) {
                        const sttText = res.transcript.trim();
                        if (callbacksRef.current.onBackendTranscriptReady) {
                            callbacksRef.current.onBackendTranscriptReady(sttText);
                        }
                    } else {
                        throw new Error("Empty backend transcript response");
                    }
                } catch (err) {
                    // Fallback to browser transcript if backend STT fails
                    const hasBrowserText = liveTranscriptRef.current.trim().length > 0;
                    if (hasBrowserText) {
                        
                    } else {
                        if (isMountedRef.current && onError) onError("Voice STT service unavailable. Fallback to typed text.");
                    }
                } finally {
                    if (isMountedRef.current && onStateChange) onStateChange("READY");
                }
            };

            mediaRecorder.start();
        } catch (err) {
            if (onError) onError("Microphone access is required.");
            if (onStateChange) onStateChange("QUESTION_READY");
        }
    }, [stopRecordingResources]);

    const pauseRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.pause();
            if (recognitionRef.current) try { recognitionRef.current.stop(); } catch(e){}
            if (callbacksRef.current.onStateChange) callbacksRef.current.onStateChange("PAUSED_RECORDING");
        }
    }, []);

    const resumeRecording = useCallback((currentTranscript) => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
            baseTranscriptRef.current = currentTranscript || "";
            mediaRecorderRef.current.resume();
            if (recognitionRef.current) try { recognitionRef.current.start(); } catch(e){}
            if (callbacksRef.current.onStateChange) callbacksRef.current.onStateChange("RECORDING");
        }
    }, []);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            stopRecordingResources();
        };
    }, [stopRecordingResources]);

    return { startRecording, pauseRecording, resumeRecording, stopRecordingResources, mediaStream, browserConfidence };
}
