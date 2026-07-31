const mongoose = require("mongoose");

const repositoryInterviewSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
        required: true
    },
    repositoryAnalysis: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "RepositoryAnalysis",
        required: true
    },
    repoName: {
        type: String,
        required: true
    },
    repoUrl: {
        type: String,
        required: true
    },
    interviewLength: {
        type: String,
        enum: ["Quick", "Standard", "Deep"],
        default: "Quick"
    },
    targetQuestionCount: {
        type: Number,
        default: 5
    },
    questions: [{
        questionText: String,
        intention: String,
        topic: String, // Architecture, Security, Database, API Design, Deployment, etc.
        referenceAnswer: String,
        isFollowUp: {
            type: Boolean,
            default: false
        },
        parentQuestionIndex: Number
    }],
    answers: [{
        questionIndex: Number,
        questionText: String,
        userAnswer: String,
        evaluation: {
            accuracy: Number,
            depth: Number,
            clarity: Number,
            explanationQuality: Number,
            overall: Number,
            feedback: {
                strengths: [String],
                weaknesses: [String]
            }
        }
    }],
    status: {
        type: String,
        enum: ["active", "completed"],
        default: "active"
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const repositoryInterviewModel = mongoose.model("RepositoryInterview", repositoryInterviewSchema);

module.exports = repositoryInterviewModel;
