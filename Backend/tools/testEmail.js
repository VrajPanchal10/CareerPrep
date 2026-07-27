require("dotenv").config();
const { checkGmailConnection, sendResetPasswordEmail } = require("../src/services/auth/email.service");

async function run() {
    console.log("Testing Gmail REST API Connection...");
    const conn = await checkGmailConnection();
    if (!conn.connected) {
        console.error("Gmail REST API connection check failed:", conn.error);
        process.exit(1);
    }

    console.log(`Connected to Gmail API as: ${conn.email}`);

    const targetEmail = process.env.GMAIL_USER || process.env.ADMIN_EMAIL;
    if (!targetEmail) {
        console.error("No target email configured in GMAIL_USER or ADMIN_EMAIL.");
        process.exit(1);
    }

    console.log(`Sending Gmail REST API Test Reset Email to ${targetEmail}...`);
    try {
        const result = await sendResetPasswordEmail(targetEmail, "http://localhost:5173/reset-password/test-token", "Test User");
        console.log("Gmail REST API Test Email Sent Successfully! Message ID:", result.messageId);
        process.exit(0);
    } catch (err) {
        console.error("Gmail REST API Test Failed:", err);
        process.exit(1);
    }
}

run();
