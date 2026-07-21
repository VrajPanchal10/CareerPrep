import React from "react";
import ErrorBoundaryPage from "./ErrorBoundaryPage";

class GlobalErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("[MERN Audit System] Caught global uncaught exception:", error, errorInfo);
        // Error logging endpoint can be targeted here in production
    }

    render() {
        if (this.state.hasError) {
            return <ErrorBoundaryPage error={this.state.error} />;
        }
        return this.props.children;
    }
}

export default GlobalErrorBoundary;
