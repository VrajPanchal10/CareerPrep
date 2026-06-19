require("dotenv").config();
const { generateAtsReport } = require("./src/services/ai.service");
const { resume, jobDescription } = require("./src/services/temp");

async function test() {
    try {
        console.log("Calling Gemini for ATS Match Analysis...");
        const result = await generateAtsReport({
            resume: resume(),
            jobDescription: jobDescription()
        });
        console.log("Structured ATS result returned from Gemini successfully!");
        console.log(JSON.stringify(result, null, 2));
    } catch (err) {
        console.error("ATS generation failed:", err);
    }
}

test();
