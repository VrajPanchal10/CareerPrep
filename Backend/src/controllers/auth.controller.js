const userModel = require("../models/user.model")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const tokenBlacklistModel = require("../models/blacklist.model")
const { logSecurityEvent, logger } = require("../utils/securityLogger")
const crypto = require("crypto")
const otplib = require("otplib")
const QRCode = require("qrcode")
const { sendResetPasswordEmail, sendPasswordChangedEmail } = require("../services/auth/email.service")
const { validatePasswordPolicy } = require("../services/auth/passwordReset.service")

/**
 * @name registerUserController
 * @description Register a new user, expects username, email and password in the request body
 * @access Public
 */
async function registerUserController(req, res) {
    const { username, email, password } = req.body

    if (!username || !email || !password) {
        return res.status(400).json({
            message: "Please provide username, email and password"
        })
    }

    if (typeof username !== "string" || typeof email !== "string" || typeof password !== "string") {
        return res.status(400).json({
            message: "Invalid input formats. All fields must be strings."
        })
    }

    const isUserAlreadyExists = await userModel.findOne({
        $or: [ { username }, { email } ]
    })

    if (isUserAlreadyExists) {
        return res.status(400).json({
            message: "Account already exists with this email address or username"
        })
    }

    const hash = await bcrypt.hash(password, 10)

    const user = await userModel.create({
        username,
        email,
        password: hash
    })

    const sessionId = crypto.randomUUID();
    user.refreshSessions.push({
        token: sessionId,
        deviceInfo: req.headers["user-agent"] || "Generic Web Client",
        lastActivity: new Date()
    });
    user.sessionMetadata = {
        lastLogin: new Date(),
        lastActivity: new Date()
    };
    await user.save();

    const token = jwt.sign(
        { id: user._id, username: user.username, sessionId },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
    )

    res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        maxAge: 24 * 60 * 60 * 1000 // 1 day
    })

    const csrfToken = crypto.randomBytes(32).toString("hex");
    res.cookie("csrfToken", csrfToken, {
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        maxAge: 24 * 60 * 60 * 1000 // 1 day
    })

    res.status(201).json({
        message: "User registered successfully",
        user: {
            id: user._id,
            username: user.username,
            email: user.email
        }
    })
}

/**
 * @name loginUserController
 * @description Login a user, expects email and password in the request body
 * @access Public
 */
async function loginUserController(req, res) {
    const { email, password, rememberMe } = req.body

    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
        return res.status(400).json({
            message: "Invalid email or password format"
        })
    }

    const user = await userModel.findOne({ email })
    const clientIp = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress

    if (!user) {
        logSecurityEvent({
            eventType: "FAILED_LOGIN",
            ip: clientIp,
            details: { email, message: `Failed login attempt for non-existent email.` }
        });
        return res.status(400).json({
            message: "Invalid email or password"
        })
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
        logSecurityEvent({
            eventType: "FAILED_LOGIN",
            ip: clientIp,
            details: { email, message: `Failed login attempt (incorrect password).` }
        });
        return res.status(400).json({
            message: "Invalid email or password"
        })
    }

    // Intercept flow if MFA is active on account
    if (user.mfaEnabled) {
        const mfaToken = jwt.sign(
            { id: user._id, type: "mfa", rememberMe: !!rememberMe },
            process.env.JWT_SECRET,
            { expiresIn: "5m" }
        );
        return res.status(200).json({
            success: true,
            mfaRequired: true,
            mfaToken
        });
    }

    // Generate unique session and sign JWT
    const sessionId = crypto.randomUUID();
    user.refreshSessions.push({
        token: sessionId,
        deviceInfo: req.headers["user-agent"] || "Generic Web Client",
        lastActivity: new Date()
    });
    user.sessionMetadata = {
        lastLogin: new Date(),
        lastActivity: new Date()
    };
    await user.save();

    const token = jwt.sign(
        { id: user._id, username: user.username, sessionId, rememberMe: !!rememberMe },
        process.env.JWT_SECRET,
        { expiresIn: rememberMe ? "7d" : "1d" }
    )

    const cookieOpts = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"
    }
    if (rememberMe) {
        cookieOpts.maxAge = 7 * 24 * 60 * 60 * 1000;
    }
    res.cookie("token", token, cookieOpts)

    const csrfToken = crypto.randomBytes(32).toString("hex");
    const csrfCookieOpts = {
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"
    }
    if (rememberMe) {
        csrfCookieOpts.maxAge = 7 * 24 * 60 * 60 * 1000;
    } else {
        csrfCookieOpts.maxAge = 24 * 60 * 60 * 1000; // 1 day
    }
    res.cookie("csrfToken", csrfToken, csrfCookieOpts)
    
    logger.info("User logged in", { userId: user._id, username: user.username })

    res.status(200).json({
        message: "User loggedIn successfully.",
        user: {
            id: user._id,
            username: user.username,
            email: user.email
        }
    })
}

/**
 * @name logoutUserController
 * @description Clear token from user cookie and remove the session tracker
 * @access public
 */
async function logoutUserController(req, res) {
    const token = req.cookies.token

    let loggedOutUser = null;
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });
            if (decoded) {
                loggedOutUser = { id: decoded.id, username: decoded.username };
                if (decoded.sessionId) {
                    const user = await userModel.findById(decoded.id);
                    if (user) {
                        user.refreshSessions = user.refreshSessions.filter(s => s.token !== decoded.sessionId);
                        await user.save();
                    }
                }
            }
            await tokenBlacklistModel.create({ token })
        } catch (err) {
            logger.error("Logout session clean failed:", err);
        }
    }

    res.clearCookie("token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"
    })

    if (loggedOutUser) {
        logger.info("User logged out", { userId: loggedOutUser.id, username: loggedOutUser.username })
    } else {
        logger.info("User logged out (no active session)")
    }

    res.status(200).json({
        message: "User logged out successfully"
    })
}

/**
 * @name getMeController
 * @description Get the current logged in user details.
 * @access private
 */
async function getMeController(req, res) {
    const user = await userModel.findById(req.user.id)

    if (!user) {
        return res.status(401).json({
            message: "User session is invalid or user does not exist."
        })
    }

    // Refresh last activity details on matching user records
    if (user.sessionMetadata) {
        user.sessionMetadata.lastActivity = new Date();
        await user.save();
    }

    res.status(200).json({
        message: "User details fetched successfully",
        user: {
            id: user._id,
            username: user.username,
            email: user.email,
            mfaEnabled: user.mfaEnabled,
            sessionMetadata: user.sessionMetadata
        }
    })
}

/**
 * @name refreshTokenController
 * @description Verifies and rotates the user session token.
 */
async function refreshTokenController(req, res) {
    const token = req.cookies?.token
    if (!token) {
        return res.status(401).json({
            message: "No token to refresh."
        })
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true })
        
        const isTokenBlacklisted = await tokenBlacklistModel.findOne({ token })
        if (isTokenBlacklisted) {
            return res.status(401).json({
                message: "Token has been revoked or blacklisted."
            })
        }

        const user = await userModel.findById(decoded.id)
        if (!user) {
            return res.status(401).json({
                message: "User session is invalid or user does not exist."
            })
        }

        // Validate sessionId exists in current sessions list
        const activeSession = user.refreshSessions.find(s => s.token === decoded.sessionId);
        if (!activeSession) {
            return res.status(401).json({
                message: "Invalid or revoked device session."
            });
        }

        // Token Rotation: invalidate the old sessionId and sign a new one
        const newSessionId = crypto.randomUUID();
        user.refreshSessions = user.refreshSessions.filter(s => s.token !== decoded.sessionId);
        user.refreshSessions.push({
            token: newSessionId,
            deviceInfo: req.headers["user-agent"] || "Generic Web Client",
            lastActivity: new Date()
        });
        
        if (user.sessionMetadata) {
            user.sessionMetadata.lastActivity = new Date();
        }
        await user.save();

        const rememberMe = !!decoded.rememberMe
        const newToken = jwt.sign(
            { id: user._id, username: user.username, sessionId: newSessionId, rememberMe },
            process.env.JWT_SECRET,
            { expiresIn: rememberMe ? "7d" : "1d" }
        )

        const refreshCookieOpts = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"
        }
        if (rememberMe) {
            refreshCookieOpts.maxAge = 7 * 24 * 60 * 60 * 1000;
        }
        res.cookie("token", newToken, refreshCookieOpts)

        const csrfToken = crypto.randomBytes(32).toString("hex");
        const csrfCookieOpts = {
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"
        }
        if (rememberMe) {
            csrfCookieOpts.maxAge = 7 * 24 * 60 * 60 * 1000;
        } else {
            csrfCookieOpts.maxAge = 24 * 60 * 60 * 1000;
        }
        res.cookie("csrfToken", csrfToken, csrfCookieOpts)

        res.status(200).json({
            success: true,
            message: "Token refreshed successfully.",
            user: {
                id: user._id,
                username: user.username,
                email: user.email
            }
        })
    } catch (err) {
        logger.error("Error refreshing token:", err)
        return res.status(401).json({
            message: "Invalid token."
        })
    }
}

/**
 * @name forgotPasswordController
 * @description Generates secure token and prints reset link to console/emails to prod
 */
async function forgotPasswordController(req, res) {
    const { email } = req.body;
    if (!email || typeof email !== "string") {
        return res.status(400).json({ success: false, message: "Please provide a valid email." });
    }

    try {
        const user = await userModel.findOne({ email });
        const genericMessage = "If an account exists with that email address, a password reset link has been sent.";

        if (!user) {
            // Enumeration safe response
            return res.status(200).json({ success: true, message: genericMessage });
        }

        const rawToken = crypto.randomBytes(32).toString("hex");
        const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

        user.resetPasswordToken = hashedToken;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour expiry
        await user.save();

        const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password/${rawToken}`;
        await sendResetPasswordEmail(user.email, resetUrl, user.username);

        logger.info("Password reset requested", { email });

        return res.status(200).json({ success: true, message: genericMessage });
    } catch (err) {
        logger.error("Forgot password flow failed", { error: err.message || err });
        return res.status(500).json({ success: false, message: "An unexpected error occurred." });
    }
}

/**
 * @name resetPasswordController
 * @description Resets the user's password after validating token and policy
 */
async function validateResetTokenController(req, res) {
    const { token } = req.params;
    if (!token) {
        return res.status(400).json({ success: false, message: "Token parameter is required." });
    }

    // SHA-256 token hashes are 64 hex characters (32 bytes raw)
    const isHex64 = /^[0-9a-fA-F]{64}$/.test(token);
    if (!isHex64) {
        return res.status(400).json({ success: false, errorType: "INVALID", message: "Invalid reset link." });
    }

    try {
        const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
        const user = await userModel.findOne({ resetPasswordToken: hashedToken });

        if (!user) {
            return res.status(400).json({
                success: false,
                errorType: "USED",
                message: "This reset link has already been used. Request another reset email."
            });
        }

        if (user.resetPasswordExpires <= Date.now()) {
            return res.status(400).json({
                success: false,
                errorType: "EXPIRED",
                message: "Reset link expired."
            });
        }

        return res.status(200).json({ success: true, message: "Token is valid." });
    } catch (err) {
        logger.error("Validate reset token failed:", err);
        return res.status(500).json({ success: false, message: "An unexpected error occurred." });
    }
}

async function resetPasswordController(req, res) {
    const { token, password } = req.body;
    if (!token || !password) {
        return res.status(400).json({ success: false, message: "Token and password are required." });
    }

    const policy = validatePasswordPolicy(password);
    if (!policy.isValid) {
        return res.status(400).json({ success: false, message: policy.message });
    }

    try {
        const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
        const user = await userModel.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ success: false, message: "Token is invalid, expired, or already used." });
        }

        // Security check: New password cannot match current password
        const isSamePassword = await bcrypt.compare(password, user.password);
        if (isSamePassword) {
            return res.status(400).json({ success: false, message: "Please choose a different password." });
        }

        // Update password and invalidate reset token
        user.password = await bcrypt.hash(password, 10);
        user.resetPasswordToken = null;
        user.resetPasswordExpires = null;
        
        // Revoke all active device/browser sessions
        user.refreshSessions = [];
        await user.save();

        // Send security email
        const clientIp = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;
        const userAgent = req.headers["user-agent"] || "Unknown";
        try {
            await sendPasswordChangedEmail(user.email, {
                time: new Date().toUTCString(),
                browser: userAgent,
                ip: clientIp,
                location: null
            });
        } catch (emailErr) {
            logger.error("Failed to dispatch password changed security notification:", { error: emailErr.message || emailErr });
        }

        logger.info("Password changed successfully", { userId: user._id, email: user.email });

        return res.status(200).json({ success: true, message: "Password updated successfully. Please login." });
    } catch (err) {
        logger.error("Reset password failed:", { error: err.message || err });
        return res.status(500).json({ success: false, message: "An unexpected error occurred." });
    }
}

/**
 * @name enableMfaController
 * @description Generates a secret key and a QR code data URI
 */
/**
 * @name enableMfaController
 * @description Generates a secret key and a QR code data URI
 */
async function enableMfaController(req, res) {
    try {
        const user = await userModel.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        if (user.mfaEnabled) {
            return res.status(400).json({ success: false, message: "MFA is already enabled on this account." });
        }

        const secret = otplib.generateSecret();
        const otpauth = otplib.generateURI({ secret, label: user.email, issuer: "CareerPrep" });
        const qrCodeUrl = await QRCode.toDataURL(otpauth);

        // Keep secret saved but mfaEnabled false until verified
        user.mfaSecret = secret;
        await user.save();

        return res.status(200).json({
            success: true,
            secret,
            qrCode: qrCodeUrl
        });
    } catch (err) {
        logger.error("Enable MFA failed:", err);
        return res.status(500).json({ success: false, message: "MFA setup failed." });
    }
}

/**
 * @name confirmMfaController
 * @description Confirms the verification code and creates hashed recovery codes
 */
async function confirmMfaController(req, res) {
    const { code } = req.body;
    if (!code) {
        return res.status(400).json({ success: false, message: "Please provide a code." });
    }

    try {
        const user = await userModel.findById(req.user.id);
        if (!user || !user.mfaSecret) {
            return res.status(400).json({ success: false, message: "MFA setup has not been initialized." });
        }

        const isValidObj = await otplib.verify({ token: code, secret: user.mfaSecret });
        const isValid = isValidObj.valid;
        if (!isValid) {
            return res.status(400).json({ success: false, message: "Verification code is invalid." });
        }

        // Generate 8 random recovery codes, hash them, and send raw codes once
        const rawRecoveryCodes = [];
        const hashedRecoveryCodes = [];
        for (let i = 0; i < 8; i++) {
            const rawCode = crypto.randomBytes(5).toString("hex"); // 10 chars
            rawRecoveryCodes.push(rawCode);
            const hashed = await bcrypt.hash(rawCode, 8);
            hashedRecoveryCodes.push(hashed);
        }

        user.mfaEnabled = true;
        user.mfaRecoveryCodes = hashedRecoveryCodes;
        user.mfaFailedAttempts = 0;
        user.mfaLockoutUntil = null;
        await user.save();

        return res.status(200).json({
            success: true,
            message: "MFA configured successfully.",
            recoveryCodes: rawRecoveryCodes
        });
    } catch (err) {
        logger.error("Confirm MFA failed:", err);
        return res.status(500).json({ success: false, message: "MFA confirmation failed." });
    }
}

/**
 * @name disableMfaController
 * @description Disables MFA on the account
 */
async function disableMfaController(req, res) {
    try {
        const user = await userModel.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        user.mfaEnabled = false;
        user.mfaSecret = null;
        user.mfaRecoveryCodes = [];
        user.mfaFailedAttempts = 0;
        user.mfaLockoutUntil = null;
        await user.save();

        return res.status(200).json({ success: true, message: "MFA disabled successfully." });
    } catch (err) {
        logger.error("Disable MFA failed:", err);
        return res.status(500).json({ success: false, message: "Failed to disable MFA." });
    }
}

/**
 * @name verifyMfaController
 * @description Verifies code against TOTP or recovery codes with rate limiting lockouts
 */
async function verifyMfaController(req, res) {
    const { mfaToken, code } = req.body;
    if (!mfaToken || !code) {
        return res.status(400).json({ success: false, message: "MFA token and verification code are required." });
    }

    try {
        const decoded = jwt.verify(mfaToken, process.env.JWT_SECRET);
        if (decoded.type !== "mfa") {
            return res.status(400).json({ success: false, message: "Invalid MFA verification token." });
        }

        const user = await userModel.findById(decoded.id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User profile not found." });
        }

        // Rate Limit / Lockout check (5 failed attempts block)
        if (user.mfaLockoutUntil && user.mfaLockoutUntil > Date.now()) {
            const minutesLeft = Math.ceil((user.mfaLockoutUntil - Date.now()) / 60000);
            return res.status(403).json({
                success: false,
                message: `Account locked out due to too many failed MFA attempts. Try again in ${minutesLeft} minutes.`
            });
        }

        let isCodeValid = false;
        let matchedRecoveryIndex = -1;

        // 1. Verify TOTP authenticator code
        if (code.length === 6 && /^\d+$/.test(code)) {
            const isValidObj = await otplib.verify({ token: code, secret: user.mfaSecret });
            isCodeValid = isValidObj.valid;
        }

        // 2. Fallback: verify against hashed recovery codes
        if (!isCodeValid && user.mfaRecoveryCodes.length > 0) {
            for (let i = 0; i < user.mfaRecoveryCodes.length; i++) {
                const match = await bcrypt.compare(code, user.mfaRecoveryCodes[i]);
                if (match) {
                    isCodeValid = true;
                    matchedRecoveryIndex = i;
                    break;
                }
            }
        }

        if (!isCodeValid) {
            user.mfaFailedAttempts = (user.mfaFailedAttempts || 0) + 1;
            const isLockoutTriggered = user.mfaFailedAttempts >= 5;
            if (isLockoutTriggered) {
                user.mfaLockoutUntil = Date.now() + 15 * 60 * 1000; // 15 min lock
                logSecurityEvent({
                    eventType: "MFA_LOCKOUT",
                    ip: req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress,
                    details: { userId: user._id, message: "User locked out due to 5 consecutive MFA verification failures." }
                });
            }
            await user.save();

            if (isLockoutTriggered) {
                return res.status(403).json({
                    success: false,
                    message: "Account locked out due to too many failed MFA attempts. Try again in 15 minutes."
                });
            }

            const remaining = 5 - user.mfaFailedAttempts;
            return res.status(400).json({
                success: false,
                message: `Invalid verification code. ${remaining} attempts remaining before lockout.`
            });
        }

        // Code matches: reset lockout counters
        user.mfaFailedAttempts = 0;
        user.mfaLockoutUntil = null;

        // Invalidate recovery code if one was utilized
        if (matchedRecoveryIndex > -1) {
            user.mfaRecoveryCodes.splice(matchedRecoveryIndex, 1);
        }

        // Standard Session login sequence
        const sessionId = crypto.randomUUID();
        user.refreshSessions.push({
            token: sessionId,
            deviceInfo: req.headers["user-agent"] || "Generic Web Client",
            lastActivity: new Date()
        });
        user.sessionMetadata = {
            lastLogin: new Date(),
            lastActivity: new Date()
        };
        await user.save();

        const rememberMe = !!decoded.rememberMe;
        const token = jwt.sign(
            { id: user._id, username: user.username, sessionId, rememberMe },
            process.env.JWT_SECRET,
            { expiresIn: rememberMe ? "7d" : "1d" }
        );

        const cookieOpts = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"
        };
        if (rememberMe) {
            cookieOpts.maxAge = 7 * 24 * 60 * 60 * 1000;
        }
        res.cookie("token", token, cookieOpts);

        const csrfToken = crypto.randomBytes(32).toString("hex");
        const csrfCookieOpts = {
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"
        };
        if (rememberMe) {
            csrfCookieOpts.maxAge = 7 * 24 * 60 * 60 * 1000;
        } else {
            csrfCookieOpts.maxAge = 24 * 60 * 60 * 1000;
        }
        res.cookie("csrfToken", csrfToken, csrfCookieOpts);

        logger.info("User logged in", { userId: user._id, username: user.username, mfa: true })

        return res.status(200).json({
            message: "MFA code verification successful.",
            user: {
                id: user._id,
                username: user.username,
                email: user.email
            }
        });
    } catch (err) {
        logger.error("MFA Verify code handler error:", err);
        return res.status(400).json({ success: false, message: "MFA validation session expired or invalid." });
    }
}

module.exports = {
    registerUserController,
    loginUserController,
    logoutUserController,
    getMeController,
    refreshTokenController,
    forgotPasswordController,
    resetPasswordController,
    validateResetTokenController,
    enableMfaController,
    confirmMfaController,
    disableMfaController,
    verifyMfaController
}