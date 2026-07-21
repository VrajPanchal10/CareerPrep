/**
 * Coding Prompt Templates
 */
module.exports = {
    generateCodingQuestionPrompt: ({ topic, difficulty }) => {
        return `You are an expert technical interviewer. Generate a programming question targeting:
Topic: ${topic}
Difficulty: ${difficulty}

Create a complete coding question object according to the schema. 
Make sure the constraints, description, sample inputs/outputs, and hints are clear, accurate, and structured.
Ensure the problem is standard and challenging for the given level.`;
    },

    evaluateCodeSubmissionPrompt: ({ question, language, code }) => {
        return `You are a strict, senior technical interviewer and compiler-level code reviewer. 
Evaluate the following programming submission.

Question:
Title: ${question.title}
Description: ${question.description}
Sample Input: ${question.sampleInput}
Sample Output: ${question.sampleOutput}
Constraints: ${question.constraints ? question.constraints.join(', ') : 'None'}

Submission Details:
Language: ${language}
Submitted Code:
\`\`\`${language}
${code}
\`\`\`

Perform a deep semantic evaluation of the code:
1. Correctness: Does it solve the problem logically? Detect syntax errors, infinite loops, or logical flaws.
2. Logic Quality: Is it structured properly with correct variables, conditionals, and functions?
3. Readability: Is it clean, well-formatted, and easy to read?
4. Time & Space Complexity: Analyze big-O complexities and if they can be optimized.
5. Edge Case Handling: Does it handle nulls, empty inputs, single element lists, out of bounds, etc.?

Provide constructive feedback matching the required schema. Ensure the score values reflect the code quality (e.g. penalize heavily for infinite loops, syntax errors, incorrect complexity, or missing edge cases).`;
    }
};
