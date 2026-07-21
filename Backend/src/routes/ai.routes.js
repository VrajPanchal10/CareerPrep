const express = require("express");
const router = express.Router();
const gateway = require("../services/aiGateway.service");

/**
 * @route GET /api/ai/status
 * @description Query the status and circuit breaker configuration metrics of all providers.
 */
router.get("/status", (req, res) => {
    try {
        const health = gateway.getHealthStatus();
        return res.status(200).json({
            success: true,
            health
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch AI gateway health status",
            error: err.message
        });
    }
});

module.exports = router;
