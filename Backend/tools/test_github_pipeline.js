require("dotenv").config({ path: ".env" });
const mongoose = require("mongoose");
const { analyzeRepository } = require("./src/services/github/githubRepository.service");
const dbUrl = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/careerprep";

async function run() {
    await mongoose.connect(dbUrl);
    console.log("Connected to MongoDB.");

    const owner = "VrajPanchal10";
    const token = process.env.GITHUB_SYSTEM_TOKEN;
    const userId = new mongoose.Types.ObjectId().toString(); // mock user

    for (const repo of ["Portfolio", "Fomo-Cinema", "College-Event-Attendance-Tracker"]) {
        console.log(`\n======================================================`);
        console.log(`Testing E2E for ${owner}/${repo}...`);
        console.log(`======================================================\n`);
        
        try {
            const result = await analyzeRepository({
                owner,
                repo,
                token,
                source: "user",
                scopes: ["repo", "read:user", "user:email"],
                userId,
                forceAnalysis: true
            });
            
            console.log(`\n[SUCCESS] Analysis complete for ${repo}. Cache: ${result.cached}. ID: ${result.analysis ? result.analysis._id : 'N/A'}`);
            
            if (result.analysis) {
                console.log(`[SUMMARY PREVIEW] ${result.analysis.summary.slice(0, 200)}...`);
            }
        } catch (err) {
            console.error(`\n[ERROR] Analysis failed for ${repo}:`, err.message);
        }
    }
    
    await mongoose.disconnect();
}

run();
