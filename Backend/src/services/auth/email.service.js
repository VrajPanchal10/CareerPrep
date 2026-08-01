const { google } = require("googleapis");
const { logger } = require("../../utils/securityLogger");

/**
 * Validate required environment variables for Google Gmail REST API.
 */
function validateGmailConfig() {
    const gmailUser = process.env.ADMIN_EMAIL || process.env.GMAIL_USER;
    const requiredVars = ["GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN"];
    const missing = requiredVars.filter((varName) => !process.env[varName]);
    if (!gmailUser) {
        missing.push("ADMIN_EMAIL (or GMAIL_USER)");
    }
    if (missing.length > 0) {
        logger.error(`[Gmail Service Startup Error] Missing required environment variables: ${missing.join(", ")}`);
        return false;
    }
    return true;
}

// Perform validation on module load
validateGmailConfig();

/**
 * Initialize Google OAuth2 Client
 */
function getGmailClient() {
    const oAuth2Client = new google.auth.OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET,
        "https://developers.google.com/oauthplayground"
    );

    oAuth2Client.setCredentials({
        refresh_token: process.env.GMAIL_REFRESH_TOKEN
    });

    return google.gmail({ version: "v1", auth: oAuth2Client });
}

/**
 * Encodes string/buffer into Base64URL format required by Gmail API.
 */
function encodeBase64URL(str) {
    return Buffer.from(str)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

/**
 * Constructs RFC 2822 compliant multipart/alternative MIME message.
 */
function createMimeMessage({ from, replyTo, to, subject, htmlBody, textBody }) {
    const boundary = "==_careerprep_boundary_" + Date.now().toString(16);

    const messageParts = [
        `From: ${from}`,
        `Reply-To: ${replyTo}`,
        `To: ${to}`,
        `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
        `MIME-Version: 1.0`,
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        "",
        `--${boundary}`,
        `Content-Type: text/plain; charset=UTF-8`,
        `Content-Transfer-Encoding: 7bit`,
        "",
        textBody,
        "",
        `--${boundary}`,
        `Content-Type: text/html; charset=UTF-8`,
        `Content-Transfer-Encoding: 7bit`,
        "",
        htmlBody,
        "",
        `--${boundary}--`
    ];

    return messageParts.join("\r\n");
}

/* ==========================================================================
   TEMPLATES GENERATION (HTML + PLAIN TEXT)
   ========================================================================== */

/**
 * Generates Password Reset templates (HTML & Plain text) with CareerPrep dark branding
 */
function generatePasswordResetTemplates(username, resetUrl) {
    const year = new Date().getFullYear();

    const textBody = `Reset Your CareerPrep Password\n\nHello ${username},\n\nWe received a request to reset your CareerPrep password.\n\nReset your password by clicking or copying this link:\n${resetUrl}\n\nThis link expires in 60 minutes.\n\nIf you didn't request this, you can safely ignore this email. Your password will remain unchanged.\n\nSecurity Notice: For your security, never share this link with anyone.\n\n--\nCareerPrep Team\nAI Resume Analyzer | Interview Coach`;

    const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your Password</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #090d16; color: #f8fafc; margin: 0; padding: 0; width: 100%; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        .email-wrapper { width: 100%; background-color: #090d16; padding: 32px 16px; box-sizing: border-box; }
        .email-card { max-width: 580px; margin: 0 auto; background-color: #0d1322; border: 1px solid #233147; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5); }
        .header { padding: 32px 40px 24px; text-align: left; }
        .logo-text { font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em; text-decoration: none; display: inline-block; }
        .logo-highlight { color: #6366f1; }
        .header-divider { height: 2px; background: linear-gradient(90deg, #6366f1, #818cf8, transparent); margin-top: 16px; border-radius: 2px; }
        .content { padding: 8px 40px 32px; }
        h1 { color: #ffffff; font-size: 22px; font-weight: 700; margin: 0 0 16px 0; letter-spacing: -0.01em; }
        p { color: #cbd5e1; font-size: 15px; line-height: 1.625; margin: 0 0 20px 0; }
        .alert-box { background-color: rgba(99, 102, 241, 0.1); border-left: 4px solid #6366f1; padding: 14px 18px; border-radius: 6px; margin: 24px 0; }
        .alert-box p { color: #c7d2fe; font-size: 14px; margin: 0; line-height: 1.5; }
        .cta-container { text-align: center; margin: 36px 0; }
        .cta-button { background-color: #6366f1; color: #ffffff !important; display: inline-block; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 36px; border-radius: 8px; box-shadow: 0 4px 16px rgba(99, 102, 241, 0.35); transition: background-color 0.2s ease; }
        .muted-note { color: #64748b; font-size: 13px; line-height: 1.5; margin-top: 24px; }
        .security-notice { border-top: 1px solid #1e293b; margin-top: 28px; padding-top: 20px; }
        .security-notice p { color: #64748b; font-size: 12px; margin: 0; line-height: 1.5; }
        .footer { background-color: #080c16; padding: 28px 40px; border-top: 1px solid #1a2436; text-align: center; }
        .footer-ecosystem { color: #475569; font-size: 12px; font-weight: 500; margin-bottom: 8px; }
        .footer-copyright { color: #475569; font-size: 12px; margin: 0; }
        @media only screen and (max-width: 600px) {
            .email-wrapper { padding: 16px 8px; }
            .header, .content, .footer { padding-left: 24px !important; padding-right: 24px !important; }
            .cta-button { width: 100% !important; box-sizing: border-box; }
        }
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="email-card">
            <div class="header">
                <div class="logo-text">Career<span class="logo-highlight">Prep</span></div>
                <div class="header-divider"></div>
            </div>
            <div class="content">
                <h1>Reset Your Password</h1>
                <p>Hello <strong style="color: #ffffff;">${username}</strong>,</p>
                <p>We received a request to reset your CareerPrep password. If this was you, click the button below to set up a new password.</p>
                
                <div class="alert-box">
                    <p>⏱️ This password reset link expires in <strong>60 minutes</strong>.</p>
                </div>

                <div class="cta-container">
                    <a href="${resetUrl}" class="cta-button" target="_blank">Reset Password</a>
                </div>

                <p class="muted-note">If you didn't request this, you can safely ignore this email. Your password will remain unchanged.</p>

                <div class="security-notice">
                    <p>🔒 <strong>Security Notice:</strong> For your security, never share this link with anyone.</p>
                </div>
            </div>
            <div class="footer">
                <p class="footer-ecosystem">CareerPrep Ecosystem &bull; AI Resume Analyzer &bull; Interview Coach</p>
                <p class="footer-copyright">&copy; ${year} CareerPrep. All rights reserved.</p>
            </div>
        </div>
    </div>
</body>
</html>
    `;

    return { htmlBody, textBody };
}

/**
 * Generates Password Changed confirmation templates (HTML & Plain text)
 */
function generatePasswordChangedTemplates(username = "User", details = {}) {
    const year = new Date().getFullYear();
    const { time = new Date().toUTCString(), browser = "Unknown Browser", ip = "Unknown IP", location = "" } = details;

    const textBody = `Your CareerPrep Password Was Changed\n\nHello ${username},\n\nYour CareerPrep account password was changed successfully.\n\nDetails:\n- Time: ${time}\n- Browser: ${browser}\n- IP Address: ${ip}${location ? `\n- Location: ${location}` : ""}\n\nIf this wasn't you, please contact support immediately.\n\n--\nCareerPrep Team`;

    const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Changed</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #090d16; color: #f8fafc; margin: 0; padding: 0; width: 100%; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        .email-wrapper { width: 100%; background-color: #090d16; padding: 32px 16px; box-sizing: border-box; }
        .email-card { max-width: 580px; margin: 0 auto; background-color: #0d1322; border: 1px solid #233147; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5); }
        .header { padding: 32px 40px 24px; text-align: left; }
        .logo-text { font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em; text-decoration: none; display: inline-block; }
        .logo-highlight { color: #6366f1; }
        .header-divider { height: 2px; background: linear-gradient(90deg, #6366f1, #818cf8, transparent); margin-top: 16px; border-radius: 2px; }
        .content { padding: 8px 40px 32px; }
        h1 { color: #ffffff; font-size: 22px; font-weight: 700; margin: 0 0 16px 0; }
        p { color: #cbd5e1; font-size: 15px; line-height: 1.625; margin: 0 0 20px 0; }
        .details-box { background-color: #131c2e; border: 1px solid #233147; border-radius: 8px; padding: 18px; margin: 24px 0; }
        .details-list { list-style: none; padding: 0; margin: 0; }
        .details-list li { color: #94a3b8; font-size: 14px; margin-bottom: 8px; }
        .details-list li:last-child { margin-bottom: 0; }
        .details-list strong { color: #f1f5f9; }
        .security-notice { border-top: 1px solid #1e293b; margin-top: 28px; padding-top: 20px; }
        .security-notice p { color: #f87171; font-size: 13px; margin: 0; line-height: 1.5; }
        .footer { background-color: #080c16; padding: 28px 40px; border-top: 1px solid #1a2436; text-align: center; }
        .footer-ecosystem { color: #475569; font-size: 12px; font-weight: 500; margin-bottom: 8px; }
        .footer-copyright { color: #475569; font-size: 12px; margin: 0; }
        @media only screen and (max-width: 600px) {
            .email-wrapper { padding: 16px 8px; }
            .header, .content, .footer { padding-left: 24px !important; padding-right: 24px !important; }
        }
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="email-card">
            <div class="header">
                <div class="logo-text">Career<span class="logo-highlight">Prep</span></div>
                <div class="header-divider"></div>
            </div>
            <div class="content">
                <h1>Password Changed Successfully</h1>
                <p>Hello <strong style="color: #ffffff;">${username}</strong>,</p>
                <p>The password for your CareerPrep account was recently changed.</p>
                
                <div class="details-box">
                    <ul class="details-list">
                        <li><strong>Time:</strong> ${time}</li>
                        <li><strong>Browser:</strong> ${browser}</li>
                        <li><strong>IP Address:</strong> ${ip}</li>
                        ${location ? `<li><strong>Approximate Location:</strong> ${location}</li>` : ""}
                    </ul>
                </div>

                <div class="security-notice">
                    <p>⚠️ <strong>Important:</strong> If you did not perform this change, please contact support immediately to secure your account.</p>
                </div>
            </div>
            <div class="footer">
                <p class="footer-ecosystem">CareerPrep Ecosystem &bull; AI Resume Analyzer &bull; Interview Coach</p>
                <p class="footer-copyright">&copy; ${year} CareerPrep. All rights reserved.</p>
            </div>
        </div>
    </div>
</body>
</html>
    `;

    return { htmlBody, textBody };
}

/* ==========================================================================
   CORE EMAIL SEND ENGINE & LOGGING
   ========================================================================== */

/**
 * Generic internal sender executing Gmail REST API message dispatch
 */
async function sendGmailMessage({ templateName, recipientEmail, subject, htmlBody, textBody }) {
    if (!validateGmailConfig()) {
        throw new Error("Gmail configuration error. Please check server environment variables.");
    }

    const startTime = Date.now();
    const gmailUserEmail = process.env.ADMIN_EMAIL || process.env.GMAIL_USER;
    const fromAddress = process.env.MAIL_FROM || `CareerPrep <${gmailUserEmail}>`;
    const replyToAddress = gmailUserEmail;

    const rawMime = createMimeMessage({
        from: fromAddress,
        replyTo: replyToAddress,
        to: recipientEmail,
        subject,
        htmlBody,
        textBody
    });

    const encodedMessage = encodeBase64URL(rawMime);

    try {
        const gmail = getGmailClient();
        const response = await gmail.users.messages.send({
            userId: "me",
            requestBody: { raw: encodedMessage }
        });

        const executionTimeMs = Date.now() - startTime;

        // Structured production success log (Zero secret/token disclosure)
        logger.info("[INFO] Gmail Email Sent", {
            template: templateName,
            recipient: recipientEmail,
            messageId: response.data.id,
            timestamp: new Date().toISOString(),
            executionTime: `${executionTimeMs}ms`
        });

        return { success: true, messageId: response.data.id };
    } catch (err) {
        const statusCode = err.status || err.code || 500;
        const errorMessage = err.message || "Unknown Gmail REST API error";

        // Structured production error log (Zero secret/token disclosure)
        logger.error("[ERROR] Gmail Email Failed", {
            template: templateName,
            recipient: recipientEmail,
            status: statusCode,
            reason: errorMessage,
            timestamp: new Date().toISOString()
        });

        throw new Error(`Email delivery error: ${errorMessage}`);
    }
}

/**
 * Verification helper for health checks
 */
async function checkGmailConnection() {
    try {
        const gmail = getGmailClient();
        const profile = await gmail.users.getProfile({ userId: "me" });
        return { connected: true, email: profile.data.emailAddress };
    } catch (err) {
        logger.error("[Gmail API] Profile check failed:", { error: err.message });
        return { connected: false, error: err.message };
    }
}

/* ==========================================================================
   PUBLIC INTERFACE (PRESERVED CONTRACTS)
   ========================================================================== */

/**
 * Send Password Reset Email via Gmail REST API
 * Interface contract: sendResetPasswordEmail(email, resetUrl, username)
 */
async function sendResetPasswordEmail(email, resetUrl, username = "User") {
    const { htmlBody, textBody } = generatePasswordResetTemplates(username, resetUrl);

    return sendGmailMessage({
        templateName: "Password Reset",
        recipientEmail: email,
        subject: "Reset Your CareerPrep Password",
        htmlBody,
        textBody
    });
}

/**
 * Send Security Notification Email when password changes
 * Interface contract: sendPasswordChangedEmail(email, details)
 */
async function sendPasswordChangedEmail(email, details = {}) {
    const username = typeof details === "string" ? details : details.username || "User";
    const { htmlBody, textBody } = generatePasswordChangedTemplates(username, details);

    return sendGmailMessage({
        templateName: "Password Changed",
        recipientEmail: email,
        subject: "Your CareerPrep Password Was Changed",
        htmlBody,
        textBody
    });
}

module.exports = {
    sendResetPasswordEmail,
    sendPasswordChangedEmail,
    checkGmailConnection,
    validateGmailConfig
};
