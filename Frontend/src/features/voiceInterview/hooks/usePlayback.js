import { useRef, useState, useCallback, useEffect } from 'react';
import { synthesizeSpeech } from '../services/voice.api';

/**
 * Hook to manage TTS Audio playback and preloading.
 * Maintains compound cache key logic and strict AbortController handling.
 */
export function usePlayback() {
    const audioCacheRef = useRef({}); // { 'qId-lang-spkr-spd': base64 }
    const audioRef = useRef(null);
    const ttsAbortControllerRef = useRef(null);
    const [currentAudio, setCurrentAudio] = useState(null);

    const getCacheKey = useCallback((text, lang, speaker, speed) => {
        let hash = 0;
        if (text) {
            for (let i = 0; i < text.length; i++) {
                const char = text.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash |= 0;
            }
        }
        return `hash_${hash}-${lang}-${speaker}-${speed}`;
    }, []);

    const stopPlayback = useCallback(() => {
        if (ttsAbortControllerRef.current) {
            ttsAbortControllerRef.current.abort();
            ttsAbortControllerRef.current = null;
        }
        if (audioRef.current) {
            try {
                audioRef.current.pause();
                audioRef.current.src = "";
                audioRef.current.load();
            } catch (_) {}
            audioRef.current = null;
            setCurrentAudio(null);
        }
        if (window.speechSynthesis) {
            try { window.speechSynthesis.cancel(); } catch (_) {}
        }
    }, []);

    const pausePlayback = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
        } else if (window.speechSynthesis) {
            window.speechSynthesis.pause();
        }
    }, []);

    const resumePlayback = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.play();
        } else if (window.speechSynthesis) {
            window.speechSynthesis.resume();
        }
    }, []);

    const playQuestion = useCallback(async ({ 
        text, 
        voiceLanguage, 
        voiceSpeaker, 
        speakingRate, 
        currentQIndex,
        onStart,
        onEnd,
        onError 
    }) => {
        if (!text) return;
        
        let wasAborted = false;
        const cacheKey = getCacheKey(text, voiceLanguage, voiceSpeaker, speakingRate);

        stopPlayback();

        try {
            let audioBase64 = audioCacheRef.current[cacheKey];

            if (!audioBase64) {
                const abortController = new AbortController();
                ttsAbortControllerRef.current = abortController;
                
                const data = await synthesizeSpeech({
                    text,
                    languageCode: voiceLanguage,
                    speaker: voiceSpeaker,
                    speed: speakingRate,
                    gender: voiceSpeaker === "shubh" ? "male" : "female"
                }, { signal: abortController.signal });

                if (abortController.signal.aborted) {
                    wasAborted = true;
                    return;
                }

                if (data.success && data.audios && data.audios[0]) {
                    audioBase64 = data.audios[0];
                    audioCacheRef.current[cacheKey] = audioBase64;
                } else {
                    throw new Error("No audio returned");
                }
            }

            const audioUrl = `data:audio/wav;base64,${audioBase64}`;
            const audio = new Audio(audioUrl);
            audioRef.current = audio;
            setCurrentAudio(audio);

            audio.onended = () => { if (onEnd) onEnd(); };
            audio.onerror = (e) => { if (onError) onError("Playback Error."); };

            audio.play().then(() => {
                if (onStart) onStart();
            }).catch(e => {
                if (wasAborted || e.name === "AbortError" || e.name === "NotAllowedError" || e.name === "NotSupportedError") {
                    return;
                }
                if (onError) onError("Audio playback interrupted.");
            });

        } catch (err) {
            const isErrAborted = err.name === "AbortError" || err.message?.toLowerCase().includes("abort") || err.config?.signal?.aborted;
            if (isErrAborted) {
                wasAborted = true;
                return;
            }
            
            // Fallback to native synthesis
            if (window.speechSynthesis) {
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.rate = speakingRate;
                utterance.onstart = () => { if (onStart) onStart(); };
                utterance.onend = () => { if (onEnd) onEnd(); };
                utterance.onerror = () => { if (onError) onError("Native TTS Error."); };
                window.speechSynthesis.speak(utterance);
            } else {
                if (onError) onError("Voice service unavailable.");
            }
        } finally {
            ttsAbortControllerRef.current = null;
        }
    }, [getCacheKey, stopPlayback]);

    const preloadNext = useCallback(async ({ nextQText, voiceLanguage, voiceSpeaker, speakingRate }) => {
        if (!nextQText) return;
        const cacheKey = getCacheKey(nextQText, voiceLanguage, voiceSpeaker, speakingRate);
        if (audioCacheRef.current[cacheKey]) return; 

        try {
            const data = await synthesizeSpeech({
                text: nextQText,
                languageCode: voiceLanguage,
                speaker: voiceSpeaker,
                speed: speakingRate,
                gender: voiceSpeaker === "shubh" ? "male" : "female"
            });
            if (data.success && data.audios && data.audios[0]) {
                audioCacheRef.current[cacheKey] = data.audios[0];
            }
        } catch (err) {}
    }, [getCacheKey]);

    useEffect(() => {
        return () => stopPlayback();
    }, [stopPlayback]);

    return { playQuestion, stopPlayback, pausePlayback, resumePlayback, preloadNext, currentAudio };
}
