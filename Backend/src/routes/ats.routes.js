const express = require("express")
const authMiddleware = require("../middlewares/auth.middleware")
const atsController = require("../controllers/ats.controller")
const upload = require("../middlewares/file.middleware")

const atsRouter = express.Router()

/**
 * @route POST /api/ats/analyze
 * @description generate new ATS report on the basis of resume pdf and job description.
 * @access private
 */
atsRouter.post("/analyze", authMiddleware.authUser, authMiddleware.csrfProtection, authMiddleware.aiLimiter, upload.single("resume"), atsController.analyzeAtsController)

/**
 * @route GET /api/ats/
 * @description get all ATS reports of the logged-in user.
 * @access private
 */
atsRouter.get("/", authMiddleware.authUser, atsController.getAllAtsReportsController)

/**
 * @route GET /api/ats/report/:atsId
 * @description get a specific ATS report by ID.
 * @access private
 */
atsRouter.get("/report/:atsId", authMiddleware.authUser, atsController.getAtsReportByIdController)



/**
 * @route DELETE /api/ats/report/:atsId
 * @description delete an ATS report by atsId.
 * @access private
 */
atsRouter.delete("/report/:atsId", authMiddleware.authUser, authMiddleware.csrfProtection, atsController.deleteAtsReportController)
atsRouter.delete("/:atsId", authMiddleware.authUser, authMiddleware.csrfProtection, atsController.deleteAtsReportController)

module.exports = atsRouter
