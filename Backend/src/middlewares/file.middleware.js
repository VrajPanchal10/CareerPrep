const multer = require("multer")
const path = require("path")
const { logSecurityEvent } = require("./auth.middleware")
const { logger } = require("../utils/securityLogger")

/**
 * Sanitizes a filename to prevent path traversal and remove unsafe characters.
 */
function sanitizeFilename(filename) {
    if (!filename) return "resume.pdf";
    const ext = path.extname(filename).toLowerCase();
    const nameWithoutExt = path.basename(filename, ext);
    // Retain alphanumeric, spaces, underscores, and dashes
    const sanitized = nameWithoutExt
        .replace(/[^a-zA-Z0-9_\-\s]/g, "")
        .trim()
        .substring(0, 100);
    return `${sanitized || "resume"}${ext}`;
}

const uploadConfig = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const mime = file.mimetype;

        const isPdf = ext === ".pdf" && mime === "application/pdf";
        const isDocx = ext === ".docx" && mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

        if (isPdf || isDocx) {
            return cb(null, true);
        }

        // Return the exact clean validation error
        return cb(new Error("Only PDF and DOCX files are allowed."), false);
    }
});

const uploadSingleResume = (fieldName) => {
    const uploadMiddleware = uploadConfig.single(fieldName);

    return (req, res, next) => {
        const clientIp = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;

        uploadMiddleware(req, res, (err) => {
            if (err) {
                let message = "Unable to process document.";

                if (err.message === "Only PDF and DOCX files are allowed.") {
                    message = "Only PDF and DOCX files are allowed.";
                } else if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
                    message = "Maximum file size is 5 MB.";
                } else {
                    message = err.message || "Unable to process document.";
                }

                logSecurityEvent({
                    eventType: "FILE_UPLOAD_VIOLATION",
                    ip: clientIp,
                    details: `Rejected upload: ${message}`
                });

                return res.status(400).json({
                    success: false,
                    message: message
                });
            }

            if (req.file) {
                req.file.originalname = sanitizeFilename(req.file.originalname);
            }
            next();
        });
    };
};

/**
 * @description Extracts plain text from the uploaded PDF or DOCX file buffer.
 */
async function parseDocumentText(file) {
    if (!file || !file.buffer || file.buffer.length === 0) {
        throw new Error("Uploaded file is corrupted.");
    }

    const ext = path.extname(file.originalname).toLowerCase();

    if (ext === ".pdf") {
        try {
            const pdfParse = require("pdf-parse");
            const parsedPdf = await (new pdfParse.PDFParse(Uint8Array.from(file.buffer))).getText();
            const text = parsedPdf.text;
            if (!text || text.trim() === "") {
                throw new Error("Empty PDF text.");
            }
            return text;
        } catch (pdfErr) {
            logger.error("PDF Parsing Error:", pdfErr);
            throw new Error("Uploaded file is corrupted.");
        }
    } else if (ext === ".docx") {
        try {
            const mammoth = require("mammoth");
            const result = await mammoth.extractRawText({ buffer: file.buffer });
            const text = result.value;
            if (!text || text.trim() === "") {
                throw new Error("Empty DOCX text.");
            }
            return text;
        } catch (docxErr) {
            logger.error("DOCX Parsing Error:", docxErr);
            throw new Error("Uploaded file is corrupted.");
        }
    } else {
        throw new Error("Only PDF and DOCX files are allowed.");
    }
}

const upload = {
    single: (fieldName) => uploadSingleResume(fieldName),
    parseDocumentText
};

module.exports = upload