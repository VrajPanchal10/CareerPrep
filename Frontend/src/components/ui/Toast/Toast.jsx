import React from "react";
import "./Toast.scss";

const TYPE_ICONS = {
    success: "✅",
    error: "❌",
    warning: "⚠️",
    info: "ℹ️"
};

const ToastItem = ({ id, message, type, onDismiss }) => {
    return (
        <div 
            className={`toast-item toast--${type}`} 
            role="alert" 
            aria-live="assertive"
            aria-atomic="true"
        >
            <span className="toast-icon" aria-hidden="true">
                {TYPE_ICONS[type] || "•"}
            </span>
            <div className="toast-message">{message}</div>
            <button 
                className="toast-close" 
                onClick={() => onDismiss(id)}
                aria-label="Dismiss notification"
            >
                ✕
            </button>
        </div>
    );
};

const ToastContainer = ({ toasts, onDismiss }) => {
    return (
        <div className="toast-container" id="toastContainer">
            {toasts.map((toast) => (
                <ToastItem 
                    key={toast.id} 
                    id={toast.id}
                    message={toast.message} 
                    type={toast.type} 
                    onDismiss={onDismiss} 
                />
            ))}
        </div>
    );
};

export default ToastContainer;
export { ToastItem };
