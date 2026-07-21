import React, { useState, useEffect } from "react";
import "./HintReveal.scss";

// Static mapping of optimal solution templates for default seeded challenges
const STATIC_SOLUTIONS = {
    "Two Sum": `// Two Sum - Optimal Map Solution
// Time Complexity: O(N) | Space Complexity: O(N)
function solution(nums, target) {
    const map = new Map();
    for (let i = 0; i < nums.length; i++) {
        const complement = target - nums[i];
        if (map.has(complement)) {
            return [map.get(complement), i];
        }
        map.set(nums[i], i);
    }
    return [];
}`,
    "Valid Parentheses": `// Valid Parentheses - Stack-based LIFO Solution
// Time Complexity: O(N) | Space Complexity: O(N)
function solution(s) {
    const stack = [];
    const brackets = {
        ')': '(',
        '}': '{',
        ']': '['
    };
    for (let char of s) {
        if (['(', '{', '['].includes(char)) {
            stack.push(char);
        } else {
            if (stack.length === 0 || stack.pop() !== brackets[char]) {
                return false;
            }
        }
    }
    return stack.length === 0;
}`,
    "Reverse Linked List": `// Reverse Linked List - Iterative Pointer Solution
// Time Complexity: O(N) | Space Complexity: O(1)
function solution(head) {
    let prev = null;
    let curr = head;
    while (curr !== null) {
        let nextTemp = curr.next;
        curr.next = prev;
        prev = curr;
        curr = nextTemp;
    }
    return prev;
}`,
    "Binary Search": `// Binary Search - Iterative Binary search Solution
// Time Complexity: O(log N) | Space Complexity: O(1)
function solution(nums, target) {
    let left = 0;
    let right = nums.length - 1;
    while (left <= right) {
        let mid = Math.floor((left + right) / 2);
        if (nums[mid] === target) return mid;
        if (nums[mid] < target) left = mid + 1;
        else right = mid - 1;
    }
    return -1;
}`
};

const HintReveal = ({ title = "", hints = [], onRevealSolution }) => {
    const [revealedCount, setRevealedCount] = useState(0);
    const [confirmSolution, setConfirmSolution] = useState(false);

    // Reset progress when question title changes
    useEffect(() => {
        setRevealedCount(0);
        setConfirmSolution(false);
    }, [title]);

    const handleRevealNext = () => {
        setRevealedCount(prev => Math.min(hints.length + 1, prev + 1));
    };

    const handleConfirmShowSolution = () => {
        setConfirmSolution(true);
        setRevealedCount(hints.length + 1);
        if (onRevealSolution) onRevealSolution();
    };

    const solutionCode = STATIC_SOLUTIONS[title] || `// Conceptual Solution Guidance for: ${title || "Active Challenge"}
// Build an optimal approach utilizing maps, stacks, or linear pointer divisions.
// Ensure time complexity does not exceed O(N log N) thresholds.`;

    const allHintsRevealed = revealedCount >= hints.length;
    const solutionRevealed = revealedCount > hints.length;

    return (
        <div className="hint-reveal-container" aria-live="polite">
            <h3 className="hints-section-title">💡 Guided Walkthrough & Hints</h3>

            {/* Revealed Hints Stack */}
            {revealedCount > 0 && (
                <div className="hints-stack">
                    {hints.slice(0, revealedCount).map((hint, idx) => (
                        <div key={idx} className="hint-item anim-fade-in">
                            <span className="hint-label">Hint {idx + 1}</span>
                            <p className="hint-text">{hint}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Action controls */}
            <div className="hints-actions">
                {!allHintsRevealed && (
                    <button 
                        className="hint-btn" 
                        onClick={handleRevealNext}
                        id={`showHintBtn-${revealedCount + 1}`}
                    >
                        Reveal Hint {revealedCount + 1} of {hints.length}
                    </button>
                )}

                {allHintsRevealed && !solutionRevealed && !confirmSolution && (
                    <div className="spoiler-confirmation">
                        <p className="spoiler-warning">⚠️ revealing optimal code solution</p>
                        <button 
                            className="hint-btn hint-btn--danger" 
                            onClick={handleConfirmShowSolution}
                            id="revealSolutionBtn"
                        >
                            Reveal Complete Solution Template
                        </button>
                    </div>
                )}
            </div>

            {/* Complete Solution Area */}
            {solutionRevealed && (
                <div className="solution-block anim-fade-in" id="solutionBlock">
                    <div className="solution-block__header">
                        <span>Optimal JavaScript/Python Reference Solution</span>
                        <button 
                            className="copy-sol-btn"
                            onClick={() => navigator.clipboard.writeText(solutionCode)}
                        >
                            📋 Copy Template
                        </button>
                    </div>
                    <pre className="solution-code">
                        <code>{solutionCode}</code>
                    </pre>
                </div>
            )}
        </div>
    );
};

export default HintReveal;
