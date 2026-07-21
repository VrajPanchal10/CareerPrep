import React from "react";
import "./Skeleton.scss";

const Skeleton = ({ className = "", width, height, variant = "text" }) => {
    const style = {
        width,
        height
    };
    return (
        <div 
            className={`skeleton skeleton--${variant} ${className}`} 
            style={style} 
            role="progressbar"
            aria-busy="true"
        />
    );
};

export const SkeletonCard = () => (
    <div className="skeleton-card-wrap">
        <Skeleton variant="rect" height="35px" width="30%" className="skeleton-mb-2" />
        <Skeleton variant="text" height="18px" width="90%" className="skeleton-mb-1" />
        <Skeleton variant="text" height="14px" width="60%" />
    </div>
);

export const SkeletonTable = ({ rows = 4 }) => (
    <div className="skeleton-table-wrap">
        <div className="skeleton-table-header">
            <Skeleton variant="rect" height="35px" width="100%" />
        </div>
        {[...Array(rows)].map((_, i) => (
            <div className="skeleton-table-row" key={i}>
                <Skeleton variant="text" height="18px" width="40%" />
                <Skeleton variant="text" height="18px" width="20%" />
                <Skeleton variant="text" height="18px" width="15%" />
                <Skeleton variant="text" height="18px" width="15%" />
            </div>
        ))}
    </div>
);

export const SkeletonDashboard = () => (
    <div className="skeleton-dashboard-grid">
        <div className="skeleton-grid-cols">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
        </div>
        <Skeleton variant="rect" height="240px" width="100%" />
    </div>
);

export const SkeletonReport = () => (
    <div className="skeleton-report-wrap">
        <Skeleton variant="text" height="38px" width="65%" className="skeleton-mb-3" />
        <Skeleton variant="rect" height="130px" width="100%" className="skeleton-mb-2" />
        <Skeleton variant="text" height="16px" width="95%" className="skeleton-mb-1" />
        <Skeleton variant="text" height="16px" width="90%" className="skeleton-mb-1" />
        <Skeleton variant="text" height="16px" width="50%" />
    </div>
);

export const SkeletonUpload = () => (
    <div className="skeleton-upload-wrap">
        <Skeleton variant="rect" height="140px" width="100%" className="skeleton-mb-2" />
        <Skeleton variant="text" height="18px" width="40%" />
    </div>
);

export default Skeleton;
