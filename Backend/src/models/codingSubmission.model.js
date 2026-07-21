const mongoose = require("mongoose");

/**
 * CodingSubmission model — extended with Execution Provider (e.g., Piston) results and
 * Gemini coaching data. All original fields preserved for backward compatibility.
 */
const codingSubmissionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
        required: true
    },
    questionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CodingQuestion",
        required: true
    },
    language: {
        type: String,
        required: true
    },
    submittedCode: {
        type: String,
        required: true
    },

    // ── Legacy AI scores (preserved for backward compatibility) ───────────────
    overallScore: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
        default: 0
    },
    correctnessScore: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
        default: 0
    },
    readabilityScore: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
        default: 0
    },
    complexityScore: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
        default: 0
    },
    strengths: {
        type: [String],
        default: []
    },
    weaknesses: {
        type: [String],
        default: []
    },
    suggestions: {
        type: [String],
        default: []
    },

    // ── Execution Provider Results ───────────────────────────────────────────────
    executionScore: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },
    executionVerdict: {
        type: String,
        enum: [
            "ACCEPTED",
            "WRONG_ANSWER",
            "COMPILATION_ERROR",
            "RUNTIME_ERROR",
            "TLE",
            "MLE",
            "INTERNAL_ERROR",
            "NO_TESTS",
            "NO_HIDDEN_TESTS",
            "SKIPPED",
            null
        ],
        default: null
    },
    visibleTestsPassed: {
        type: Number,
        default: 0
    },
    visibleTestsTotal: {
        type: Number,
        default: 0
    },
    hiddenTestsPassed: {
        type: Number,
        default: 0
    },
    hiddenTestsTotal: {
        type: Number,
        default: 0
    },
    compilationStatus: {
        type: String,
        enum: ["success", "error", null],
        default: null
    },
    compilationError: {
        type: String,
        default: null
    },
    avgRuntimeMs: {
        type: Number,
        default: 0
    },
    avgMemoryKb: {
        type: Number,
        default: 0
    },

    // ── Gemini coaching data (persisted for analytics and future leaderboards) ─
    aiExplanation: {
        type: String,
        default: ""
    },
    timeComplexity: {
        type: String,
        default: ""
    },
    spaceComplexity: {
        type: String,
        default: ""
    },
    optimizations: {
        type: [String],
        default: []
    },
    edgeCases: {
        type: [String],
        default: []
    },
    interviewQuestions: {
        type: [String],
        default: []
    },
    conceptToStudy: {
        type: String,
        default: ""
    },

    // ── Execution metadata for analytics / leaderboards ───────────────────────
    fromCache: {
        type: Boolean,
        default: false
    },
    submittedAt: {
        type: Date,
        default: Date.now
    },
    providerName: {
        type: String,
        default: "Piston"
    },
    runtimeVersion: {
        type: String,
        default: null
    },
    providerResponseTime: {
        type: Number,
        default: 0
    },
    retryCount: {
        type: Number,
        default: 0
    },
    executionMetadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }

}, {
    timestamps: true  // createdAt, updatedAt
});

// ── Indexes for analytics queries ─────────────────────────────────────────────
codingSubmissionSchema.index({ userId: 1, questionId: 1, createdAt: -1 });
codingSubmissionSchema.index({ questionId: 1, executionScore: -1 }); // leaderboard
codingSubmissionSchema.index({ userId: 1, createdAt: -1 });           // user history

const codingSubmissionModel = mongoose.model("CodingSubmission", codingSubmissionSchema);

module.exports = codingSubmissionModel;
