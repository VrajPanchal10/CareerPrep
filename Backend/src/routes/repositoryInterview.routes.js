const express = require("express");
const authMiddleware = require("../middlewares/auth.middleware");
const {
    analyzeRepositoryController,
    startRepositoryInterviewController,
    submitRepositoryAnswerController,
    completeRepositoryInterviewController,
    getRepositoryDashboardDataController,
    getRepositoryInterviewByIdController
} = require("../controllers/repositoryInterview.controller");

const router = express.Router();

/**
 * @route POST /api/github-defense/analyze
 * @description Analyze public repository. Rate-limited.
 * @access private
 */
router.post("/analyze", authMiddleware.authUser, authMiddleware.csrfProtection, authMiddleware.aiLimiter, analyzeRepositoryController);

/**
 * @route POST /api/github-defense/interview/start
 * @description Start a new Project Defense interview session.
 * @access private
 */
router.post("/interview/start", authMiddleware.authUser, authMiddleware.csrfProtection, authMiddleware.aiLimiter, startRepositoryInterviewController);

/**
 * @route POST /api/github-defense/interview/submit
 * @description Submit candidate response to specific question for evaluation.
 * @access private
 */
router.post("/interview/submit", authMiddleware.authUser, authMiddleware.csrfProtection, authMiddleware.aiLimiter, submitRepositoryAnswerController);

/**
 * @route POST /api/github-defense/interview/:sessionId/complete
 * @description Complete the interview session and calculate mastery scores.
 * @access private
 */
router.post("/interview/:sessionId/complete", authMiddleware.authUser, authMiddleware.csrfProtection, authMiddleware.aiLimiter, completeRepositoryInterviewController);

/**
 * @route GET /api/github-defense/dashboard
 * @description Retrieve user's Git dashboard stats and analyzed repos list.
 * @access private
 */
router.get("/dashboard", authMiddleware.authUser, getRepositoryDashboardDataController);

/**
 * @route GET /api/github-defense/session/:sessionId
 * @description Fetch a specific repository interview session details.
 * @access private
 */
router.get("/session/:sessionId", authMiddleware.authUser, getRepositoryInterviewByIdController);

module.exports = router;
