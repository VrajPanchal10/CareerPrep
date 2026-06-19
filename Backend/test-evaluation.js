require("dotenv").config();
const { evaluateUserAnswer } = require("./src/services/ai.service");

async function test() {
    try {
        console.log("Calling Gemini for Answer Evaluation...");
        const result = await evaluateUserAnswer({
            question: "What is React Virtual DOM and how does it improve performance?",
            intention: "Check understanding of DOM reconciliation and fiber diff algorithms",
            modelAnswer: "The virtual DOM is a programming concept where a virtual representation of a UI is kept in memory and synced with the real DOM by a library such as ReactDOM (reconciliation). It improves performance by batching updates and only writing the diff changes rather than re-rendering the whole tree.",
            userAnswer: "React keeps a copy of the DOM in memory called Virtual DOM. When state changes, it checks the difference and updates the exact element instead of re-rendering everything. This makes it faster."
        });
        console.log("Structured Answer Evaluation returned successfully!");
        console.log(JSON.stringify(result, null, 2));
    } catch (err) {
        console.error("Evaluation failed:", err);
    }
}

test();
