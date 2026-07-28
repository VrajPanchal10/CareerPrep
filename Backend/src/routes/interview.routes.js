const express = require("express")
const authMiddleware = require("../middlewares/auth.middleware")
const interviewController = require("../controllers/interview.controller")
const sessionController = require("../controllers/interviewSession.controller")
const upload = require("../middlewares/file.middleware")

const interviewRouter = express.Router()

/**
 * @route POST /api/interview/
 * @description generate new interview report on the basis of user self description,resume pdf and job description.
 * @access private
 */
interviewRouter.post("/", authMiddleware.authUser, authMiddleware.csrfProtection, authMiddleware.aiLimiter, upload.single("resume"), interviewController.generateInterViewReportController)

/**
 * @route GET /api/interview/report/:interviewId
 * @description get interview report by interviewId.
 * @access private
 */
interviewRouter.get("/report/:interviewId", authMiddleware.authUser, interviewController.getInterviewReportByIdController)

/**
 * @route DELETE /api/interview/report/:interviewId
 * @description delete an interview report by interviewId.
 * @access private
 */
interviewRouter.delete("/report/:interviewId", authMiddleware.authUser, authMiddleware.csrfProtection, interviewController.deleteInterviewReportController)
interviewRouter.delete("/:interviewId", authMiddleware.authUser, authMiddleware.csrfProtection, interviewController.deleteInterviewReportController)

/**
 * @route GET /api/interview/
 * @description get all interview reports of logged in user.
 * @access private
 */
interviewRouter.get("/", authMiddleware.authUser, interviewController.getAllInterviewReportsController)

/**
 * @route GET /api/interview/resume/pdf
 * @description generate resume pdf on the basis of user self description, resume content and job description.
 * @access private
 */
interviewRouter.post("/resume/pdf/:interviewReportId", authMiddleware.authUser, authMiddleware.csrfProtection, authMiddleware.aiLimiter, interviewController.generateResumePdfController)

/* --- MOCK INTERVIEW SESSIONS & EVALUATIONS --- */

/**
 * @route POST /api/interview/session
 * @description start a new practice session for a report.
 * @access private
 */
interviewRouter.post("/session", authMiddleware.authUser, authMiddleware.csrfProtection, sessionController.startSessionController)

/**
 * @route POST /api/interview/session/:sessionId/complete
 * @description complete mock session and compile statistics.
 * @access private
 */
interviewRouter.post("/session/:sessionId/complete", authMiddleware.authUser, authMiddleware.csrfProtection, authMiddleware.aiLimiter, sessionController.completeSessionController)

/**
 * @route GET /api/interview/session/:sessionId
 * @description fetch details of a specific session.
 * @access private
 */
interviewRouter.get("/session/:sessionId", authMiddleware.authUser, sessionController.getSessionByIdController)

/**
 * @route GET /api/interview/sessions
 * @description fetch all sessions of logged in user.
 * @access private
 */
interviewRouter.get("/sessions", authMiddleware.authUser, sessionController.getAllSessionsController)

/**
 * @route POST /api/interview/evaluate-answer
 * @description evaluate answer to specific question.
 * @access private
 */
interviewRouter.post("/evaluate-answer", authMiddleware.authUser, authMiddleware.csrfProtection, authMiddleware.aiLimiter, sessionController.evaluateAnswerController)

/**
 * @route GET /api/interview/heatmap/:id
 * @description fetch heatmap data for completed session.
 * @access private
 */
interviewRouter.get("/heatmap/:id", authMiddleware.authUser, sessionController.getHeatmapController)

/**
 * @route GET /api/interview/topic-breakdown/:id
 * @description fetch topic breakdown scores for completed session.
 * @access private
 */
interviewRouter.get("/topic-breakdown/:id", authMiddleware.authUser, sessionController.getTopicBreakdownController)

/**
 * @route GET /api/interview/progress/:id
 * @description fetch historical progression snapshots of completed sessions for a report.
 * @access private
 */
interviewRouter.get("/progress/:id", authMiddleware.authUser, sessionController.getProgressController)

/**
 * @route GET /api/interview/study-plan/:id
 * @description fetch recommended topics and study roadmaps.
 * @access private
 */
interviewRouter.get("/study-plan/:id", authMiddleware.authUser, sessionController.getStudyPlanController)

/**
 * @route GET /api/interview/report/pdf/:reportId
 * @description download complete PDF performance card report.
 * @access private
 */
interviewRouter.get("/report/pdf/:reportId", authMiddleware.authUser, interviewController.exportPerformancePdfController)

module.exports = interviewRouter
