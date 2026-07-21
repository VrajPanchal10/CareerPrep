import React from "react";
import { useRouteError } from "react-router";
import "./ErrorBoundaryPage.scss";

const ErrorBoundaryPage = ({ error: propError }) => {
    // If integrated with React Router errorElement, retrieve error details via hook
    let routeError;
    try {
        routeError = useRouteError();
    } catch (e) {
        // useRouteError can only be used inside RouterProvider context
    }

    const error = propError || routeError;
    const isEnvDev = import.meta.env.DEV;

    const handleReload = () => {
        window.location.reload();
    };

    const handleGoDashboard = () => {
        window.location.href = "/";
    };

    return (
        <div className="error-boundary-page">
            <div className="error-card anim-fade-in">
                <div className="error-card__icon">⚠️</div>
                <h1 className="error-card__title">Application Crash Detected</h1>
                <p className="error-card__desc">
                    An unexpected runtime error occurred while processing this page. Our team has been notified.
                </p>

                {/* Developer stack trace details */}
                {error && (
                    <div className="error-details">
                        <details className="error-details__expand">
                            <summary>🔍 View Error Diagnostics</summary>
                            <div className="error-details__content">
                                <p className="error-msg"><strong>Error:</strong> {error.message || String(error)}</p>
                                {isEnvDev && error.stack && (
                                    <pre className="error-stack"><code>{error.stack}</code></pre>
                                )}
                            </div>
                        </details>
                    </div>
                )}

                {/* Primary Action Buttons */}
                <div className="error-card__actions">
                    <button className="err-btn err-btn--primary" onClick={handleReload}>
                        🔄 Reload Page
                    </button>
                    <button className="err-btn err-btn--secondary" onClick={handleGoDashboard}>
                        🏠 Back to Dashboard
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ErrorBoundaryPage;
