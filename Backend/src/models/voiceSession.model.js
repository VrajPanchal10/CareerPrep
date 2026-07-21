const mongoose = require("mongoose");

const voiceQuestionSchema = new mongoose.Schema({
    questionText: { type: String, required: true },
    intention: { type: String },
    answer: { type: String },
    topic: { type: String, required: true },
    type: { type: String, enum: ["technical", "behavioral"], required: true },
    isFollowUp: { type: Boolean, default: false },
    parentQuestionIndex: { type: Number },
    translations: {
        type: Map,
        of: new mongoose.Schema({
            status: { type: String, enum: ["pending", "processing", "completed", "failed"], default: "pending" },
            text: { type: String }
        }, { _id: false }),
        default: {}
    }
}, { _id: false });

const voiceTranscriptSchema = new mongoose.Schema({
    questionIndex: { type: Number, required: true },
    transcriptText: { type: String, required: true },
    responseTime: { type: Number, required: true } // response time in seconds
}, { _id: false });

const voiceEvaluationSchema = new mongoose.Schema({
    questionIndex: { type: Number, required: true },
    overallScore: { type: Number, required: true },
    communicationScore: { type: Number, required: true },
    clarityScore: { type: Number, required: true },
    technicalScore: { type: Number, required: true },
    explanationScore: { type: Number, required: true },
    strengths: { type: [String], default: [] },
    weaknesses: { type: [String], default: [] },
    suggestions: { type: [String], default: [] },
    technicalDepth: { type: Number, default: 70 },
    completeness: { type: Number, default: 70 },
    relevance: { type: Number, default: 70 },
    communicationFlow: { type: Number, default: 70 },
    grammarScore: { type: Number, default: 70 },
    fluencyScore: { type: Number, default: 70 },
    responseStructure: { type: String, default: "STAR" },
    timeUtilization: { type: Number, default: 1.0 },
    fillerWords: { type: [String], default: [] },
    translations: {
        type: Map,
        of: new mongoose.Schema({
            status: { type: String, enum: ["pending", "processing", "completed", "failed"], default: "pending" },
            strengths: { type: [String], default: [] },
            weaknesses: { type: [String], default: [] },
            suggestions: { type: [String], default: [] }
        }, { _id: false }),
        default: {}
    }
}, { _id: false });

const voiceInterviewSessionSchema = new mongoose.Schema({
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
    difficulty: {
        type: String,
        enum: ["Easy", "Medium", "Hard"],
        required: true
    },
    enableFollowUps: {
        type: Boolean,
        default: false
    },
    questions: [voiceQuestionSchema],
    transcripts: [voiceTranscriptSchema],
    evaluations: [voiceEvaluationSchema],
    overallScore: { type: Number, default: 0 },
    communicationScore: { type: Number, default: 0 },
    clarityScore: { type: Number, default: 0 },
    technicalScore: { type: Number, default: 0 },
    explanationScore: { type: Number, default: 0 },
    averageResponseTime: { type: Number, default: 0 },
    totalDuration: { type: Number, default: 0 },
    strongAreas: { type: [String], default: [] },
    weakAreas: { type: [String], default: [] },
    topRecommendation: { type: String, default: "" },
    conversationMemory: { type: [String], default: [] },
    overallConfidence: { type: Number, default: 0 },
    averageFluency: { type: Number, default: 0 },
    speakingSpeedTrend: { type: [Number], default: [] },
    status: {
        type: String,
        enum: ["started", "completed"],
        default: "started"
    },
    completedAt: { type: Date }
}, {
    timestamps: true
});

const voiceInterviewSessionModel = mongoose.model("VoiceInterviewSession", voiceInterviewSessionSchema);

module.exports = voiceInterviewSessionModel;
