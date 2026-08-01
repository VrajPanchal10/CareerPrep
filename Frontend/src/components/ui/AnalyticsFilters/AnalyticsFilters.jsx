import React, { useState, useEffect } from "react";
import "./AnalyticsFilters.scss";

const AnalyticsFilters = ({ onFilterChange, repositories = [] }) => {
    const [dateRange, setDateRange] = useState(() => {
        return sessionStorage.getItem("careerprep_filter_dateRange") || "all";
    });
    const [role, setRole] = useState(() => {
        return sessionStorage.getItem("careerprep_filter_role") || "all";
    });
    const [type, setType] = useState(() => {
        return sessionStorage.getItem("careerprep_filter_type") || "all";
    });
    const [repo, setRepo] = useState(() => {
        return sessionStorage.getItem("careerprep_filter_repo") || "all";
    });

    // Notify parent on state change (this matches both client-side and server-side modes stably)
    useEffect(() => {
        const filters = { dateRange, role, type, repo };
        onFilterChange(filters);
    }, [dateRange, role, type, repo]);

    const handleReset = () => {
        setDateRange("all");
        setRole("all");
        setType("all");
        setRepo("all");
        sessionStorage.setItem("careerprep_filter_dateRange", "all");
        sessionStorage.setItem("careerprep_filter_role", "all");
        sessionStorage.setItem("careerprep_filter_type", "all");
        sessionStorage.setItem("careerprep_filter_repo", "all");
    };

    const handleFilterChange = (setter, key) => (e) => {
        const value = e.target.value;
        setter(value);
        sessionStorage.setItem(key, value);
    };

    return (
        <div className="analytics-filters" role="search" aria-label="Dashboard Analytics Filter Bar">
            <div className="analytics-filters__title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="filter-funnel-icon">
                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                </svg>
                <span>FILTER ANALYTICS:</span>
            </div>

            <div className="analytics-filters__options">
                {/* Date range filter */}
                <div className="filter-group">
                    <label htmlFor="filterDateRange">Time Window</label>
                    <select 
                        id="filterDateRange" 
                        value={dateRange} 
                        onChange={handleFilterChange(setDateRange, "careerprep_filter_dateRange")}
                    >
                        <option value="all">All Time</option>
                        <option value="7days">Last 7 Days</option>
                        <option value="30days">Last 30 Days</option>
                    </select>
                </div>

                {/* Target role filter */}
                <div className="filter-group">
                    <label htmlFor="filterRole">Target Role</label>
                    <select 
                        id="filterRole" 
                        value={role} 
                        onChange={handleFilterChange(setRole, "careerprep_filter_role")}
                    >
                        <option value="all">All Roles</option>
                        <option value="Software Engineer">Software Engineer</option>
                        <option value="Frontend Developer">Frontend Developer</option>
                        <option value="Backend Developer">Backend Developer</option>
                        <option value="Fullstack Developer">Full Stack Engineer</option>
                    </select>
                </div>

                {/* Interview / practice type filter */}
                <div className="filter-group">
                    <label htmlFor="filterType">Exercise Type</label>
                    <select 
                        id="filterType" 
                        value={type} 
                        onChange={handleFilterChange(setType, "careerprep_filter_type")}
                    >
                        <option value="all">All Exercises</option>
                        <option value="ats">ATS Resume Audits</option>
                        <option value="interview">Interview Plans</option>
                        <option value="voice">Verbal Mocks</option>
                        <option value="github">Project Defenses</option>
                    </select>
                </div>

                {/* Git repo filters (only visible/useful if list provided) */}
                {repositories.length > 0 && (
                    <div className="filter-group">
                        <label htmlFor="filterRepo">Repository</label>
                        <select 
                            id="filterRepo" 
                            value={repo} 
                            onChange={handleFilterChange(setRepo, "careerprep_filter_repo")}
                        >
                            <option value="all">All Repositories</option>
                            {repositories.map((r, idx) => (
                                <option key={idx} value={r}>{r}</option>
                            ))}
                        </select>
                    </div>
                )}

                <button className="reset-filters-btn" onClick={handleReset} title="Reset Filter States">
                    Reset
                </button>
            </div>
        </div>
    );
};

export default AnalyticsFilters;
