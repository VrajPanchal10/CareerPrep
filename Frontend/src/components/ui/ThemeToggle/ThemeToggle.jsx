import React from "react";
import { useTheme } from "../../../context/ThemeContext";
import "./ThemeToggle.scss";

const ThemeToggle = () => {
    const { theme, toggleTheme } = useTheme();

    return (
        <button 
            className={`theme-toggle theme-toggle--${theme}`} 
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
            <span className="toggle-thumb">
                {theme === "dark" ? "🌙" : "☀️"}
            </span>
        </button>
    );
};

export default ThemeToggle;
