const mongoose = require("mongoose");
require("dotenv").config();

const { generatePerformancePdf } = require("../src/services/performancePdf.service");
const { generateResumePdf } = require("../src/services/ai.service");
const interviewReportModel = require("../src/models/interviewReport.model");
const userModel = require("../src/models/user.model");

async function main() {
    await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/interview-db");
    console.log("Connected to DB");

    const report = await interviewReportModel.findOne();
    if (!report) {
        console.error("No interview report found in database. Cannot test.");
        await mongoose.connection.close();
        return;
    }

    console.log(`Found report: ${report._id} for user: ${report.user}`);
    try {
        const pdfBuffer = await generatePerformancePdf({
            reportId: report._id.toString(),
            userId: report.user.toString()
        });
        console.log(`Successfully generated Performance PDF! Buffer size: ${pdfBuffer.length} bytes`);

        const resumePdfBuffer = await generateResumePdf({
            resume: report.resume,
            selfDescription: report.selfDescription,
            jobDescription: report.jobDescription
        });
        console.log(`Successfully generated Resume PDF! Buffer size: ${resumePdfBuffer.length} bytes`);
    } catch (err) {
        console.error("PDF generation failed with error:", err);
    }

    await mongoose.connection.close();
}

main().catch(console.error);
