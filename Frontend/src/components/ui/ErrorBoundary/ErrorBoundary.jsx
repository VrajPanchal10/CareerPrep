import React from "react";

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error:", error, errorInfo);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
        if (this.props.onReset) {
            this.props.onReset();
        } else {
            window.location.reload();
        }
    };

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    padding: "3rem 1.5rem",
                    textAlign: "center",
                    background: "#161616",
                    color: "#fff",
                    minHeight: "380px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "12px",
                    border: "1px solid rgba(210, 13, 59, 0.2)",
                    margin: "2rem auto",
                    maxWidth: "580px",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.3)"
                }}>
                    <span style={{ fontSize: "3rem", marginBottom: "1rem" }} role="img" aria-label="Error symbol">⚠️</span>
                    <h2 style={{ fontSize: "1.4rem", fontWeight: "700", marginBottom: "0.5rem" }}>Something went wrong</h2>
                    <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.88rem", marginBottom: "1.5rem", maxWidth: "420px", lineHeight: "1.5" }}>
                        An unexpected error occurred in this workspace module. You can attempt to reset this specific panel or go back to home.
                    </p>
                    <div style={{ display: "flex", gap: "1rem" }}>
                        <button 
                            onClick={this.handleReset}
                            style={{
                                background: "#d20d3b",
                                color: "#fff",
                                border: "none",
                                padding: "0.6rem 1.4rem",
                                borderRadius: "8px",
                                fontWeight: "600",
                                cursor: "pointer"
                            }}
                        >
                            Reset Section
                        </button>
                        <button 
                            onClick={() => window.location.href = "/"}
                            style={{
                                background: "rgba(255,255,255,0.06)",
                                color: "#fff",
                                border: "1px solid rgba(255,255,255,0.15)",
                                padding: "0.6rem 1.4rem",
                                borderRadius: "8px",
                                fontWeight: "600",
                                cursor: "pointer"
                            }}
                        >
                            Go to Coach Home
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
