const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const voiceSessionModel = require("./models/voiceSession.model");
const User = require("./models/user.model");

async function testMongo() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB.");

        const testUser = await User.findOne();
        if (!testUser) {
            console.log("No user found to test with.");
            process.exit(1);
        }

        const mockTranslations = {
            "en-IN": { status: "completed", text: "Hello" },
            "hi-IN": { status: "completed", text: "Namaste" }
        };

        const session = await voiceSessionModel.create({
            user: testUser._id,
            interviewReport: new mongoose.Types.ObjectId(),
            difficulty: "Easy",
            enableFollowUps: true,
            questions: [{
                questionText: "Hello",
                intention: "Greeting",
                answer: "Hi",
                topic: "General",
                type: "behavioral",
                translations: mockTranslations
            }],
            transcripts: [],
            evaluations: [],
            status: "started"
        });

        console.log("Session created with ID:", session._id.toString());
        
        // Fetch raw from MongoDB
        const rawDoc = await mongoose.connection.db.collection("voiceinterviewsessions").findOne({ _id: session._id });
        console.log("\nRaw Document in MongoDB:");
        console.log(JSON.stringify(rawDoc.questions[0].translations, null, 2));

        // Fetch via Mongoose
        const mongooseDoc = await voiceSessionModel.findById(session._id);
        console.log("\nMongoose Document:");
        // Mongoose Maps have a .get() method or can be converted to Object
        console.log(JSON.stringify(Object.fromEntries(mongooseDoc.questions[0].translations), null, 2));

        await voiceSessionModel.deleteOne({ _id: session._id });
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

testMongo();
