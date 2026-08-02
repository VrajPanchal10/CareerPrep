import React from "react";
import { useRouteError } from "react-router";
import "./ErrorBoundaryPage.scss";

/**
 * Robust helper to extract human-readable diagnostics from any error format
 * (Axios Error, React Router Response/Error, JS Error, or raw object)
 */
const extractErrorInfo = (error) => {
    if (!error) return { message: "Unknown runtime error occurred.", status: null, details: null, stack: null };

    // If string
    if (typeof error === "string") {
        return { message: error, status: null, details: null, stack: null };
    }

    let message = null;
    let status = error.status || error.statusCode || error.response?.status || null;
    let code = error.code || error.errorCode || error.response?.data?.error?.code || null;
    let url = error.config?.url || error.request?.responseURL || null;
    let stack = error.stack || null;
    let responseData = error.response?.data || error.data || null;

    // 1. Try resolving message strings from common error containers
    if (error.userMessage && typeof error.userMessage === "string") {
        message = error.userMessage;
    } else if (typeof error.message === "string" && error.message.trim() !== "" && error.message !== "[object Object]") {
        message = error.message;
    } else if (error.response?.data?.message && typeof error.response.data.message === "string") {
        message = error.response.data.message;
    } else if (error.response?.data?.error?.message && typeof error.response.data.error.message === "string") {
        message = error.response.data.error.message;
    } else if (error.data?.message && typeof error.data.message === "string") {
        message = error.data.message;
    } else if (error.statusText && typeof error.statusText === "string") {
        message = `HTTP ${status}: ${error.statusText}`;
    }

    // 2. Fallback message if string could not be extracted
    if (!message) {
        if (status) {
            message = `HTTP Request failed with status code ${status}`;
        } else if (code) {
            message = `Error Code: ${code}`;
        } else {
            message = "An unexpected error occurred in this workspace module.";
        }
    }

    // 3. Serialize raw object details safely for developer inspection
    let serializedObject = null;
    try {
        const plainObj = {};
        Object.getOwnPropertyNames(error).forEach((key) => {
            if (key !== "stack") {
                plainObj[key] = error[key];
            }
        });
        serializedObject = JSON.stringify(plainObj, null, 2);
        if (serializedObject === "{}" && responseData) {
            serializedObject = JSON.stringify(responseData, null, 2);
        }
    } catch (e) {
        serializedObject = null;
    }

    return {
        message,
        status,
        code,
        url,
        stack,
        responseData,
        serializedObject
    };
};

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
    const info = extractErrorInfo(error);

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
                    An unexpected runtime error occurred while processing this page. Our system has logged the diagnostic payload below.
                </p>

                {/* Diagnostic Details */}
                {error && (
                    <div className="error-details">
                        <details className="error-details__expand" open={isEnvDev}>
                            <summary>🔍 View Error Diagnostics</summary>
                            <div className="error-details__content">
                                <p className="error-msg">
                                    <strong>Error:</strong> {info.message}
                                </p>

                                {info.status && (
                                    <p className="error-meta" style={{ marginTop: "0.4rem", fontSize: "0.85rem", opacity: 0.8 }}>
                                        <strong>Status Code:</strong> {info.status} {info.code ? `(${info.code})` : ""}
                                    </p>
                                )}

                                {info.url && (
                                    <p className="error-meta" style={{ marginTop: "0.2rem", fontSize: "0.85rem", opacity: 0.8 }}>
                                        <strong>Request URL:</strong> <code>{info.url}</code>
                                    </p>
                                )}

                                {info.serializedObject && info.serializedObject !== "{}" && (
                                    <div style={{ marginTop: "0.6rem" }}>
                                        <span style={{ fontSize: "0.8rem", fontWeight: "bold", opacity: 0.7 }}>Payload / Response Details:</span>
                                        <pre className="error-stack" style={{ marginTop: "0.3rem", maxHeight: "160px", overflowY: "auto" }}>
                                            <code>{info.serializedObject}</code>
                                        </pre>
                                    </div>
                                )}

                                {info.stack && (
                                    <div style={{ marginTop: "0.6rem" }}>
                                        <span style={{ fontSize: "0.8rem", fontWeight: "bold", opacity: 0.7 }}>Stack Trace:</span>
                                        <pre className="error-stack" style={{ marginTop: "0.3rem", maxHeight: "200px", overflowY: "auto" }}>
                                            <code>{info.stack}</code>
                                        </pre>
                                    </div>
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

