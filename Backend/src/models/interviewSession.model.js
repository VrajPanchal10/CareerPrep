const mongoose = require("mongoose");

const answerSchema = new mongoose.Schema({
    questionType: {
        type: String,
        enum: ["technical", "behavioral"],
        required: true
    },
    questionIndex: {
        type: Number,
        required: true
    },
    questionText: {
        type: String,
        required: true
    },
    topic: {
        type: String,
        required: true
    },
    userAnswer: {
        type: String,
        required: true
    },
    evaluation: {
        accuracy: { type: Number, default: 0 },
        depth: { type: Number, default: 0 },
        clarity: { type: Number, default: 0 },
        explanationQuality: { type: Number, default: 0 },
        overall: { type: Number, default: 0 },
        feedback: {
            strengths: [String],
            weaknesses: [String]
        }
    }
}, { _id: false });

const interviewSessionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
        required: true
    },
    interviewReport: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "InterviewReport",
        required: true
    },
    status: {
        type: String,
        enum: ["started", "completed"],
        default: "started"
    },
    answers: [answerSchema],
    overallScore: {
        type: Number,
        default: 0
    },
    topicScores: {
        type: Map,
        of: Number,
        default: {}
    },
    strongAreas: [String],
    weakAreas: [String],
    topicBreakdown: [
        {
            topic: String,
            questionsAttempted: { type: Number, default: 0 },
            averageScore: { type: Number, default: 0 }
        }
    ],
    heatmapData: [
        {
            topic: String,
            score: Number,
            status: { type: String, enum: ["strong", "moderate", "weak", "critical"] }
        }
    ],
    studyPlan: {
        recommendedTopics: [String],
        improvementRoadmap: [
            {
                topic: String,
                currentScore: Number,
                targetScore: Number,
                steps: [String]
            }
        ]
    },
    interviewReadinessScore: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

const interviewSessionModel = mongoose.model("InterviewSession", interviewSessionSchema);

module.exports = interviewSessionModel;
