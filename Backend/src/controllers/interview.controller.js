const pdfParse = require("pdf-parse")
const { generateInterviewReport, generateResumePdf } = require("../services/ai.service")
const interviewReportModel = require("../models/interviewReport.model")




/**
 * @description Controller to generate interview report based on user self description, resume and job description.
 */
async function generateInterViewReportController(req, res, next) {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Resume PDF file is required."
            });
        }

        let resumeContentText = "";
        try {
            const parsedPdf = await (new pdfParse.PDFParse(Uint8Array.from(req.file.buffer))).getText();
            resumeContentText = parsedPdf.text;
        } catch (pdfErr) {
            console.error("PDF Parsing Error:", pdfErr);
            return res.status(400).json({
                success: false,
                message: "Failed to parse the uploaded resume PDF file. Please ensure it is a valid PDF document."
            });
        }

        const { selfDescription, jobDescription } = req.body;
        if (!selfDescription || !jobDescription) {
            return res.status(400).json({
                success: false,
                message: "Self description and Job description are required."
            });
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
        console.error("Error in generateInterViewReportController:", error);
        
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
async function getInterviewReportByIdController(req, res) {

    const { interviewId } = req.params

    const interviewReport = await interviewReportModel.findOne({ _id: interviewId, user: req.user.id })

    if (!interviewReport) {
        return res.status(404).json({
            message: "Interview report not found."
        })
    }

    res.status(200).json({
        message: "Interview report fetched successfully.",
        interviewReport
    })
}


/** 
 * @description Controller to get all interview reports of logged in user.
 */
async function getAllInterviewReportsController(req, res) {
    const interviewReports = await interviewReportModel.find({ user: req.user.id }).sort({ createdAt: -1 }).select("-resume -selfDescription -jobDescription -__v -technicalQuestions -behavioralQuestions -skillGaps -preparationPlan")

    res.status(200).json({
        message: "Interview reports fetched successfully.",
        interviewReports
    })
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
            console.error("Error in generateResumePdf AI call:", error);
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

        res.set({
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename=resume_${interviewReportId}.pdf`
        })

        return res.send(pdfBuffer)
    } catch (error) {
        console.error("Error in generateResumePdfController:", error);
        next(error);
    }
}

module.exports = { generateInterViewReportController, getInterviewReportByIdController, getAllInterviewReportsController, generateResumePdfController }