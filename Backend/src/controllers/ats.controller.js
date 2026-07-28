const mongoose = require("mongoose");
const { generateAtsReport } = require("../services/ai.service");
const atsReportModel = require("../models/atsReport.model");
const storageService = require("../services/storage.service");
const { parseResume } = require("../services/resumeParser.service");
const { logger } = require("../utils/securityLogger");

/**
 * @description Controller to generate an ATS Match & Keyword Heatmap report.
 */
async function analyzeAtsController(req, res, next) {
    let savedStorageResult = null;
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                code: "MISSING_FILE",
                message: "Please select a resume file to upload."
            });
        }

        const { jobDescription } = req.body;
        if (!jobDescription || jobDescription.trim() === "") {
            return res.status(400).json({
                success: false,
                code: "MISSING_JOB_DESCRIPTION",
                message: "Please enter a job description to match against."
            });
        }

        // 1. Run the Multi-Signal Parser Pipeline
        let parsedResult;
        try {
            parsedResult = await parseResume(req.file);
        } catch (parseErr) {
            return res.status(400).json({
                success: false,
                code: "PARSE_ERROR",
                message: parseErr.message || "Unable to parse this document."
            });
        }

        // 2. Save the physical file using the abstract storage service
        try {
            savedStorageResult = await storageService.saveFile(req.file, "resumes");
        } catch (storageErr) {
            logger.error("Storage error:", storageErr);
            return res.status(500).json({
                success: false,
                code: "UPLOAD_FAILED",
                message: "Cloud upload failed. Please try again."
            });
        }

        // 3. Call Gemini AI service to perform ATS analysis
        let atsReportByAi;
        try {
            atsReportByAi = await generateAtsReport({
                resume: parsedResult.text,
                jobDescription
            });
        } catch (aiErr) {
            logger.error("Error in generateAtsReport AI call:", aiErr);
            // Cleanup saved file on AI failure
            if (savedStorageResult && savedStorageResult.relativePath) {
                await storageService.deleteFile(savedStorageResult.relativePath).catch(err => logger.error("Failed to delete file on AI failure:", err));
            }

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

        // 4. Create the report in the database, mapping all storage and diagnostics
        const atsReport = await atsReportModel.create({
            user: req.user.id,
            resumeText: parsedResult.text,
            jobDescription,
            resumeName: req.file.originalname,
            resumeMimetype: req.file.mimetype,
            storageProvider: savedStorageResult.storageProvider,
            relativePath: savedStorageResult.relativePath,
            publicUrl: savedStorageResult.publicUrl,
            resumePages: parsedResult.pages,
            diagnostics: parsedResult.diagnostics,
            ...atsReportByAi
        });

        return res.status(201).json({
            success: true,
            message: "ATS report generated successfully.",
            atsReport
        });
    } catch (error) {
        logger.error("Error in analyzeAtsController:", error);
        // Cleanup file if database save crashes
        if (savedStorageResult && savedStorageResult.relativePath) {
            await storageService.deleteFile(savedStorageResult.relativePath).catch(err => logger.error("Failed to delete file on database save crash:", err));
        }
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
            .select("-resumeText -jobDescription -__v -heatmap -comparisons -recommendations -resumePages");

        return res.status(200).json({
            success: true,
            message: "ATS reports fetched successfully.",
            atsReports
        });
    } catch (error) {
        logger.error("Error in getAllAtsReportsController:", error);
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
        logger.error("Error in getAtsReportByIdController:", error);
        next(error);
    }
}

/**
 * @description Stream/download a resume file from storage.
 */
async function getResumeFileController(req, res, next) {
    try {
        const { atsId } = req.params;
        const atsReport = await atsReportModel.findOne({ _id: atsId, user: req.user.id });

        if (!atsReport || !atsReport.relativePath) {
            return res.status(404).json({
                success: false,
                message: "Resume file not found or has no physical storage mapping."
            });
        }

        try {
            const stream = storageService.getFileStream(atsReport.relativePath);
            
            res.set({
                "Content-Type": atsReport.resumeMimetype || "application/pdf",
                "Content-Disposition": `inline; filename="${atsReport.resumeName || "resume.pdf"}"`
            });

            stream.pipe(res);
        } catch (streamErr) {
            logger.error("Stream reading error:", streamErr);
            return res.status(404).json({
                success: false,
                message: "Resume file could not be found on storage media."
            });
        }
    } catch (error) {
        logger.error("Error in getResumeFileController:", error);
        next(error);
    }
}

/**
 * @description Controller to delete an ATS report by ID for the logged-in user.
 */
async function deleteAtsReportController(req, res, next) {
    try {
        const { atsId } = req.params;
        console.log(`[DELETE ROUTE MATCHED] Executing delete for atsId: ${atsId}, userId: ${req.user?.id}`);
        logger.info(`[DELETE ROUTE MATCHED] Executing delete for atsId: ${atsId}, userId: ${req.user?.id}`);

        if (!atsId || !mongoose.Types.ObjectId.isValid(atsId)) {
            return res.status(400).json({
                success: false,
                message: "Failed to delete ATS Match Scan."
            });
        }

        const deletedReport = await atsReportModel.findOneAndDelete({
            _id: atsId,
            user: req.user.id
        });

        if (!deletedReport) {
            return res.status(404).json({
                success: false,
                message: "ATS Match Scan not found."
            });
        }

        // Clean up physical file storage if present
        if (deletedReport.relativePath) {
            try {
                await storageService.deleteFile(deletedReport.relativePath);
            } catch (storageErr) {
                logger.error("Failed to delete physical resume file on storage:", storageErr);
            }
        }

        return res.status(200).json({
            success: true,
            message: "ATS Match Scan deleted successfully."
        });
    } catch (error) {
        logger.error("Error in deleteAtsReportController:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to delete ATS Match Scan."
        });
    }
}

module.exports = {
    analyzeAtsController,
    getAllAtsReportsController,
    getAtsReportByIdController,
    getResumeFileController,
    deleteAtsReportController
};
