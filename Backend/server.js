require("dotenv").config()

// Enforce environment validation (Phase 9)
const requiredEnv = ["JWT_SECRET", "GOOGLE_GENAI_API_KEY", "MONGO_URI"];
const missingEnv = [];
for (const key of requiredEnv) {
    if (!process.env[key] || process.env[key].trim() === "") {
        missingEnv.push(key);
    }
}
if (missingEnv.length > 0) {
    console.error(`[FATAL] Missing required environment variables: ${missingEnv.join(", ")}`);
    process.exit(1);
}

const app = require("./src/app")
const connectToDB = require("./src/config/database")

connectToDB()


app.listen(3000, () => {
    console.log("Server is running on port 3000")
})