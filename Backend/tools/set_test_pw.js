const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config({ path: "./.env" });
const userModel = require("./src/models/user.model");

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        // Set a known password for a test user so we can login via API
        const hash = await bcrypt.hash("TestPass123!", 10);
        const result = await userModel.updateOne(
            { username: "testuser123" },
            { $set: { password: hash } }
        );
        console.log("Updated testuser123 password:", result.modifiedCount, "documents modified");
    } catch (err) {
        console.error("Error:", err.message);
    } finally {
        await mongoose.connection.close();
    }
}
run();
