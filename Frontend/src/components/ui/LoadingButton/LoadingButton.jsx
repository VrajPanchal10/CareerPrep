import React from "react";
import "./LoadingButton.scss";

const LoadingButton = ({ 
    children, 
    loading, 
    isLoading, // Destructure to prevent forwarding to DOM
    loadingText = "Please wait...", 
    disabled, 
    onClick, 
    type = "button", 
    className = "", 
    icon,
    id,
    ...props 
}) => {
    const isBtnLoading = loading || isLoading;
    return (
        <button
            {...props}
            id={id}
            type={type}
            onClick={onClick}
            disabled={disabled || isBtnLoading}
            className={`loading-button ${className} ${isBtnLoading ? "loading-button--loading" : ""}`}
        >
            {isBtnLoading ? (
                <span className="loading-content-flex">
                    <span className="spinner-mini anim-spin" />
                    <span>{loadingText}</span>
                </span>
            ) : (
                <span className="button-content-flex">
                    {icon && <span className="button-icon">{icon}</span>}
                    <span>{children}</span>
                </span>
            )}
        </button>
    );
};

export default LoadingButton;
