import React, { useState } from "react";
import "./Tooltip.scss";

const Tooltip = ({ content, children, position = "top", x, y, visible }) => {
    const [hovered, setHovered] = useState(false);

    if (x !== undefined && y !== undefined) {
        if (!visible) return null;
        return (
            <div 
                className="tooltip-box tooltip-box--absolute anim-fade-in" 
                style={{ left: `${x}px`, top: `${y}px` }}
                role="tooltip"
            >
                {content}
            </div>
        );
    }

    return (
        <div 
            className="tooltip-wrapper"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onFocus={() => setHovered(true)}
            onBlur={() => setHovered(false)}
        >
            {children}
            {hovered && content && (
                <div className={`tooltip-box tooltip-box--${position} anim-fade-in`} role="tooltip">
                    {content}
                </div>
            )}
        </div>
    );
};

export default Tooltip;
