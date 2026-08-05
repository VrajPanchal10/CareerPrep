import React, { useEffect, useRef } from 'react';
import './ConfirmationModal.scss';

const ICONS = {
    danger: '🗑️',
    warning: '⚠️',
    success: '✅',
    info: 'ℹ️'
};

const ConfirmationModal = ({
    open,
    variant = 'info',
    icon,
    title,
    description,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    confirmColor,
    loading = false,
    onConfirm,
    onCancel
}) => {
    const modalRef = useRef(null);
    const cancelBtnRef = useRef(null);

    // Auto focus the cancel button for safety and trap focus
    useEffect(() => {
        if (open && cancelBtnRef.current) {
            cancelBtnRef.current.focus();
        }
    }, [open]);

    // Handle ESC key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (open && e.key === 'Escape') {
                if (!loading && onCancel) {
                    onCancel();
                }
            }
            
            // Basic focus trap for tab
            if (open && e.key === 'Tab') {
                const focusableElements = modalRef.current?.querySelectorAll(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                );
                
                if (focusableElements && focusableElements.length > 0) {
                    const firstElement = focusableElements[0];
                    const lastElement = focusableElements[focusableElements.length - 1];

                    if (e.shiftKey) {
                        if (document.activeElement === firstElement) {
                            lastElement.focus();
                            e.preventDefault();
                        }
                    } else {
                        if (document.activeElement === lastElement) {
                            firstElement.focus();
                            e.preventDefault();
                        }
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open, loading, onCancel]);

    if (!open) return null;

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget && !loading && onCancel) {
            onCancel();
        }
    };

    const displayIcon = icon || ICONS[variant] || ICONS.info;
    const finalConfirmColor = confirmColor || variant;

    return (
        <div 
            className="confirmation-modal-overlay" 
            onClick={handleBackdropClick}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            aria-describedby="modal-description"
        >
            <div className={`confirmation-modal-card ${variant}`} ref={modalRef}>
                <div className="modal-header">
                    <span className="modal-icon" aria-hidden="true">{displayIcon}</span>
                    <h2 id="modal-title">{title}</h2>
                </div>
                
                {description && (
                    <div className="modal-content">
                        <p id="modal-description">{description}</p>
                    </div>
                )}
                
                <div className="modal-actions">
                    <button 
                        ref={cancelBtnRef}
                        className="btn-cancel" 
                        onClick={onCancel}
                        disabled={loading}
                    >
                        {cancelText}
                    </button>
                    
                    <button 
                        className={`btn-confirm btn-confirm--${finalConfirmColor}`} 
                        onClick={onConfirm}
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <span className="spinner"></span>
                                {confirmText.replace('...', '')}...
                            </>
                        ) : (
                            confirmText
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;
