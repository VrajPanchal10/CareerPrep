import React, { useEffect, useRef, useState } from "react";
import "./WaveformVisualizer.scss";

const WaveformVisualizer = ({ stream, isRecording }) => {
    const canvasRef = useRef(null);
    const [hasPermissionError, setPermissionError] = useState(false);
    const animationRef = useRef(null);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const dataArrayRef = useRef(null);

    useEffect(() => {
        if (!stream || !isRecording) {
            cleanupAudio();
            drawIdleState();
            return;
        }

        try {
            // Initialize Web Audio Analyzer
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) {
                drawIdleState();
                return;
            }

            const audioCtx = new AudioContext();
            audioContextRef.current = audioCtx;

            const source = audioCtx.createMediaStreamSource(stream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            analyserRef.current = analyser;

            source.connect(analyser);

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            dataArrayRef.current = dataArray;

            setPermissionError(false);
            renderWave();
        } catch (err) {
            console.error("Failed to initialize waveform audio analyser:", err);
            drawIdleState();
        }

        return () => {
            cleanupAudio();
        };
    }, [stream, isRecording]);

    const cleanupAudio = () => {
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
            animationRef.current = null;
        }
        if (audioContextRef.current) {
            if (audioContextRef.current.state !== "closed") {
                audioContextRef.current.close().catch(e => console.log(e));
            }
            audioContextRef.current = null;
        }
        analyserRef.current = null;
        dataArrayRef.current = null;
    };

    const drawIdleState = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;

        ctx.clearRect(0, 0, width, height);
        
        // Draw standard subtle flat line with gradient glow
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
    };

    const renderWave = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;
        const analyser = analyserRef.current;
        const dataArray = dataArrayRef.current;

        const draw = () => {
            if (!analyserRef.current || !dataArrayRef.current) return;
            animationRef.current = requestAnimationFrame(draw);

            analyser.getByteTimeDomainData(dataArray);

            ctx.clearRect(0, 0, width, height);
            
            // Draw gradient background wave line
            ctx.lineWidth = 3;
            const gradient = ctx.createLinearGradient(0, 0, width, 0);
            gradient.addColorStop(0, "#d20d3b");
            gradient.addColorStop(0.5, "#8a2be2");
            gradient.addColorStop(1, "#d20d3b");
            ctx.strokeStyle = gradient;
            
            ctx.beginPath();
            const sliceWidth = width / dataArray.length;
            let x = 0;

            for (let i = 0; i < dataArray.length; i++) {
                const v = dataArray[i] / 128.0; // scale
                const y = (v * height) / 2;

                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }

                x += sliceWidth;
            }

            ctx.lineTo(width, height / 2);
            ctx.stroke();
        };

        draw();
    };

    return (
        <div className="waveform-visualizer">
            <canvas 
                ref={canvasRef} 
                width="360" 
                height="65" 
                className="waveform-canvas"
                aria-label="Realtime audio capture visualizer"
            />
            {isRecording && (
                <div className="waveform-indicator">
                    <span className="live-dot anim-pulse" />
                    <span className="live-text">MIC ACTIVE</span>
                </div>
            )}
        </div>
    );
};

export default WaveformVisualizer;
