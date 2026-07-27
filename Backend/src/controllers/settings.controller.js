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
        const userId = req.user.id || req.user._id;

        // Check if username is taken by another user
        if (username) {
            const existingUsername = await userModel.findOne({ username, _id: { $ne: userId } });
            if (existingUsername) {
                return res.status(400).json({ success: false, message: "Username is already taken by another user." });
            }
        }

        // Check if email is registered to another user
        if (email) {
            const existingEmail = await userModel.findOne({ email, _id: { $ne: userId } });
            if (existingEmail) {
                return res.status(400).json({ success: false, message: "Email address is already in use by another account." });
            }
        }

        const updates = {};
        if (username) updates.username = username;
        if (email) updates.email = email;
        if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;

        const user = await userModel.findByIdAndUpdate(userId, updates, { new: true, runValidators: true }).select("username email avatarUrl createdAt");

        if (!user) {
            return res.status(404).json({ success: false, message: "User account not found." });
        }

        await logSecurityActivity(userId, "Profile Updated", req);

        return res.status(200).json({ success: true, message: "Profile updated successfully.", profile: user });
    } catch (error) {
        if (error.code === 11000) {
            const field = Object.keys(error.keyValue || {})[0] || "field";
            return res.status(400).json({
                success: false,
                message: `This ${field} is already in use by another account.`
            });
        }
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
        const userId = req.user.id || req.user._id;
        const user = await userModel.findById(userId).select("refreshSessions securityActivity");
        
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        const devices = (user.refreshSessions || []).map(s => ({
            _id: s._id,
            sessionId: s.sessionId,
            browser: s.browser || "Unknown Browser",
            os: s.os || "Unknown OS",
            deviceType: s.deviceType || "Desktop",
            ip: s.ip || "127.0.0.1",
            lastActivity: s.lastActivity || s.loginAt,
            isCurrentDevice: Boolean(s.sessionId === req.user.sessionId)
        }));

        return res.status(200).json({
            success: true,
            security: {
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
        const userId = req.user.id || req.user._id;

        // Pull session matching _id or sessionId
        await userModel.findByIdAndUpdate(userId, {
            $pull: { refreshSessions: { $or: [{ _id: id }, { sessionId: id }] } }
        });
        
        await logSecurityActivity(userId, "Device Signed Out", req);
        
        // If revoking current active device, clear cookies
        const isCurrent = (id === req.user.sessionId);
        if (isCurrent) {
            res.clearCookie("token");
            res.clearCookie("csrfToken");
        }

        return res.status(200).json({
            success: true,
            message: "Device revoked successfully.",
            isCurrentDevice: isCurrent
        });
    } catch (error) {
        next(error);
    }
}

async function revokeAllDevicesController(req, res, next) {
    try {
        const userId = req.user.id || req.user._id;
        const currentSessionId = req.user.sessionId;
        
        // Retain only current active session
        if (currentSessionId) {
            await userModel.findByIdAndUpdate(userId, {
                $pull: { refreshSessions: { sessionId: { $ne: currentSessionId } } }
            });
        } else {
            await userModel.findByIdAndUpdate(userId, {
                $set: { refreshSessions: [] }
            });
        }
        
        await logSecurityActivity(userId, "All Other Devices Signed Out", req);
        
        return res.status(200).json({ success: true, message: "All other devices signed out successfully." });
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
