const { google } = require("googleapis");
const { logger } = require("../../utils/securityLogger");

/**
 * Validate required environment variables for Google Gmail REST API.
 */
function validateGmailConfig() {
    const requiredVars = ["GMAIL_USER", "GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN"];
    const missing = requiredVars.filter((varName) => !process.env[varName]);
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
 * Helper to encode string/buffer into Base64URL format required by Gmail API.
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
function createMimeMessage({ from, to, subject, htmlBody, textBody }) {
    const boundary = "==_careerprep_boundary_" + Date.now().toString(16);

    const messageParts = [
        `From: ${from}`,
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

/**
 * Send Password Reset Email via Gmail REST API
 */
async function sendResetPasswordEmail(email, resetUrl, username = "User") {
    if (!validateGmailConfig()) {
        throw new Error("Gmail configuration error. Please check server environment variables.");
    }

    const fromAddress = process.env.MAIL_FROM || `"CareerPrep Security" <${process.env.GMAIL_USER}>`;

    const textBody = `Hello ${username},\n\nWe received a request to reset your password for your CareerPrep account.\n\nReset Password Link: ${resetUrl}\n\nThis link expires in 1 hour.\nIf you didn't request this reset, you can safely ignore this email.\n\nCareerPrep Team`;

    const htmlBody = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f7; color: #51545e; margin: 0; padding: 0; width: 100%; -webkit-text-size-adjust: none; }
                .email-wrapper { width: 100%; margin: 0; padding: 0; background-color: #f4f4f7; }
                .email-content { width: 100%; max-width: 570px; margin: 0 auto; padding: 24px; }
                .email-masthead { padding: 25px 0; text-align: center; }
                .email-masthead_name { font-size: 24px; font-weight: bold; color: #6366f1; text-decoration: none; }
                .email-body { width: 100%; margin: 0; padding: 0; border-top: 1px solid #e8e5ef; border-bottom: 1px solid #e8e5ef; background-color: #ffffff; }
                .email-body_inner { width: 100%; max-width: 570px; margin: 0 auto; padding: 45px; }
                h1 { margin-top: 0; color: #333333; font-size: 22px; font-weight: bold; text-align: left; }
                p { margin-top: 0; color: #51545e; font-size: 16px; line-height: 1.625; }
                .button-container { text-align: center; margin: 30px auto; }
                .button { background-color: #6366f1; border-radius: 6px; color: #ffffff !important; display: inline-block; font-size: 16px; font-weight: bold; line-height: 45px; text-align: center; text-decoration: none; width: 200px; -webkit-text-size-adjust: none; }
                .email-footer { width: 100%; max-width: 570px; margin: 0 auto; padding: 30px; text-align: center; }
                .email-footer p { font-size: 12px; color: #a8aaaf; }
            </style>
        </head>
        <body>
            <table class="email-wrapper" width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                    <td align="center">
                        <table class="email-content" width="100%" cellpadding="0" cellspacing="0" role="presentation">
                            <tr>
                                <td class="email-masthead">
                                    <span class="email-masthead_name">CareerPrep</span>
                                </td>
                            </tr>
                            <tr>
                                <td class="email-body">
                                    <table class="email-body_inner" align="center" width="100%" cellpadding="0" cellspacing="0" role="presentation">
                                        <tr>
                                            <td>
                                                <h1>Reset Your Password</h1>
                                                <p>Hello ${username},</p>
                                                <p>We received a request to reset your password.</p>
                                                <p>Click the button below to set up a new password.</p>
                                                <div class="button-container">
                                                    <a href="${resetUrl}" class="button" target="_blank">Reset Password</a>
                                                </div>
                                                <p>This link expires in 1 hour.</p>
                                                <p>If you didn't request this password reset, you can safely ignore this email.</p>
                                                <p>CareerPrep Team</p>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                            <tr>
                                <td class="email-footer">
                                    <p>&copy; ${new Date().getFullYear()} CareerPrep. All rights reserved.</p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
    `;

    const rawMime = createMimeMessage({
        from: fromAddress,
        to: email,
        subject: "Reset Your CareerPrep Password",
        htmlBody,
        textBody
    });

    const encodedMessage = encodeBase64URL(rawMime);

    try {
        logger.info("Sending Password Reset Email via Gmail REST API...", { to: email });
        const gmail = getGmailClient();
        const response = await gmail.users.messages.send({
            userId: "me",
            requestBody: { raw: encodedMessage }
        });

        logger.info("Password Reset Email Sent Successfully", {
            to: email,
            messageId: response.data.id,
            timestamp: new Date().toISOString()
        });

        return { success: true, messageId: response.data.id };
    } catch (err) {
        logger.error("Failed to send Password Reset email via Gmail API:", { error: err.message || err });
        throw new Error(`Email delivery error: ${err.message || "Failed to send email"}`);
    }
}

/**
 * Send Security Notification Email when password changes
 */
async function sendPasswordChangedEmail(email, { time, browser, ip, location }) {
    if (!validateGmailConfig()) {
        throw new Error("Gmail configuration error. Please check server environment variables.");
    }

    const fromAddress = process.env.MAIL_FROM || `"CareerPrep Security" <${process.env.GMAIL_USER}>`;

    const textBody = `Hello,\n\nYour CareerPrep account password was changed successfully.\n\nDetails:\n- Time: ${time}\n- Browser: ${browser}\n- IP Address: ${ip}${location ? `\n- Location: ${location}` : ""}\n\nIf this wasn't you, please contact support immediately.\n\nCareerPrep Team`;

    const htmlBody = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f7; color: #51545e; margin: 0; padding: 0; width: 100%; -webkit-text-size-adjust: none; }
                .email-wrapper { width: 100%; margin: 0; padding: 0; background-color: #f4f4f7; }
                .email-content { width: 100%; max-width: 570px; margin: 0 auto; padding: 24px; }
                .email-masthead { padding: 25px 0; text-align: center; }
                .email-masthead_name { font-size: 24px; font-weight: bold; color: #6366f1; text-decoration: none; }
                .email-body { width: 100%; margin: 0; padding: 0; border-top: 1px solid #e8e5ef; border-bottom: 1px solid #e8e5ef; background-color: #ffffff; }
                .email-body_inner { width: 100%; max-width: 570px; margin: 0 auto; padding: 45px; }
                h1 { margin-top: 0; color: #333333; font-size: 22px; font-weight: bold; text-align: left; }
                p { margin-top: 0; color: #51545e; font-size: 16px; line-height: 1.625; }
                .details-list { background-color: #f4f4f7; padding: 15px; border-radius: 6px; margin: 20px 0; list-style: none; font-size: 14px; }
                .details-list li { margin-bottom: 8px; }
                .details-list li:last-child { margin-bottom: 0; }
                .email-footer { width: 100%; max-width: 570px; margin: 0 auto; padding: 30px; text-align: center; }
                .email-footer p { font-size: 12px; color: #a8aaaf; }
            </style>
        </head>
        <body>
            <table class="email-wrapper" width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                    <td align="center">
                        <table class="email-content" width="100%" cellpadding="0" cellspacing="0" role="presentation">
                            <tr>
                                <td class="email-masthead">
                                    <span class="email-masthead_name">CareerPrep</span>
                                </td>
                            </tr>
                            <tr>
                                <td class="email-body">
                                    <table class="email-body_inner" align="center" width="100%" cellpadding="0" cellspacing="0" role="presentation">
                                        <tr>
                                            <td>
                                                <h1>Your CareerPrep Password Was Changed</h1>
                                                <p>Password changed successfully for your account.</p>
                                                <ul class="details-list">
                                                    <li><strong>Time:</strong> ${time}</li>
                                                    <li><strong>Browser:</strong> ${browser}</li>
                                                    <li><strong>IP Address:</strong> ${ip}</li>
                                                    ${location ? `<li><strong>Approximate Location:</strong> ${location}</li>` : ""}
                                                </ul>
                                                <p>If this wasn't you, contact support immediately.</p>
                                                <p>CareerPrep Team</p>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                            <tr>
                                <td class="email-footer">
                                    <p>&copy; ${new Date().getFullYear()} CareerPrep. All rights reserved.</p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
    `;

    const rawMime = createMimeMessage({
        from: fromAddress,
        to: email,
        subject: "Your CareerPrep Password Was Changed",
        htmlBody,
        textBody
    });

    const encodedMessage = encodeBase64URL(rawMime);

    try {
        logger.info("Sending Password Changed Email via Gmail REST API...", { to: email });
        const gmail = getGmailClient();
        const response = await gmail.users.messages.send({
            userId: "me",
            requestBody: { raw: encodedMessage }
        });

        logger.info("Password Changed Email Sent Successfully", {
            to: email,
            messageId: response.data.id,
            timestamp: new Date().toISOString()
        });

        return { success: true, messageId: response.data.id };
    } catch (err) {
        logger.error("Failed to send Password Changed email via Gmail API:", { error: err.message || err });
        throw new Error(`Email delivery error: ${err.message || "Failed to send email"}`);
    }
}

module.exports = {
    sendResetPasswordEmail,
    sendPasswordChangedEmail,
    checkGmailConnection,
    validateGmailConfig
};
