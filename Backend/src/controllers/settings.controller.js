const userModel = require("../models/user.model");
const atsReportModel = require("../models/atsReport.model");
const interviewReportModel = require("../models/interviewReport.model");
const bcrypt = require("bcryptjs");
const { logger } = require("../utils/securityLogger");

// Helper to log security activity
async function logSecurityActivity(userId, action, req) {
    try {
        const device = req.headers["user-agent"] || "Unknown Device";
        const ip = req.ip || req.connection.remoteAddress || "Unknown IP";
        
        await userModel.findByIdAndUpdate(userId, {
            $push: {
                securityActivity: {
                    $each: [{ action, device, ip, date: new Date() }],
                    $slice: -20, // Keep only last 20 logs
                    $sort: { date: -1 }
                }
            }
        });
    } catch (err) {
        logger.error("Failed to log security activity:", err);
    }
}

async function getProfileController(req, res, next) {
    try {
        const user = await userModel.findById(req.user.id).select("username email avatarUrl createdAt");
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        return res.status(200).json({ success: true, profile: user });
    } catch (error) {
        next(error);
    }
}

async function updateProfileController(req, res, next) {
    try {
        const { username, email, avatarUrl } = req.body;
        
        const updates = {};
        if (username) updates.username = username;
        if (email) updates.email = email;
        if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
        
        const user = await userModel.findByIdAndUpdate(req.user.id, updates, { new: true, runValidators: true }).select("username email avatarUrl createdAt");
        
        await logSecurityActivity(req.user.id, "Profile Updated", req);

        return res.status(200).json({ success: true, message: "Profile updated successfully.", profile: user });
    } catch (error) {
        next(error);
    }
}

async function updatePasswordController(req, res, next) {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: "Current and new passwords are required." });
        }

        const user = await userModel.findById(req.user.id);
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Incorrect current password." });
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();

        await logSecurityActivity(req.user.id, "Password Changed", req);

        return res.status(200).json({ success: true, message: "Password updated successfully." });
    } catch (error) {
        next(error);
    }
}

async function getSecurityController(req, res, next) {
    try {
        const user = await userModel.findById(req.user.id).select("mfaEnabled mfaRecoveryCodes refreshSessions securityActivity");
        
        // Exclude tokens from output for safety
        const devices = (user.refreshSessions || []).map(s => ({
            _id: s._id,
            deviceInfo: s.deviceInfo,
            lastActivity: s.lastActivity
        }));

        return res.status(200).json({
            success: true,
            security: {
                mfaEnabled: user.mfaEnabled,
                recoveryCodesGenerated: user.mfaRecoveryCodes && user.mfaRecoveryCodes.length > 0,
                devices,
                securityActivity: user.securityActivity || []
            }
        });
    } catch (error) {
        next(error);
    }
}

async function revokeDeviceController(req, res, next) {
    try {
        const { id } = req.params;
        await userModel.findByIdAndUpdate(req.user.id, {
            $pull: { refreshSessions: { _id: id } }
        });
        
        await logSecurityActivity(req.user.id, "Device Signed Out", req);
        
        return res.status(200).json({ success: true, message: "Device revoked successfully." });
    } catch (error) {
        next(error);
    }
}

async function revokeAllDevicesController(req, res, next) {
    try {
        const currentToken = req.cookies.refreshToken;
        
        if (currentToken) {
            await userModel.findByIdAndUpdate(req.user.id, {
                $pull: { refreshSessions: { token: { $ne: currentToken } } }
            });
        } else {
            await userModel.findByIdAndUpdate(req.user.id, {
                $set: { refreshSessions: [] }
            });
        }
        
        await logSecurityActivity(req.user.id, "All Other Devices Signed Out", req);
        
        return res.status(200).json({ success: true, message: "All other devices revoked." });
    } catch (error) {
        next(error);
    }
}

async function deleteAccountController(req, res, next) {
    try {
        const { password } = req.body;
        const user = await userModel.findById(req.user.id);
        
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Incorrect password. Cannot delete account." });
        }
        
        await userModel.findByIdAndDelete(req.user.id);
        
        // Clear auth cookies
        res.clearCookie("accessToken");
        res.clearCookie("refreshToken");

        return res.status(200).json({ success: true, message: "Account deleted successfully." });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    getProfileController,
    updateProfileController,
    updatePasswordController,
    getSecurityController,
    revokeDeviceController,
    revokeAllDevicesController,
    deleteAccountController,
    logSecurityActivity // Exported for use in auth routes (e.g., login/mfa events)
};
