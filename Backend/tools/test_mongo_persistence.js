require("dotenv").config({ path: ".env" });
const mongoose = require("mongoose");
const dbUrl = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/careerprep";

async function run() {
    await mongoose.connect(dbUrl);
    console.log("Connected to MongoDB.");

    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log("\nCollections and Document Counts:");
    
    for (const coll of collections) {
        const count = await mongoose.connection.db.collection(coll.name).countDocuments();
        console.log(`- ${coll.name}: ${count} documents`);
    }

    // specific check for the user's data
    const users = await mongoose.connection.db.collection("users").find().toArray();
    console.log(`\nFound ${users.length} users.`);
    for (const user of users) {
        console.log(`User ID: ${user._id}, Name: ${user.name}, Email: ${user.email}`);
        
        const atsCount = await mongoose.connection.db.collection("atsreports").countDocuments({ user: user._id });
        const intCount = await mongoose.connection.db.collection("interviewsessions").countDocuments({ user: user._id });
        const voiceCount = await mongoose.connection.db.collection("voicesessions").countDocuments({ user: user._id });
        const codeCount = await mongoose.connection.db.collection("codingsubmissions").countDocuments({ user: user._id });
        const gitCount = await mongoose.connection.db.collection("repositoryinterviewresults").countDocuments({ user: user._id });
        
        console.log(`  ATS: ${atsCount}, Interview: ${intCount}, Voice: ${voiceCount}, Code: ${codeCount}, GitHub: ${gitCount}`);
    }

    await mongoose.disconnect();
}

run();
