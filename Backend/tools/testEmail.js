require("dotenv").config();
const { transporter } = require("../src/services/auth/email.service");

async function run() {
    if (!process.env.SMTP_USER) {
        console.error("SMTP_USER environment variable is not defined.");
        process.exit(1);
    }

    console.log("Sending SMTP Test Email...");
    try {
        const fromAddress = process.env.SMTP_FROM || `"CareerPrep Security" <${process.env.SMTP_USER}>`;
        const info = await transporter.sendMail({
            from: fromAddress,
            to: process.env.SMTP_USER,
            subject: "CareerPrep SMTP Test",
            text: "Gmail SMTP is working successfully!"
        });
        console.log("Gmail SMTP is working successfully! Message ID:", info.messageId);
        process.exit(0);
    } catch (err) {
        console.error("SMTP Test Failed:", err);
        process.exit(1);
    }
}

run();
