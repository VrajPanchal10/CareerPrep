const { generateAtsReport } = require("../services/ai.service")
const atsReportModel = require("../models/atsReport.model")
const upload = require("../middlewares/file.middleware")

/**
 * @description Controller to generate an ATS Match & Keyword Heatmap report.
 */
async function analyzeAtsController(req, res, next) {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Resume file is required."
            });
        }

        let resumeContentText = "";
        try {
            resumeContentText = await upload.parseDocumentText(req.file);
        } catch (parseErr) {
            return res.status(400).json({
                success: false,
                message: parseErr.message || "Unable to process document."
            });
        }

        const { jobDescription } = req.body;
        if (!jobDescription || jobDescription.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "Job description is required."
            });
        }

        // Call Gemini AI service to perform ATS analysis
        let atsReportByAi;
        try {
            atsReportByAi = await generateAtsReport({
                resume: resumeContentText,
                jobDescription
            });
        } catch (aiErr) {
            console.error("Error in generateAtsReport AI call:", aiErr);
            if (aiErr.model || aiErr.status) {
                const isUnavailable = [503, "UNAVAILABLE"].includes(aiErr.status);
                return res.status(isUnavailable ? 503 : 502).json({
                    success: false,
                    message: isUnavailable 
                        ? "The AI service is currently experiencing high demand and is temporarily unavailable. Please try again in a few moments." 
                        : "The AI service encountered an error while analyzing your resume. Please try again.",
                    error: {
                        code: isUnavailable ? "AI_SERVICE_UNAVAILABLE" : "AI_SERVICE_ERROR",
                        status: aiErr.status,
                        model: aiErr.model,
                        timestamp: aiErr.timestamp
                    }
                });
            }
            throw aiErr;
        }

        // Create the report in the database
        const atsReport = await atsReportModel.create({
            user: req.user.id,
            resumeText: resumeContentText,
            jobDescription,
            ...atsReportByAi
        });

        return res.status(201).json({
            success: true,
            message: "ATS report generated successfully.",
            atsReport
        });
    } catch (error) {
        console.error("Error in analyzeAtsController:", error);
        next(error);
    }
}

/**
 * @description Controller to get all ATS reports of the logged-in user.
 */
async function getAllAtsReportsController(req, res, next) {
    try {
        const atsReports = await atsReportModel.find({ user: req.user.id })
            .sort({ createdAt: -1 })
            .select("-resumeText -jobDescription -__v -heatmap -comparisons -recommendations");

        return res.status(200).json({
            success: true,
            message: "ATS reports fetched successfully.",
            atsReports
        });
    } catch (error) {
        console.error("Error in getAllAtsReportsController:", error);
        next(error);
    }
}

/**
 * @description Controller to get a specific ATS report by ID.
 */
async function getAtsReportByIdController(req, res, next) {
    try {
        const { atsId } = req.params;
        const atsReport = await atsReportModel.findOne({ _id: atsId, user: req.user.id });

        if (!atsReport) {
            return res.status(404).json({
                success: false,
                message: "ATS report not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "ATS report fetched successfully.",
            atsReport
        });
    } catch (error) {
        console.error("Error in getAtsReportByIdController:", error);
        next(error);
    }
}

module.exports = {
    analyzeAtsController,
    getAllAtsReportsController,
    getAtsReportByIdController
}
