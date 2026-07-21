const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const path = require("path");
const { performance } = require("perf_hooks");
const { logger } = require("../utils/securityLogger");

/**
 * Validates basic file format and size limits.
 */
function validateFile(file) {
    if (!file || !file.buffer || file.buffer.length === 0) {
        throw new Error("Uploaded file is corrupted or empty.");
    }
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== ".pdf" && ext !== ".docx") {
        throw new Error("Only PDF and DOCX files are allowed.");
    }
    if (file.size > 5 * 1024 * 1024) {
        throw new Error("Maximum file size is 5 MB.");
    }
}

/**
 * Sanitizes input text, removing null characters, script injections, and excessive whitespace.
 */
function sanitizeText(text) {
    if (!text) return "";
    
    // Strip null bytes and control/non-printable character sequences (ASCII 0-8, 11-12, 14-31, 127)
    let cleaned = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
    cleaned = cleaned.replace(/\0/g, "");

    // Strip HTML/Script Tag injections
    cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
    cleaned = cleaned.replace(/<[^>]*>/g, "");

    // Normalize whitespaces, tabs, and duplicate line breaks
    cleaned = cleaned.replace(/[ \t]+/g, " ");
    cleaned = cleaned.replace(/\n\s*\n+/g, "\n\n");

    return cleaned.trim();
}

/**
 * Evaluates parser quality based on text characteristics, returning a score from 0 to 100.
 */
function calculateConfidenceScore(text) {
    if (!text || text.trim().length === 0) return 0;

    const totalChars = text.length;
    const nonWhitespaceChars = text.replace(/\s/g, "").length;
    if (nonWhitespaceChars === 0) return 0;

    const alphabeticChars = (text.match(/[a-zA-Z]/g) || []).length;
    const numericChars = (text.match(/[0-9]/g) || []).length;

    // A valid resume should consist mostly of letters (with some numbers/symbols).
    // If letters represent a high percentage of the non-whitespace characters, it's highly readable.
    let baseScore = (alphabeticChars / nonWhitespaceChars) * 100;

    // Check for standard English words or common resume sections to boost confidence
    const keywords = ["experience", "education", "skills", "projects", "work", "university", "college", "summary", "profile", "technologies"];
    let matchCount = 0;
    const lowerText = text.toLowerCase();
    keywords.forEach(kw => {
        if (lowerText.includes(kw)) matchCount++;
    });

    // Add dictionary boost (up to 15 points)
    const boost = (matchCount / keywords.length) * 15;
    let finalScore = Math.min(100, Math.round(baseScore + boost));

    // Heavy penalty if average word length is abnormally long (indicating garbled binary text mapping)
    const words = text.split(/\s+/).filter(w => w.length > 0);
    if (words.length > 0) {
        const avgWordLen = totalChars / words.length;
        if (avgWordLen > 15 || avgWordLen < 3) {
            finalScore = Math.max(0, finalScore - 30);
        }
    }

    return finalScore;
}

/**
 * Service to parse, validate, segment, and sanitize uploaded resumes.
 */
async function parseResume(file) {
    validateFile(file);

    const startTime = performance.now();
    const ext = path.extname(file.originalname).toLowerCase();

    let fullText = "";
    let pageCount = 1;
    let pagesData = [];
    let warnings = [];

    if (ext === ".pdf") {
        try {
            const parser = new pdfParse.PDFParse(Uint8Array.from(file.buffer));
            const parsed = await parser.getText();

            fullText = parsed.text || "";
            pageCount = parsed.total || 1;
            
            // Map individual page texts
            if (parsed.pages && Array.isArray(parsed.pages)) {
                pagesData = parsed.pages.map(p => ({
                    pageNum: p.num,
                    text: sanitizeText(p.text || "")
                }));
            } else {
                pagesData = [{ pageNum: 1, text: sanitizeText(fullText) }];
            }

            // Scanned PDF detection (Multi-Signal)
            const cleanedText = sanitizeText(fullText);
            const charCount = cleanedText.length;
            const wordCount = cleanedText.split(/\s+/).filter(Boolean).length;
            const alphabeticCount = (cleanedText.match(/[a-zA-Z]/g) || []).length;

            const textDensity = charCount / file.size; // characters per byte
            const wordsPerPage = wordCount / pageCount;
            const alphabeticRatio = charCount > 0 ? (alphabeticCount / charCount) : 0;

            const signals = {
                lowTextDensity: textDensity < 0.05,
                lowWordDensity: wordsPerPage < 30,
                lowAlphabeticRatio: alphabeticRatio < 0.6
            };

            // Trigger scanner exception if multiple indicators are flagged
            const flaggedSignals = Object.values(signals).filter(Boolean).length;
            if (flaggedSignals >= 2) {
                throw new Error("This resume appears to be image-based or scanned. Please upload a searchable PDF exported from Microsoft Word or Google Docs.");
            }

        } catch (err) {
            logger.error("PDF extraction error inside parser service:", err);
            
            if (err.message.includes("image-based") || err.message.includes("scanned")) {
                throw err;
            }

            const isEncrypted = err.name === "PasswordException" || 
                                err.message.includes("password") || 
                                err.message.includes("decrypt") || 
                                err.message.includes("encrypt");
            if (isEncrypted) {
                throw new Error("This PDF document is encrypted or password-protected. Please upload an unlocked PDF.");
            }

            throw new Error("Uploaded PDF is corrupted or malformed. Please export a valid PDF file.");
        }
    } else if (ext === ".docx") {
        try {
            const result = await mammoth.extractRawText({ buffer: file.buffer });
            fullText = result.value || "";
            pageCount = 1;
            pagesData = [{ pageNum: 1, text: sanitizeText(fullText) }];

            if (!fullText.trim()) {
                throw new Error("This document contains no readable text.");
            }
        } catch (err) {
            logger.error("DOCX extraction error inside parser service:", err);
            if (err.message.includes("contains no readable text")) {
                throw err;
            }
            throw new Error("Uploaded Word document is corrupted or malformed. Please save a valid DOCX file.");
        }
    }

    const sanitizedFullText = sanitizeText(fullText);
    if (sanitizedFullText.length < 200) {
        throw new Error("No sufficient readable text was detected. Please make sure the document is searchable and contains text.");
    }

    // Extraction Quality checks & Warnings
    const confidenceScore = calculateConfidenceScore(sanitizedFullText);
    if (confidenceScore < 60) {
        warnings.push("Low extraction readability score. Please check formatting.");
    }

    const lowerText = sanitizedFullText.toLowerCase();
    const essentialSections = ["experience", "education", "skills"];
    essentialSections.forEach(sec => {
        if (!lowerText.includes(sec)) {
            warnings.push(`Missing typical resume keywords: "${sec}"`);
        }
    });

    if (pageCount > 10) {
        warnings.push("Document has more than 10 pages; might not be a standard resume.");
    }

    const duration = Math.round(performance.now() - startTime);

    return {
        text: sanitizedFullText,
        pages: pagesData,
        diagnostics: {
            fileSize: file.size,
            pageCount,
            characterCount: sanitizedFullText.length,
            parsingDuration: duration,
            confidenceScore,
            warnings
        }
    };
}

module.exports = {
    parseResume
};
