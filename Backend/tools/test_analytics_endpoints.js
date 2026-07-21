require("dotenv").config({ path: ".env" });
const mongoose = require("mongoose");
const request = require("supertest");
const express = require("express");

// Import routers
const atsRouter = require("./src/routes/ats.routes");
const interviewRouter = require("./src/routes/interview.routes");
const codeRouter = require("./src/routes/code.routes");
const voiceRouter = require("./src/routes/voiceSession.routes");
const githubRouter = require("./src/routes/repositoryInterview.routes");

// Mock auth middleware for testing
jest.mock("./src/middlewares/auth.middleware", () => ({
    authUser: (req, res, next) => {
        req.user = { id: new mongoose.Types.ObjectId().toString() };
        next();
    },
    csrfProtection: (req, res, next) => next(),
    aiLimiter: (req, res, next) => next(),
    executionLimiter: (req, res, next) => next()
}));

const dbUrl = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/careerprep";

async function run() {
    await mongoose.connect(dbUrl);
    console.log("Connected to MongoDB.");

    const app = express();
    app.use(express.json());
    
    // Mount routes
    app.use("/api/ats", atsRouter);
    app.use("/api/interview", interviewRouter);
    app.use("/api/code", codeRouter);
    app.use("/api/voice-session", voiceRouter);
    app.use("/api/github-defense", githubRouter);

    const endpoints = [
        "/api/ats",
        "/api/interview",
        "/api/code/progress",
        "/api/voice-session/progress",
        "/api/github-defense/progress"
    ];

    console.log("\n======================================================");
    console.log("Auditing Analytics API Endpoints...");
    console.log("======================================================\n");

    for (const endpoint of endpoints) {
        try {
            const res = await request(app).get(endpoint);
            console.log(`[GET] ${endpoint} -> Status: ${res.statusCode}`);
            if (res.statusCode !== 200) {
                console.error(`  Error Response: ${JSON.stringify(res.body)}`);
            } else {
                console.log(`  Success! Keys returned: ${Object.keys(res.body).join(", ")}`);
            }
        } catch (err) {
            console.error(`[GET] ${endpoint} -> FAILED: ${err.message}`);
        }
    }

    await mongoose.disconnect();
}

run();
