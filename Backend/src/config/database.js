const mongoose = require("mongoose")



const { logger } = require("../utils/securityLogger")

async function connectToDB() {
    try {
        await mongoose.connect(process.env.MONGO_URI)
        logger.info("Connected to Database ✅")
    }
    catch (err) {
        logger.error("Database connection failure", err)
    }
}

module.exports = connectToDB