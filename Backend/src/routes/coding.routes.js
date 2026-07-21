const express = require("express");
const router = express.Router();
const codingController = require("../controllers/coding.controller");
const { authUser, aiLimiter, executionLimiter, csrfProtection } = require("../middlewares/auth.middleware");

// ─── Public (auth not required) ───────────────────────────────────────────────
// Health check is intentionally public — frontend needs it without login
router.get("/health", codingController.getEngineHealth);
router.get("/languages", codingController.getSupportedLanguagesList);

// ─── Authenticated Routes ─────────────────────────────────────────────────────
router.use(authUser);

// Coding Questions
router.get("/questions",              codingController.getQuestions);
router.get("/questions/:id",          codingController.getQuestionById);
router.get("/questions/:id/testcases", codingController.getTestCases);
router.post("/questions/generate",    csrfProtection, aiLimiter, codingController.generateCustomQuestion);

// Code Execution
router.post("/submit",  csrfProtection, executionLimiter, codingController.submitCode);   // Full evaluation
router.post("/run",     csrfProtection, executionLimiter, codingController.runCode);       // Custom input run (no submission)

// Submission History
router.get("/submissions", codingController.getSubmissions);

// Progress & Analytics Dashboard
router.get("/progress", codingController.getUserProgress);

module.exports = router;
