require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { generateResumePdf } = require("./src/services/ai.service");
const { resume, selfDescription, jobDescription } = require("./src/services/temp");

async function run() {
    try {
        console.log("Generating original resume PDF...");
        const pdfBuffer = await generateResumePdf({
            resume: resume(),
            selfDescription: selfDescription(),
            jobDescription: jobDescription()
        });
        
        const outputPath = path.join(__dirname, "resume_original.pdf");
        fs.writeFileSync(outputPath, pdfBuffer);
        console.log("Original resume PDF saved to:", outputPath);
        
    } catch (err) {
        console.error("PDF generation failed:", err);
    }
}

run();
