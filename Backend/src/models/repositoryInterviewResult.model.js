const mongoose = require("mongoose");

const repositoryInterviewResultSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
        required: true
    },
    repositoryInterview: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "RepositoryInterview",
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
    scores: {
        architectureScore: {
            type: Number,
            default: 0
        },
        securityScore: {
            type: Number,
            default: 0
        },
        databaseScore: {
            type: Number,
            default: 0
        },
        apiDesignScore: {
            type: Number,
            default: 0
        },
        deploymentScore: {
            type: Number,
            default: 0
        },
        overallMasteryScore: {
            type: Number,
            default: 0
        }
    },
    feedback: {
        strengths: [String],
        weaknesses: [String],
        recommendations: [String]
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const repositoryInterviewResultModel = mongoose.model("RepositoryInterviewResult", repositoryInterviewResultSchema);

module.exports = repositoryInterviewResultModel;
