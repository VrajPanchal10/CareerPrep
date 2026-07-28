const mongoose = require("mongoose")
const { generateInterviewReport, generateResumePdf } = require("../services/ai.service")
const { generatePerformancePdf } = require("../services/performancePdf.service")
const interviewReportModel = require("../models/interviewReport.model")
const interviewSessionModel = require("../models/interviewSession.model")
const upload = require("../middlewares/file.middleware")
const { logger } = require("../utils/securityLogger")

/**
 * @description Controller to generate interview report based on user self description, resume and job description.
 */
async function generateInterViewReportController(req, res, next) {
    try {
        const { selfDescription, jobDescription, resumeText } = req.body;

        if (!jobDescription || jobDescription.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "Job description is required."
            });
        }

        if (!req.file && (!selfDescription || selfDescription.trim() === "") && (!resumeText || resumeText.trim() === "")) {
            return res.status(400).json({
                success: false,
                message: "Please upload a resume file, enter resume text, or provide a self-description."
            });
        }

        let resumeContentText = resumeText || "";
        if (req.file) {
            try {
                resumeContentText = await upload.parseDocumentText(req.file);
            } catch (parseErr) {
                return res.status(400).json({
                    success: false,
                    message: parseErr.message || "Unable to process document."
                });
            }
        }

        const interViewReportByAi = await generateInterviewReport({
            resume: resumeContentText,
            selfDescription,
            jobDescription
        });

        const interviewReport = await interviewReportModel.create({
            user: req.user.id,
            resume: resumeContentText,
            selfDescription,
            jobDescription,
            ...interViewReportByAi
        });

        return res.status(201).json({
            success: true,
            message: "Interview report generated successfully.",
            interviewReport
        });
    } catch (error) {
        logger.error("Error in generateInterViewReportController:", error);
        
        // Handle Gemini AI-specific errors
        if (error.model || error.status) {
            const isUnavailable = [503, "UNAVAILABLE"].includes(error.status);
            return res.status(isUnavailable ? 503 : 502).json({
                success: false,
                message: isUnavailable 
                    ? "The AI service is currently experiencing high demand and is temporarily unavailable. Please try again in a few moments." 
                    : "The AI service encountered an error while processing your request. Please try again.",
                error: {
                    code: isUnavailable ? "AI_SERVICE_UNAVAILABLE" : "AI_SERVICE_ERROR",
                    status: error.status,
                    model: error.model,
                    timestamp: error.timestamp
                }
            });
        }
        
        next(error);
    }
}

/**
 * @description Controller to get interview report by interviewId.
 */
async function getInterviewReportByIdController(req, res, next) {
    try {
        const { interviewId } = req.params;

        const interviewReport = await interviewReportModel.findOne({ _id: interviewId, user: req.user.id });

        if (!interviewReport) {
            return res.status(404).json({
                success: false,
                message: "Interview report not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Interview report fetched successfully.",
            interviewReport
        });
    } catch (error) {
        next(error);
    }
}


/** 
 * @description Controller to get all interview reports of logged in user.
 */
async function getAllInterviewReportsController(req, res, next) {
    try {
        const interviewReports = await interviewReportModel
            .find({ user: req.user.id })
            .sort({ createdAt: -1 })
            .select("-resume -selfDescription -jobDescription -__v -technicalQuestions -behavioralQuestions -skillGaps -preparationPlan");

        return res.status(200).json({
            success: true,
            message: "Interview reports fetched successfully.",
            interviewReports
        });
    } catch (error) {
        next(error);
    }
}


/**
 * @description Controller to generate resume PDF based on user self description, resume and job description.
 */
async function generateResumePdfController(req, res, next) {
    try {
        const { interviewReportId } = req.params

        const interviewReport = await interviewReportModel.findById(interviewReportId)

        if (!interviewReport) {
            return res.status(404).json({
                success: false,
                message: "Interview report not found."
            })
        }

        const { resume, jobDescription, selfDescription } = interviewReport

        let pdfBuffer;
        try {
            pdfBuffer = await generateResumePdf({ resume, jobDescription, selfDescription })
        } catch (error) {
            logger.error("Error in generateResumePdf AI call:", error);
            if (error.model || error.status) {
                const isUnavailable = [503, "UNAVAILABLE"].includes(error.status);
                return res.status(isUnavailable ? 503 : 502).json({
                    success: false,
                    message: isUnavailable 
                        ? "The AI service is currently experiencing high demand and is temporarily unavailable. Please try again in a few moments." 
                        : "The AI service encountered an error while generating your resume. Please try again.",
                    error: {
                        code: isUnavailable ? "AI_SERVICE_UNAVAILABLE" : "AI_SERVICE_ERROR",
                        status: error.status,
                        model: error.model,
                        timestamp: error.timestamp
                    }
                });
            }
            throw error; // Propagate to outer catch
        }

        if (!pdfBuffer || pdfBuffer.length === 0) {
            return res.status(500).json({
                success: false,
                message: "Resume PDF generation produced an empty file."
            });
        }

        res.set({
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename=resume_${interviewReportId}.pdf`
        })

        return res.send(pdfBuffer)
    } catch (error) {
        logger.error("Error in generateResumePdfController:", error);
        return res.status(500).json({
            success: false,
            message: "An internal server error occurred while processing your resume PDF.",
            error: { code: "INTERNAL_SERVER_ERROR" }
        });
    }
}

/**
 * @description Controller to download a candidate's complete Performance Report PDF.
 */
async function exportPerformancePdfController(req, res, next) {
    try {
        const { reportId } = req.params;
        const mongoose = require("mongoose");
        
        // 1. Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(reportId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid Interview Report ID format."
            });
        }

        // 2. Validate existence and ownership before launching Puppeteer
        const report = await interviewReportModel.findOne({ _id: reportId, user: req.user.id });
        if (!report) {
            return res.status(404).json({
                success: false,
                message: "Interview Plan report not found or unauthorized access."
            });
        }

        let pdfBuffer;
        try {
            pdfBuffer = await generatePerformancePdf({
                reportId,
                userId: req.user.id
            });
        } catch (error) {
            logger.error("Error in generatePerformancePdf call:", error);
            return res.status(500).json({
                success: false,
                message: "Failed to generate interview performance PDF report. Please try again.",
                error: {
                    code: "PDF_GENERATION_FAILED",
                    details: error.message
                }
            });
        }

        if (!pdfBuffer || pdfBuffer.length === 0) {
            return res.status(500).json({
                success: false,
                message: "Performance PDF generation produced an empty file."
            });
        }

        res.set({
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename=CareerPrep_Performance_Report_${reportId}.pdf`
        });

        return res.send(pdfBuffer);
    } catch (error) {
        logger.error("Error in exportPerformancePdfController:", error);
        return res.status(500).json({
            success: false,
            message: "An internal server error occurred while exporting the performance report.",
            error: { code: "INTERNAL_SERVER_ERROR" }
        });
    }
}

/**
 * @description Controller to delete an interview report by ID for logged in user.
 */
async function deleteInterviewReportController(req, res, next) {
    try {
        const { interviewId } = req.params;
        console.log(`[DELETE ROUTE MATCHED] Executing delete for reportId: ${interviewId}, userId: ${req.user?.id}`);
        logger.info(`[DELETE ROUTE MATCHED] Executing delete for reportId: ${interviewId}, userId: ${req.user?.id}`);

        if (!interviewId || !mongoose.Types.ObjectId.isValid(interviewId)) {
            return res.status(400).json({
                success: false,
                message: "Failed to delete interview plan."
            });
        }

        const deletedReport = await interviewReportModel.findOneAndDelete({
            _id: interviewId,
            user: req.user.id
        });

        if (!deletedReport) {
            return res.status(404).json({
                success: false,
                message: "Failed to delete interview plan."
            });
        }

        // Clean up associated practice sessions
        try {
            await interviewSessionModel.deleteMany({ interviewReport: interviewId, user: req.user.id });
        } catch (cleanupErr) {
            logger.error("Failed to clean up associated interview sessions:", cleanupErr);
        }

        return res.status(200).json({
            success: true,
            message: "Interview plan deleted successfully."
        });
    } catch (error) {
        logger.error("Error in deleteInterviewReportController:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to delete interview plan."
        });
    }
}

module.exports = { 
    generateInterViewReportController, 
    getInterviewReportByIdController, 
    getAllInterviewReportsController, 
    generateResumePdfController,
    exportPerformancePdfController,
    deleteInterviewReportController
}