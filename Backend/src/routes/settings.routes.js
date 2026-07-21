const express = require("express");
const { authUser } = require("../middlewares/auth.middleware");
const {
    getProfileController,
    updateProfileController,
    updatePasswordController,
    getSecurityController,
    revokeDeviceController,
    revokeAllDevicesController,
    deleteAccountController
} = require("../controllers/settings.controller");

const router = express.Router();

// Apply auth middleware to all settings routes
router.use(authUser);

// Profile
router.get("/profile", getProfileController);
router.put("/profile", updateProfileController);
router.post("/delete-account", deleteAccountController); // Moved here as part of Profile Danger Zone

// Password
router.put("/password", updatePasswordController);

// Security & Devices
router.get("/security", getSecurityController);
router.delete("/device/:id", revokeDeviceController);
router.delete("/devices", revokeAllDevicesController);

module.exports = router;
