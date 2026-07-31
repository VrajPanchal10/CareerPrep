const mongoose = require("mongoose");

const repositoryAnalysisSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
        required: true
    },
    repoUrl: {
        type: String,
        required: true
    },
    repoName: {
        type: String,
        required: true
    },
    owner: {
        type: String,
        required: true
    },
    isPrivate: {
        type: Boolean,
        default: false
    },
    authMethod: {
        type: String,
        default: "none"
    },
    summary: {
        type: String,
        required: true
    },
    knowledgeGraph: {
        projectName: String,
        frontendStack: [String],
        backendStack: [String],
        database: [String],
        authentication: [String],
        majorFeatures: [String],
        folderStructure: String,
        keyComponents: [String],
        services: [String],
        routes: [String],
        models: [String],
        externalApis: [String],
        deploymentApproach: [String]
    },
    healthReport: {
        architectureStrengths: [String],
        architectureWeaknesses: [String],
        securityConcerns: [String],
        scalabilityConcerns: [String],
        missingEngineeringPractices: [String],
        improvementRecommendations: [String]
    },
    projectSnapshot: {
        projectSummary: String,
        techStack: [String],
        architectureOverview: String,
        mainFeatures: [String],
        securityOverview: String,
        deploymentOverview: String,
        improvementOpportunities: [String]
    },
    interviewTopics: {
        architecture: [String],
        frontend: [String],
        backend: [String],
        database: [String],
        deploymentAndSecurity: [String],
        githubDefense: [String]
    },
    // Cache invalidation key — set to the repo's latest commit SHA at analysis time
    commitSha: {
        type: String,
        default: null
    },
    // Repository size in KB at analysis time
    sizeKb: {
        type: Number,
        default: 0
    },
    // Incremental analysis support — bump when analysis logic changes
    analysisVersion: {
        type: Number,
        default: 1
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const repositoryAnalysisModel = mongoose.model("RepositoryAnalysis", repositoryAnalysisSchema);

module.exports = repositoryAnalysisModel;
