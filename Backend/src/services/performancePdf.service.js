const interviewReportModel = require("../models/interviewReport.model");
const interviewSessionModel = require("../models/interviewSession.model");
const atsReportModel = require("../models/atsReport.model");
const userModel = require("../models/user.model");
const puppeteer = require("puppeteer");
const repositoryInterviewResultModel = require("../models/repositoryInterviewResult.model");

/**
 * @description Generates a polished 3-page Performance Report PDF buffer.
 */
async function generatePerformancePdf({ reportId, userId }) {
    // 1. Fetch data models
    const user = await userModel.findById(userId);
    const report = await interviewReportModel.findById(reportId);
    

    
    if (!report) {
        throw new Error("Interview Report not found.");
    }

    // Latest completed interview session under this report template
    const session = await interviewSessionModel.findOne({
        interviewReport: reportId,
        user: userId,
        status: "completed"
    }).sort({ createdAt: -1 });

    // Latest ATS scan for the user
    const atsReport = await atsReportModel.findOne({
        user: userId
    }).sort({ createdAt: -1 });

    // Latest GitHub repository defense result for the user
    const repoResult = await repositoryInterviewResultModel.findOne({
        user: userId
    }).sort({ createdAt: -1 });

    // 2. Prepare visual scores parameters
    const username = user ? user.username : "Candidate";
    const jobTitle = report.title || "Target Position";
    const date = new Date().toLocaleDateString();
    
    const resumeMatchScore = report.matchScore !== undefined ? report.matchScore : 0;
    
    const readinessScore = session ? session.overallScore : 0;
    const readinessStatus = session 
        ? (readinessScore >= 80 ? "EXCELLENT READY STATUS" : readinessScore >= 60 ? "MODERATE PRACTICE STATUS" : "UNPREPARED STATUS") 
        : "NO MOCK SESSION COMPLETED";

    const atsScore = atsReport ? atsReport.atsScore : 0;
    const atsStatus = atsReport 
        ? (atsScore >= 80 ? "STRONG ATS ALIGNMENT" : atsScore >= 60 ? "MODERATE ALIGNMENT GAPS" : "CRITICAL KEYWORD GAPS") 
        : "NO ATS MATCH RUN";

    // 3. Compile Progress Bars
    let topicProgressBars = "";
    if (session && session.topicBreakdown && session.topicBreakdown.length > 0) {
        session.topicBreakdown.forEach(row => {
            topicProgressBars += `
                <div class="topic-item">
                    <div class="topic-name">
                        <span>${row.topic} (${row.questionsAttempted} attempts)</span>
                        <span>${row.averageScore}%</span>
                    </div>
                    <div class="progress-bar-track">
                        <div class="progress-bar-fill" style="width: ${row.averageScore}%;"></div>
                    </div>
                </div>
            `;
        });
    } else {
        topicProgressBars = `<p style="font-size: 13px; color: #888888;">No mock practice scores categorized yet. Complete a mock session to load breakdowns.</p>`;
    }

    // 4. Compile Heatmap Gaps Lists
    let strongAreaItems = "";
    let weakAreaItems = "";

    if (session && session.heatmapData && session.heatmapData.length > 0) {
        session.heatmapData.forEach(item => {
            if (item.status === "strong" || item.status === "moderate") {
                strongAreaItems += `<li>✓ ${item.topic} (${item.score}% accuracy)</li>`;
            } else {
                weakAreaItems += `<li>⚠ ${item.topic} (${item.score}% gaps)</li>`;
            }
        });
    } else {
        strongAreaItems = `<li style="color:#888888">No categories logged.</li>`;
        weakAreaItems = `<li style="color:#888888">No categories logged.</li>`;
    }

    // 5. Compile AI strengths and weaknesses points
    let strengthItems = "";
    let weaknessItems = "";
    
    // Gather from the mock session evaluations if answered
    if (session && session.answers && session.answers.length > 0) {
        const tempStrengths = [];
        const tempWeaknesses = [];

        session.answers.forEach(ans => {
            if (ans.evaluation?.feedback?.strengths) {
                tempStrengths.push(...ans.evaluation.feedback.strengths);
            }
            if (ans.evaluation?.feedback?.weaknesses) {
                tempWeaknesses.push(...ans.evaluation.feedback.weaknesses);
            }
        });

        // Unique and slice top 4
        const uniqueStrengths = [...new Set(tempStrengths)].slice(0, 4);
        const uniqueWeaknesses = [...new Set(tempWeaknesses)].slice(0, 4);

        uniqueStrengths.forEach(str => {
            strengthItems += `<li>${str}</li>`;
        });
        uniqueWeaknesses.forEach(weak => {
            weaknessItems += `<li>${weak}</li>`;
        });
    }

    if (!strengthItems) {
        strengthItems = `
            <li>Displays solid educational background matching target core disciplines.</li>
            <li>Shows good conceptual understanding of full-stack structures.</li>
        `;
    }
    if (!weaknessItems) {
        weaknessItems = `
            <li>Need more detail and real-world examples under responses.</li>
            <li>Incorporate specific terminology for database structures and optimization.</li>
        `;
    }

    // 6. Compile study plan steps
    let roadmapSteps = "";
    if (session && session.studyPlan && session.studyPlan.improvementRoadmap && session.studyPlan.improvementRoadmap.length > 0) {
        session.studyPlan.improvementRoadmap.slice(0, 3).forEach(road => {
            let stepsList = "";
            road.steps.forEach(st => {
                stepsList += `<li>${st}</li>`;
            });
            roadmapSteps += `
                <div class="roadmap-step">
                    <h4>${road.topic} (Target Score: ${road.targetScore}%)</h4>
                    <ul>${stepsList}</ul>
                </div>
            `;
        });
    } else {
        roadmapSteps = `
            <div class="roadmap-step">
                <h4>General Interview Preparation Optimization</h4>
                <ul>
                    <li>Incorporate key keywords identified in the job description.</li>
                    <li>Structure response frameworks using the STAR method for behavioral topics.</li>
                    <li>Perform mock sessions repeatedly to trace verbal scores improvement.</li>
                </ul>
            </div>
        `;
    }

    // 7. Delegate rendering to unified template service
    const { renderPdf } = require("./pdf/pdfRenderer.service");

    const pdfBuffer = await renderPdf("report.ejs", {
        username,
        jobTitle,
        date,
        resumeMatchScore,
        readinessScore,
        readinessStatus,
        atsScore,
        atsStatus,
        topicProgressBars,
        strongAreaItems,
        weakAreaItems,
        strengthItems,
        weaknessItems,
        roadmapSteps,
        repoResult
    });

    return pdfBuffer;
}

module.exports = { generatePerformancePdf };
