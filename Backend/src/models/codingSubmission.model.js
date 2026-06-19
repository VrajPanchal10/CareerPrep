const mongoose = require("mongoose");

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
    overallScore: {
        type: Number,
        required: true,
        min: 0,
        max: 100
    },
    correctnessScore: {
        type: Number,
        required: true,
        min: 0,
        max: 100
    },
    readabilityScore: {
        type: Number,
        required: true,
        min: 0,
        max: 100
    },
    complexityScore: {
        type: Number,
        required: true,
        min: 0,
        max: 100
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
    }
}, {
    timestamps: true
});

const codingSubmissionModel = mongoose.model("CodingSubmission", codingSubmissionSchema);

module.exports = codingSubmissionModel;
