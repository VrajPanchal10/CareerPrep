const mongoose = require("mongoose");

const heatmapItemSchema = new mongoose.Schema({
    keyword: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ["matched", "missing", "extra"],
        required: true
    },
    score: {
        type: Number,
        default: 0
    }
}, { _id: false });

const skillComparisonSchema = new mongoose.Schema({
    skill: { type: String, required: true },
    resumeStatus: { type: String, required: true },
    jdRequirement: { type: String, required: true },
    gap: { type: String, required: true }
}, { _id: false });

const projectComparisonSchema = new mongoose.Schema({
    project: { type: String, required: true },
    relevance: { type: String, required: true },
    improvement: { type: String, required: true }
}, { _id: false });

const experienceComparisonSchema = new mongoose.Schema({
    role: { type: String, required: true },
    relevance: { type: String, required: true },
    improvement: { type: String, required: true }
}, { _id: false });

const atsReportSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
        required: true
    },
    resumeText: {
        type: String,
        required: true
    },
    jobDescription: {
        type: String,
        required: true
    },
    atsScore: {
        type: Number,
        required: true,
        min: 0,
        max: 100
    },
    breakdown: {
        technicalSkillsMatch: { type: Number, default: 0 },
        experienceMatch: { type: Number, default: 0 },
        educationMatch: { type: Number, default: 0 },
        projectsMatch: { type: Number, default: 0 },
        keywordMatch: { type: Number, default: 0 }
    },
    matchedKeywords: [String],
    missingKeywords: [String],
    extraKeywords: [String],
    heatmap: [heatmapItemSchema],
    comparisons: {
        skillComparisons: [skillComparisonSchema],
        projectComparisons: [projectComparisonSchema],
        experienceComparisons: [experienceComparisonSchema]
    },
    recommendations: {
        missingSkills: [String],
        resumeImprovements: [String],
        atsOptimizationSuggestions: [String],
        estimatedScoreImprovement: { type: Number, default: 0 },
        potentialScore: { type: Number, default: 0 }
    },
    strengths: [String],
    weaknesses: [String]
}, {
    timestamps: true
});

const atsReportModel = mongoose.model("AtsReport", atsReportSchema);

module.exports = atsReportModel;
