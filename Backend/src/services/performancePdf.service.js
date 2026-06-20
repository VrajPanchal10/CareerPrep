const interviewReportModel = require("../models/interviewReport.model");
const interviewSessionModel = require("../models/interviewSession.model");
const atsReportModel = require("../models/atsReport.model");
const userModel = require("../models/user.model");
const puppeteer = require("puppeteer");
const codingSubmissionModel = require("../models/codingSubmission.model");
const repositoryInterviewResultModel = require("../models/repositoryInterviewResult.model");

/**
 * @description Generates a polished 3-page Performance Report PDF buffer.
 */
async function generatePerformancePdf({ reportId, userId }) {
    // 1. Fetch data models
    const user = await userModel.findById(userId);
    const report = await interviewReportModel.findById(reportId);
    
    // Fetch coding submissions to compile Coding Performance Summary page
    const codingSubmissions = await codingSubmissionModel.find({ userId }).populate("questionId");
    
    let codingReadinessScore = 0;
    let topLanguagesStr = "N/A";
    let strongTopicsStr = "None logged";
    let weakTopicsStr = "None logged";
    let hasCodingStats = false;

    if (codingSubmissions && codingSubmissions.length > 0) {
        hasCodingStats = true;
        
        // 1. Calculate Coding Readiness Score (average of maximum scores on unique questions)
        const questionBestScores = {};
        const langCounts = {};
        
        codingSubmissions.forEach(sub => {
            if (!sub.questionId) return;
            const qId = sub.questionId._id.toString();
            const topic = sub.questionId.topic;
            
            if (!questionBestScores[qId]) {
                questionBestScores[qId] = { score: sub.overallScore, topic };
            } else if (sub.overallScore > questionBestScores[qId].score) {
                questionBestScores[qId].score = sub.overallScore;
            }
            
            const lang = sub.language;
            langCounts[lang] = (langCounts[lang] || 0) + 1;
        });

        const uniqueAttempts = Object.values(questionBestScores);
        let sumUniqueBest = 0;
        uniqueAttempts.forEach(attempt => sumUniqueBest += attempt.score);
        codingReadinessScore = uniqueAttempts.length > 0
            ? Math.round(sumUniqueBest / uniqueAttempts.length)
            : 0;

        // 2. Top Languages (sorted by count)
        const sortedLangs = Object.entries(langCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([lang]) => lang.charAt(0).toUpperCase() + lang.slice(1));
        topLanguagesStr = sortedLangs.slice(0, 3).join(", ") || "None";

        // 3. Strong & Weak Topics (based on unique question average)
        const topicBestAggregate = {};
        uniqueAttempts.forEach(attempt => {
            const topic = attempt.topic;
            if (!topicBestAggregate[topic]) {
                topicBestAggregate[topic] = { sum: 0, count: 0 };
            }
            topicBestAggregate[topic].sum += attempt.score;
            topicBestAggregate[topic].count += 1;
        });

        const strongTopics = [];
        const weakTopics = [];
        Object.entries(topicBestAggregate).forEach(([topic, data]) => {
            const avg = Math.round(data.sum / data.count);
            if (avg >= 75) {
                strongTopics.push(`${topic} (${avg}%)`);
            } else {
                weakTopics.push(`${topic} (${avg}%)`);
            }
        });

        strongTopicsStr = strongTopics.join(", ") || "None";
        weakTopicsStr = weakTopics.join(", ") || "None";
    }
    
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

    // 7. Inject variables into HTML
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #333333;
            background: #ffffff;
            margin: 0;
            padding: 0;
            line-height: 1.5;
            -webkit-print-color-adjust: exact;
          }
          .page {
            width: 210mm;
            height: 297mm;
            box-sizing: border-box;
            padding: 20mm;
            position: relative;
            page-break-after: always;
          }
          .page:last-child {
            page-break-after: avoid;
          }
          .header {
            border-bottom: 2px solid #d20d3b;
            padding-bottom: 15px;
            margin-bottom: 30px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .logo {
            font-size: 24px;
            font-weight: 800;
            color: #111111;
          }
          .logo span {
            color: #d20d3b;
          }
          .report-title {
            font-size: 16px;
            font-weight: 700;
            text-transform: uppercase;
            color: #666666;
            letter-spacing: 1px;
          }
          .candidate-info {
            margin-bottom: 40px;
            font-size: 14px;
          }
          .candidate-info table {
            width: 100%;
            border-collapse: collapse;
          }
          .candidate-info td {
            padding: 8px 0;
          }
          .candidate-info td.label {
            font-weight: 700;
            color: #555555;
            width: 150px;
          }
          .score-cards-container {
            display: flex;
            justify-content: space-between;
            margin-bottom: 40px;
            gap: 20px;
          }
          .score-card {
            flex: 1;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            padding: 25px;
            text-align: center;
            background: #fafafa;
          }
          .score-card h3 {
            margin: 0 0 15px 0;
            font-size: 14px;
            text-transform: uppercase;
            color: #666666;
            letter-spacing: 0.5px;
          }
          .score-card .score {
            font-size: 48px;
            font-weight: 800;
            color: #d20d3b;
            line-height: 1;
          }
          .score-card .score span {
            font-size: 24px;
            color: #777777;
            font-weight: 600;
          }
          .score-card .status {
            margin-top: 10px;
            font-size: 11px;
            font-weight: 700;
            color: #555555;
            text-transform: uppercase;
          }
          .summary-text {
            font-size: 14px;
            color: #555555;
            line-height: 1.7;
          }
          
          /* Page 2 details */
          .section-title {
            font-size: 16px;
            font-weight: 700;
            margin-bottom: 20px;
            color: #111111;
            border-bottom: 1px solid #e0e0e0;
            padding-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .topic-list {
            margin-bottom: 40px;
          }
          .topic-item {
            margin-bottom: 15px;
          }
          .topic-name {
            font-size: 13px;
            font-weight: 700;
            color: #444444;
            margin-bottom: 5px;
            display: flex;
            justify-content: space-between;
          }
          .progress-bar-track {
            height: 8px;
            background: #eeeeee;
            border-radius: 4px;
            overflow: hidden;
          }
          .progress-bar-fill {
            height: 100%;
            background: #d20d3b;
            border-radius: 4px;
          }
          .heatmap-summary {
            display: flex;
            justify-content: space-between;
            gap: 30px;
          }
          .heatmap-column {
            flex: 1;
          }
          .heatmap-column h4 {
            margin: 0 0 15px 0;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #555555;
          }
          .heatmap-list {
            list-style: none;
            padding: 0;
            margin: 0;
          }
          .heatmap-list li {
            font-size: 13px;
            padding: 8px 0;
            border-bottom: 1px solid #f0f0f0;
          }
          .heatmap-list.strong li {
            color: #27ae60;
            font-weight: 600;
          }
          .heatmap-list.needs-improvement li {
            color: #d35400;
            font-weight: 600;
          }
          
          /* Page 3 details */
          .roadmap-steps {
            display: flex;
            flex-direction: column;
            gap: 15px;
          }
          .roadmap-step {
            background: #fafafa;
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            padding: 15px;
          }
          .roadmap-step h4 {
            margin: 0 0 8px 0;
            font-size: 13px;
            color: #111111;
          }
          .roadmap-step ul {
            margin: 0;
            padding-left: 18px;
            font-size: 12px;
            color: #555555;
          }
          .roadmap-step li {
            margin-bottom: 4px;
          }
          .bullet-list {
            padding-left: 20px;
            font-size: 13px;
            color: #555555;
            margin-bottom: 30px;
          }
          .bullet-list li {
            margin-bottom: 6px;
          }
        </style>
        </head>
        <body>

        <div class="page">
          <div class="header">
            <div class="logo">Career<span>Prep</span></div>
            <div class="report-title">CareerPrep Performance Report</div>
          </div>
          
          <div class="candidate-info">
            <div class="section-title">Candidate Evaluation Metadata</div>
            <table>
              <tr>
                <td class="label">Candidate Name:</td>
                <td>${username}</td>
                <td class="label">Job Title:</td>
                <td>${jobTitle}</td>
              </tr>
              <tr>
                <td class="label">Evaluation Date:</td>
                <td>${date}</td>
                <td class="label">Resume ATS Match:</td>
                <td>${resumeMatchScore}%</td>
              </tr>
            </table>
          </div>
          
          <div class="section-title">Executive Score Summary</div>
          <div class="score-cards-container">
            <div class="score-card">
              <h3>Readiness Score</h3>
              <div class="score">${readinessScore}<span>%</span></div>
              <div class="status">${readinessStatus}</div>
            </div>
            <div class="score-card">
              <h3>ATS Match Score</h3>
              <div class="score">${atsScore}<span>%</span></div>
              <div class="status">${atsStatus}</div>
            </div>
          </div>
          
          <div class="section-title">Overview Assessment</div>
          <div class="summary-text">
            This document summarizes the comprehensive assessment of the candidate relative to the <strong>${jobTitle}</strong> position. The evaluation incorporates automated ATS parser analyses measuring keyword alignment, combined with interactive mock interview simulations mapping conceptual accuracy and explanation qualities across core technical and behavioral dimensions.
          </div>
        </div>

        <div class="page">
          <div class="header">
            <div class="logo">Career<span>Prep</span></div>
            <div class="report-title">CareerPrep Performance Report</div>
          </div>
          
          <div class="section-title">Topic Performance Breakdown</div>
          <div class="topic-list">
            ${topicProgressBars}
          </div>
          
          <div class="section-title">Weakness Heatmap Analysis</div>
          <div class="heatmap-summary">
            <div class="heatmap-column">
              <h4>✓ Strong Areas (Score &ge; 60%)</h4>
              <ul class="heatmap-list strong">
                ${strongAreaItems}
              </ul>
            </div>
            <div class="heatmap-column">
              <h4>⚠ Needs Review (Score &lt; 60%)</h4>
              <ul class="heatmap-list needs-improvement">
                ${weakAreaItems}
              </ul>
            </div>
          </div>
        </div>

        <div class="page">
          <div class="header">
            <div class="logo">Career<span>Prep</span></div>
            <div class="report-title">CareerPrep Performance Report</div>
          </div>
          
          <div class="section-title">AI Performance Review</div>
          <h4 style="margin: 0 0 10px 0; color: #27ae60; font-size: 13px;">Key Strengths</h4>
          <ul class="bullet-list" style="margin-bottom: 25px;">
            ${strengthItems}
          </ul>
          
          <h4 style="margin: 0 0 10px 0; color: #c0392b; font-size: 13px;">Gaps & Gaps Areas</h4>
          <ul class="bullet-list" style="margin-bottom: 25px;">
            ${weaknessItems}
          </ul>
          
          <div class="section-title">Personalized Optimization Roadmap</div>
          <div style="font-size: 13px; font-weight: 700; margin-bottom: 15px;">
            Current Score: <span style="color: #d20d3b;">${readinessScore}%</span> &rarr; Target Readiness: <span style="color: #27ae60;">90%</span>
          </div>
          <div class="roadmap-steps">
            ${roadmapSteps}
          </div>
        </div>

        ${hasCodingStats ? `
        <div class="page">
          <div class="header">
            <div class="logo">Career<span>Prep</span></div>
            <div class="report-title">CareerPrep Performance Report</div>
          </div>
          
          <div class="section-title">Coding Performance Summary</div>
          <p class="summary-text" style="margin-bottom: 30px;">
            Below is the comprehensive evaluation of the candidate's coding interview preparation. Scores are compiled from code challenges completed using the Monaco editor workspace across various technical topics.
          </p>

          <div class="score-cards-container" style="margin-bottom: 40px;">
            <div class="score-card" style="background: #fafafa; border: 1px solid #e0e0e0;">
              <h3>Coding Readiness Score</h3>
              <div class="score" style="color: #27ae60;">${codingReadinessScore}<span>%</span></div>
              <div class="status" style="color: #27ae60;">
                ${codingReadinessScore >= 80 ? "EXCELLENT READY STATUS" : codingReadinessScore >= 60 ? "MODERATE PRACTICE STATUS" : "UNPREPARED STATUS"}
              </div>
            </div>
            <div class="score-card" style="background: #fafafa; border: 1px solid #e0e0e0;">
              <h3>Top Programming Languages</h3>
              <div style="font-size: 20px; font-weight: 700; color: #111111; margin-top: 15px; text-transform: uppercase;">
                ${topLanguagesStr}
              </div>
              <div class="status">Prepped Languages</div>
            </div>
          </div>

          <div class="section-title">Coding Topic Competency Analysis</div>
          <div class="heatmap-summary">
            <div class="heatmap-column">
              <h4 style="color: #27ae60; font-size: 13px; text-transform: uppercase;">✓ Strong Topics (Score &ge; 75%)</h4>
              <p style="font-size: 13px; color: #555555; line-height: 1.6; background: #f9f9f9; padding: 15px; border-radius: 6px; border-left: 4px solid #27ae60;">
                ${strongTopicsStr}
              </p>
            </div>
            <div class="heatmap-column">
              <h4 style="color: #d35400; font-size: 13px; text-transform: uppercase;">⚠ Needs Review (Score &lt; 75%)</h4>
              <p style="font-size: 13px; color: #555555; line-height: 1.6; background: #f9f9f9; padding: 15px; border-radius: 6px; border-left: 4px solid #d35400;">
                ${weakTopicsStr}
              </p>
            </div>
          </div>
        </div>
        ` : ''}

        ${repoResult ? `
        <div class="page">
          <div class="header">
            <div class="logo">Career<span>Prep</span></div>
            <div class="report-title">CareerPrep Project Mastery Report</div>
          </div>
          
          <div class="section-title">GitHub Project Defense Performance</div>
          <p class="summary-text" style="margin-bottom: 30px;">
            Below is the architectural defense evaluation for your repository: <strong>${repoResult.repoName}</strong> (<a href="${repoResult.repoUrl}" target="_blank">${repoResult.repoUrl}</a>).
          </p>

          <div class="score-cards-container" style="margin-bottom: 40px; gap: 20px;">
            <div class="score-card" style="background: #fafafa; border: 1px solid #e0e0e0; flex: 1; border-radius: 8px; padding: 25px; text-align: center;">
              <h3>Project Mastery Score</h3>
              <div class="score" style="color: #27ae60; font-size: 48px; font-weight: 800; line-height: 1;">${repoResult.scores.overallMasteryScore}<span>%</span></div>
              <div class="status" style="color: #27ae60; margin-top: 10px; font-size: 11px; font-weight: 700; text-transform: uppercase;">
                ${repoResult.scores.overallMasteryScore >= 80 ? "EXCELLENT MASTERY" : repoResult.scores.overallMasteryScore >= 60 ? "MODERATE MASTERY" : "BASIC UNDERSTANDING"}
              </div>
            </div>
            <div class="score-card" style="background: #fafafa; border: 1px solid #e0e0e0; flex: 1; border-radius: 8px; padding: 25px; text-align: center;">
              <h3>Repository Name</h3>
              <div style="font-size: 18px; font-weight: 700; color: #111111; margin-top: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${repoResult.repoName}
              </div>
              <div class="status" style="margin-top: 10px; font-size: 11px; font-weight: 700; text-transform: uppercase;">Analyzed Project</div>
            </div>
          </div>

          <div class="section-title">Project Defense Scores</div>
          <div class="topic-list">
            <div class="topic-item" style="margin-bottom: 15px;">
              <div class="topic-name" style="font-size: 13px; font-weight: 700; color: #444444; margin-bottom: 5px; display: flex; justify-content: space-between;">
                <span>Architecture Score</span>
                <span>${repoResult.scores.architectureScore}%</span>
              </div>
              <div class="progress-bar-track" style="height: 8px; background: #eeeeee; border-radius: 4px; overflow: hidden;">
                <div class="progress-bar-fill" style="height: 100%; background: #d20d3b; border-radius: 4px; width: ${repoResult.scores.architectureScore}%;"></div>
              </div>
            </div>
            <div class="topic-item" style="margin-bottom: 15px;">
              <div class="topic-name" style="font-size: 13px; font-weight: 700; color: #444444; margin-bottom: 5px; display: flex; justify-content: space-between;">
                <span>Security Score</span>
                <span>${repoResult.scores.securityScore}%</span>
              </div>
              <div class="progress-bar-track" style="height: 8px; background: #eeeeee; border-radius: 4px; overflow: hidden;">
                <div class="progress-bar-fill" style="height: 100%; background: #d20d3b; border-radius: 4px; width: ${repoResult.scores.securityScore}%;"></div>
              </div>
            </div>
            <div class="topic-item" style="margin-bottom: 15px;">
              <div class="topic-name" style="font-size: 13px; font-weight: 700; color: #444444; margin-bottom: 5px; display: flex; justify-content: space-between;">
                <span>Database Score</span>
                <span>${repoResult.scores.databaseScore}%</span>
              </div>
              <div class="progress-bar-track" style="height: 8px; background: #eeeeee; border-radius: 4px; overflow: hidden;">
                <div class="progress-bar-fill" style="height: 100%; background: #d20d3b; border-radius: 4px; width: ${repoResult.scores.databaseScore}%;"></div>
              </div>
            </div>
            <div class="topic-item" style="margin-bottom: 15px;">
              <div class="topic-name" style="font-size: 13px; font-weight: 700; color: #444444; margin-bottom: 5px; display: flex; justify-content: space-between;">
                <span>API Design Score</span>
                <span>${repoResult.scores.apiDesignScore}%</span>
              </div>
              <div class="progress-bar-track" style="height: 8px; background: #eeeeee; border-radius: 4px; overflow: hidden;">
                <div class="progress-bar-fill" style="height: 100%; background: #d20d3b; border-radius: 4px; width: ${repoResult.scores.apiDesignScore}%;"></div>
              </div>
            </div>
            <div class="topic-item" style="margin-bottom: 15px;">
              <div class="topic-name" style="font-size: 13px; font-weight: 700; color: #444444; margin-bottom: 5px; display: flex; justify-content: space-between;">
                <span>Deployment Score</span>
                <span>${repoResult.scores.deploymentScore}%</span>
              </div>
              <div class="progress-bar-track" style="height: 8px; background: #eeeeee; border-radius: 4px; overflow: hidden;">
                <div class="progress-bar-fill" style="height: 100%; background: #d20d3b; border-radius: 4px; width: ${repoResult.scores.deploymentScore}%;"></div>
              </div>
            </div>
          </div>

          <div class="section-title">Mastery Feedback</div>
          <div class="heatmap-summary" style="display: flex; justify-content: space-between; gap: 30px;">
            <div class="heatmap-column" style="flex: 1;">
              <h4 style="color: #27ae60; font-size: 13px; text-transform: uppercase;">✓ Strengths</h4>
              <ul class="heatmap-list strong" style="list-style: none; padding: 0; margin: 0;">
                ${repoResult.feedback.strengths.slice(0, 3).map(s => `<li style="font-size: 13px; padding: 8px 0; border-bottom: 1px solid #f0f0f0; color: #27ae60; font-weight: 600;">✓ ${s}</li>`).join('')}
              </ul>
            </div>
            <div class="heatmap-column" style="flex: 1;">
              <h4 style="color: #d35400; font-size: 13px; text-transform: uppercase;">⚠ Recommendations</h4>
              <ul class="heatmap-list needs-improvement" style="list-style: none; padding: 0; margin: 0;">
                ${repoResult.feedback.recommendations.slice(0, 3).map(r => `<li style="font-size: 13px; padding: 8px 0; border-bottom: 1px solid #f0f0f0; color: #d35400; font-weight: 600;">⚠ ${r}</li>`).join('')}
              </ul>
            </div>
          </div>
        </div>
        ` : ''}

        </body>
        </html>
    `;

    // 8. Launch Puppeteer page to print A4 PDF buffer
    const browser = await puppeteer.launch();
    const p = await browser.newPage();
    await p.setContent(htmlContent, { waitUntil: "networkidle0" });
    
    const pdfBuffer = await p.pdf({
        format: "A4",
        margin: {
            top: "15mm",
            bottom: "15mm",
            left: "15mm",
            right: "15mm"
        },
        printBackground: true
    });

    await browser.close();
    return pdfBuffer;
}

module.exports = { generatePerformancePdf };
