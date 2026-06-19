const express = require("express");
const router = express.Router();
const voiceController = require("../controllers/voiceSession.controller");
const { authUser, aiLimiter, csrfProtection } = require("../middlewares/auth.middleware");

// All voice mock session routes are protected
router.use(authUser);

// Session Actions
router.post("/", csrfProtection, voiceController.startSession);
router.post("/evaluate", csrfProtection, aiLimiter, voiceController.submitAnswer);
router.post("/:id/complete", csrfProtection, aiLimiter, voiceController.completeSession);

// Dashboard Progress & Stats Lookup
router.get("/progress", voiceController.getProgressStats);
router.get("/:id", voiceController.getSessionById);
router.get("/", voiceController.getSessions);

module.exports = router;
