import React from 'react';

export class VoiceInterviewErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        if (import.meta.env.DEV) {
            console.error("VoiceInterviewErrorBoundary caught an error:", error, errorInfo);
        }
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
        window.location.reload();
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="voice-error-fallback" style={{ padding: "3rem", textAlign: "center", color: "#fff" }}>
                    <h2><i className="fi fi-rr-triangle-warning"></i> Interview Encountered an Error</h2>
                    <p style={{ color: "rgba(255,255,255,0.7)", marginBottom: "2rem" }}>
                        We apologize, but a critical error occurred. Your progress up to the last submitted question has been saved safely.
                    </p>
                    <button onClick={this.handleRetry} style={{ padding: "0.8rem 1.5rem", borderRadius: "8px", background: "#f87171", color: "#fff", border: "none", cursor: "pointer", fontWeight: "bold" }}>
                        Reload Session
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
