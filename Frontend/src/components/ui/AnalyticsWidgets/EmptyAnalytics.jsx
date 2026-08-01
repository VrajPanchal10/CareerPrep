import React from "react";
import EmptyState from "../EmptyState/EmptyState";

/**
 * Reusable empty state view wrapper for analytics modules.
 */
const EmptyAnalytics = ({ 
    title = "No analytics data compiled yet.", 
    description = "Complete practice assessments, resume audits, or voice interview sessions to aggregate performance trends.",
    primaryAction
}) => {
    return (
        <div className="empty-analytics-wrapper" style={{ padding: "2rem", width: "100%" }}>
            <EmptyState 
                title={title}
                description={description}
                primaryAction={primaryAction}
            />
        </div>
    );
};

export default EmptyAnalytics;
