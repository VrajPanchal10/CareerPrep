import React from "react";
import "./StaticRecommendations.scss";

const getAdviceForWeakness = (weakness) => {
    const topic = (weakness || "").toLowerCase();
    
    if (topic.includes("system design") || topic.includes("architecture")) {
        return "Your history shows weak points in System Design. Recommended Action: Complete 2 Mock Interviews focusing on Architecture and review data partitioning concepts.";
    }
    if (topic.includes("security")) {
        return "Security scores are lagging. Recommended Action: Review OWASP Top 10 vulnerabilities and take a focused Project Defense session.";
    }
    if (topic.includes("algorithm") || topic.includes("data structure")) {
        return "Algorithms need polishing. Recommended Action: Practice 2 Medium-level LeetCode-style questions in the Coding Workspace.";
    }
    if (topic.includes("communication")) {
        return "Communication clarity can be improved. Recommended Action: Run a Verbal Mock Interview using the STAR method for behavioral questions.";
    }
    if (topic.includes("database") || topic.includes("sql")) {
        return "Database design and querying is a weak area. Recommended Action: Review database normalization and indexing strategies.";
    }
    
    return `You have scored lower in ${weakness} recently. Recommended Action: Dedicate your next practice session specifically to this topic to boost your overall average.`;
};

const StaticRecommendations = ({ topWeaknesses = [] }) => {
    if (!topWeaknesses || topWeaknesses.length === 0) {
        return null;
    }

    return (
        <div className="static-recommendations-card">
            <div className="recommendations-header">
                <h3>💡 AI-Driven Recommendations</h3>
                <p className="subtitle">Based purely on your historical performance trends.</p>
            </div>
            
            <ul className="recommendations-list">
                {topWeaknesses.map((weakness, idx) => (
                    <li key={idx} className="recommendation-item">
                        <span className="bullet-point"></span>
                        <p>{getAdviceForWeakness(weakness)}</p>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default StaticRecommendations;
