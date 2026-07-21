/**
 * ATS Analysis Prompt Template
 */
module.exports = {
    generateAtsReportPrompt: ({ resume, jobDescription }) => {
        return `Perform a complete ATS keyword and match analysis comparing the candidate's resume with the job description.
Resume: ${resume}
Job Description: ${jobDescription}

Evaluate keyword occurrences, construct an overall ATS match score, compute matching breakdown scores, identify matched, missing, and extra keywords, formulate a detailed heatmap array, create side-by-side comparison tables, and list strategic recommendations to optimize the resume.
Make the response highly professional, constructive, and realistic.`;
    }
};
