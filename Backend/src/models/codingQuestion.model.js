const mongoose = require("mongoose");

/**
 * CodingQuestion model — extended with test cases for Piston execution.
 * Backward compatible: sampleInput/sampleOutput fields are preserved for display.
 */
const testCaseSchema = new mongoose.Schema({
    input: {
        type: String,
        default: ""
    },
    expectedOutput: {
        type: String,
        required: true
    },
    isHidden: {
        type: Boolean,
        default: false
    },
    label: {
        type: String,
        default: ""  // e.g., "Edge Case: Empty Array", "Large Input"
    }
}, { _id: false });

const codingQuestionSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        unique: true
    },
    description: {
        type: String,
        required: true
    },
    difficulty: {
        type: String,
        enum: ["Easy", "Medium", "Hard"],
        required: true
    },
    topic: {
        type: String,
        required: true
    },

    // ── Preserved for backward compatibility (display in problem panel) ────────
    sampleInput: {
        type: String,
        default: ""
    },
    sampleOutput: {
        type: String,
        default: ""
    },

    // ── Piston test cases ──────────────────────────────────────────────────────
    testCases: {
        type: [testCaseSchema],
        default: []
    },

    // ── Execution limits ───────────────────────────────────────────────────────
    timeLimitMs: {
        type: Number,
        default: 5000  // 5 seconds
    },
    memoryLimitKb: {
        type: Number,
        default: 262144  // 256 MB
    },

    // ── Problem metadata ───────────────────────────────────────────────────────
    constraints: {
        type: [String],
        default: []
    },
    hints: {
        type: [String],
        default: []
    },
    isCustom: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

const codingQuestionModel = mongoose.model("CodingQuestion", codingQuestionSchema);

module.exports = codingQuestionModel;
