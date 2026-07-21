import React from "react";
import "./EmptyState.scss";

const EmptyState = ({ icon, title, description, primaryAction, secondaryAction }) => {
    return (
        <div className="empty-state-card">
            {icon && <div className="empty-state-icon">{icon}</div>}
            <h3 className="empty-state-title">{title}</h3>
            <p className="empty-state-desc">{description}</p>
            <div className="empty-state-actions">
                {primaryAction && (
                    <button 
                        onClick={primaryAction.onClick} 
                        className="button primary-button empty-primary"
                        id="emptyStatePrimaryBtn"
                    >
                        {primaryAction.label}
                    </button>
                )}
                {secondaryAction && (
                    <button 
                        onClick={secondaryAction.onClick} 
                        className="button secondary-button empty-secondary"
                        id="emptyStateSecondaryBtn"
                    >
                        {secondaryAction.label}
                    </button>
                )}
            </div>
        </div>
    );
};

export default EmptyState;
