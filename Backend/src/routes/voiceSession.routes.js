const express = require("express");
const router = express.Router();
const multer = require("multer");
const voiceController = require("../controllers/voiceSession.controller");
const { authUser, aiLimiter, csrfProtection } = require("../middlewares/auth.middleware");

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const ALLOWED_MIMETYPES = [
            "audio/webm",
            "audio/wav",
            "audio/ogg",
            "audio/mpeg",
            "audio/mp4",
            "audio/x-m4a",
            "video/webm" // Some browsers encode MediaRecorder audio as video/webm
        ];
        if (ALLOWED_MIMETYPES.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Invalid file type '${file.mimetype}'. Only audio files are accepted.`), false);
        }
    }
});

// All voice mock session routes are protected
router.use(authUser);

// Speech & Voice Actions — aiLimiter prevents Sarvam API quota abuse
router.post("/transcribe", aiLimiter, upload.single("file"), voiceController.transcribeAudio);
router.post("/speak", aiLimiter, voiceController.textToSpeech);

// Session Actions
router.post("/", csrfProtection, voiceController.startSession);
router.post("/evaluate", csrfProtection, aiLimiter, voiceController.submitAnswer);
router.post("/:id/complete", csrfProtection, aiLimiter, voiceController.completeSession);

// Dashboard Progress & Stats Lookup
router.get("/progress", voiceController.getProgressStats);
router.get("/:id", voiceController.getSessionById);
router.get("/", voiceController.getSessions);

module.exports = router;
