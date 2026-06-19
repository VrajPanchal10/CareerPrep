const express = require("express");
const router = express.Router();
const codeController = require("../controllers/code.controller");
const { authUser, aiLimiter } = require("../middlewares/auth.middleware");

// Protect all routes under this module
router.use(authUser);

// Coding Questions
router.get("/questions", codeController.getQuestions);
router.get("/questions/:id", codeController.getQuestionById);
router.post("/questions/generate", aiLimiter, codeController.generateCustomQuestion);

// Code Submissions
router.post("/submit", aiLimiter, codeController.submitCode);
router.get("/submissions", codeController.getSubmissions);

// Progress & Stats Dashboard
router.get("/progress", codeController.getUserProgress);

module.exports = router;
