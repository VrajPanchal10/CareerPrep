const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config({ path: "./.env" });
const userModel = require("./src/models/user.model");

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const user = await userModel.findOne({ email: "test@test.com" }).select("+password");
        if (!user) {
            console.log("User not found");
            return;
        }
        console.log("Username:", user.username);
        console.log("Password hash present:", !!user.password);
        // Try common passwords
        const passwords = ['Password123!', 'password123', 'Test1234!', '12345678', 'test123'];
        for (const pw of passwords) {
            const match = await bcrypt.compare(pw, user.password);
            if (match) {
                console.log("✅ Matching password found:", pw);
                return;
            }
        }
        console.log("No common password matched");
    } catch (err) {
        console.error("Error:", err.message);
    } finally {
        await mongoose.connection.close();
    }
}
run();
