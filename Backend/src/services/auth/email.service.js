const nodemailer = require("nodemailer");
const { logger } = require("../../utils/securityLogger");

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

async function checkSmtpConnection() {
    try {
        await transporter.verify();
        return { connected: true };
    } catch (err) {
        return { connected: false, error: err.message || err };
    }
}

/**
 * Reusable email service abstraction.
 */
async function sendResetPasswordEmail(email, resetUrl, username = "User") {
    const fromAddress = process.env.SMTP_FROM || `"CareerPrep Security" <${process.env.SMTP_USER}>`;

    const emailBody = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f7; color: #51545e; margin: 0; padding: 0; width: 100%; -webkit-text-size-adjust: none; }
                .email-wrapper { width: 100%; margin: 0; padding: 0; background-color: #f4f4f7; }
                .email-content { width: 100%; max-width: 570px; margin: 0 auto; padding: 24px; }
                .email-masthead { padding: 25px 0; text-align: center; }
                .email-masthead_name { font-size: 24px; font-weight: bold; color: #d20d3b; text-decoration: none; }
                .email-body { width: 100%; margin: 0; padding: 0; border-top: 1px solid #e8e5ef; border-bottom: 1px solid #e8e5ef; background-color: #ffffff; }
                .email-body_inner { width: 100%; max-width: 570px; margin: 0 auto; padding: 45px; }
                h1 { margin-top: 0; color: #333333; font-size: 22px; font-weight: bold; text-align: left; }
                p { margin-top: 0; color: #51545e; font-size: 16px; line-height: 1.625; }
                .button-container { text-align: center; margin: 30px auto; }
                .button { background-color: #d20d3b; border-radius: 4px; color: #ffffff !important; display: inline-block; font-size: 16px; font-weight: bold; line-height: 45px; text-align: center; text-decoration: none; width: 200px; -webkit-text-size-adjust: none; }
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
                                                <p>Click the button below.</p>
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

    try {
        logger.info("Sending Password Reset Email...", { to: email });
        await transporter.sendMail({
            from: fromAddress,
            to: email,
            subject: "Reset Your CareerPrep Password",
            html: emailBody
        });
        logger.info("Password Reset Email Sent", { to: email });
        return { success: true };
    } catch (err) {
        logger.error("Failed to send SMTP email:", { error: err.message || err });
        throw new Error(`Email delivery system error: ${err.message}`);
    }
}

async function sendPasswordChangedEmail(email, { time, browser, ip, location }) {
    const fromAddress = process.env.SMTP_FROM || `"CareerPrep Security" <${process.env.SMTP_USER}>`;

    const emailBody = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f7; color: #51545e; margin: 0; padding: 0; width: 100%; -webkit-text-size-adjust: none; }
                .email-wrapper { width: 100%; margin: 0; padding: 0; background-color: #f4f4f7; }
                .email-content { width: 100%; max-width: 570px; margin: 0 auto; padding: 24px; }
                .email-masthead { padding: 25px 0; text-align: center; }
                .email-masthead_name { font-size: 24px; font-weight: bold; color: #d20d3b; text-decoration: none; }
                .email-body { width: 100%; margin: 0; padding: 0; border-top: 1px solid #e8e5ef; border-bottom: 1px solid #e8e5ef; background-color: #ffffff; }
                .email-body_inner { width: 100%; max-width: 570px; margin: 0 auto; padding: 45px; }
                h1 { margin-top: 0; color: #333333; font-size: 22px; font-weight: bold; text-align: left; }
                p { margin-top: 0; color: #51545e; font-size: 16px; line-height: 1.625; }
                .details-list { background-color: #f4f4f7; padding: 15px; border-radius: 4px; margin: 20px 0; list-style: none; font-size: 14px; }
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
                                                <p>Password changed successfully.</p>
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

    try {
        logger.info("Sending Password Changed Email...", { to: email });
        await transporter.sendMail({
            from: fromAddress,
            to: email,
            subject: "Your CareerPrep Password Was Changed",
            html: emailBody
        });
        logger.info("Password Changed Email Sent", { to: email });
        return { success: true };
    } catch (err) {
        logger.error("Failed to send password changed SMTP email:", { error: err.message || err });
        throw new Error(`Email delivery system error: ${err.message}`);
    }
}

module.exports = {
    sendResetPasswordEmail,
    sendPasswordChangedEmail,
    checkSmtpConnection,
    transporter
};

