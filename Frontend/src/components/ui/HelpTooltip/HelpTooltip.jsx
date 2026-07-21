import React from "react";
import Tooltip from "../Tooltip/Tooltip";
import "./HelpTooltip.scss";

const HelpTooltip = ({ term, text }) => {
    return (
        <span className="help-tooltip-wrapper">
            {term && <span className="help-term-label">{term}</span>}
            <Tooltip content={<div className="help-tooltip-content">{text}</div>} position="top">
                <button 
                    type="button"
                    className="help-tooltip-trigger" 
                    aria-label={`Learn more about ${term || "this technical term"}`}
                    title={`Help: ${term || "More info"}`}
                >
                    ?
                </button>
            </Tooltip>
        </span>
    );
};

export default HelpTooltip;
