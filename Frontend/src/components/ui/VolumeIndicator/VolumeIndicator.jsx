import React, { useEffect, useState, useRef } from "react";
import "./VolumeIndicator.scss";

const VolumeIndicator = ({ audio, isSpeaking, isPaused }) => {
    const [volume, setVolume] = useState(0);
    const animationRef = useRef(null);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const sourceRef = useRef(null);

    useEffect(() => {
        if (!audio || !isSpeaking || isPaused) {
            setVolume(0);
            return;
        }

        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;

            // AudioContext connection logic
            const audioCtx = new AudioContext();
            audioContextRef.current = audioCtx;

            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 64;
            analyserRef.current = analyser;

            const source = audioCtx.createMediaElementSource(audio);
            sourceRef.current = source;

            source.connect(analyser);
            analyser.connect(audioCtx.destination);

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            
            const updateVolume = () => {
                if (!analyserRef.current) return;
                analyser.getByteFrequencyData(dataArray);
                
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    sum += dataArray[i];
                }
                const average = sum / dataArray.length;
                setVolume(average); 
                animationRef.current = requestAnimationFrame(updateVolume);
            };

            updateVolume();
        } catch (err) {
            // Simulator fallback if context mapping is blocked
            let dir = 1;
            let current = 25;
            const simulate = () => {
                if (!isSpeaking || isPaused) {
                    setVolume(0);
                    return;
                }
                current += dir * (Math.random() * 12);
                if (current > 110) dir = -1;
                if (current < 15) dir = 1;
                setVolume(current);
                animationRef.current = requestAnimationFrame(simulate);
            };
            simulate();
        }

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
            if (audioContextRef.current) {
                audioContextRef.current.close().catch(() => {});
            }
        };
    }, [audio, isSpeaking, isPaused]);

    const normalizedVol = Math.min(100, (volume / 120) * 100);

    return (
        <div 
            className="volume-indicator" 
            role="progressbar" 
            aria-valuenow={Math.round(normalizedVol)} 
            aria-valuemin="0" 
            aria-valuemax="100"
            aria-label="Assistant speaking output volume level"
        >
            <span className="vol-status-dot" style={{ background: isSpeaking && !isPaused ? "#2ecc71" : "#7f8c8d" }} />
            <span className="vol-label">ASSISTANT VOLUME:</span>
            <div className="vol-bar-wrapper">
                <div className="vol-bar-fill" style={{ width: `${isSpeaking && !isPaused ? normalizedVol : 0}%` }} />
            </div>
            <span className="vol-status-text">
                {!isSpeaking ? "SILENT" : isPaused ? "PAUSED" : "SPEAKING"}
            </span>
        </div>
    );
};

export default VolumeIndicator;
