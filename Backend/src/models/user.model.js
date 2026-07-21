const mongoose = require("mongoose")


const userSchema = new mongoose.Schema({
    username: {
        type: String,
        unique: [ true, "username already taken" ],
        required: true,
    },

    email: {
        type: String,
        unique: [ true, "Account already exists with this email address" ],
        required: true,
    },

    password: {
        type: String,
        required: true
    },

    // Security - Password Reset Workflow
    resetPasswordToken: {
        type: String,
        default: null
    },
    resetPasswordExpires: {
        type: Date,
        default: null
    },

    // Security - TOTP Multi-Factor Authentication
    mfaEnabled: {
        type: Boolean,
        default: false
    },
    mfaSecret: {
        type: String,
        default: null
    },
    mfaRecoveryCodes: {
        type: [String],
        default: []
    },
    mfaFailedAttempts: {
        type: Number,
        default: 0
    },
    mfaLockoutUntil: {
        type: Date,
        default: null
    },

    // Structured Session Store (Supports token rotation and multi-device sessions)
    refreshSessions: [
        {
            token: { type: String, required: true },
            deviceInfo: { type: String, default: "Generic Web Client" },
            lastActivity: { type: Date, default: Date.now }
        }
    ],

    // Global session tracking metadata
    sessionMetadata: {
        lastLogin: { type: Date },
        lastActivity: { type: Date }
    },

    // GitHub OAuth Integration (token stored AES-256 encrypted, never in plaintext)
    githubOAuth: {
        encryptedAccessToken: { type: String, default: null },  // AES-256-GCM encrypted
        tokenIv: { type: String, default: null },               // Initialization vector (hex)
        tokenAuthTag: { type: String, default: null },          // GCM auth tag (hex)
        githubUserId: { type: String, default: null },
        githubUsername: { type: String, default: null },
        githubAvatarUrl: { type: String, default: null },
        scopes: { type: [String], default: [] },
        connectedAt: { type: Date, default: null }
    },

    // --- New Fields for Settings Module ---
    avatarUrl: {
        type: String,
        default: null
    },

    notificationPreferences: {
        passwordResetEmails: { type: Boolean, default: true },
        weeklyProgressEmails: { type: Boolean, default: true },
        interviewReminderEmails: { type: Boolean, default: true },
        codingReminderEmails: { type: Boolean, default: true },
        securityAlerts: { type: Boolean, default: true }
    },

    aiPreferences: {
        preferredAI: { type: String, enum: ["Auto", "Gemini", "Groq", "OpenRouter"], default: "Auto" },
        preferredLanguage: { type: String, enum: ["English", "Hindi", "Gujarati"], default: "English" },
        preferredVoice: { type: String, enum: ["Male", "Female"], default: "Male" },
        preferredSpeechSpeed: { type: String, enum: ["Slow", "Normal", "Fast"], default: "Normal" }
    },

    securityActivity: [{
        action: { type: String, required: true },
        device: { type: String },
        ip: { type: String },
        date: { type: Date, default: Date.now }
    }]
})

const userModel = mongoose.model("users", userSchema)

module.exports = userModel