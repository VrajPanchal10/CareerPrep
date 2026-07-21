
require("dotenv").config({ path: "d:/CareerPrep/Backend/.env" });

async function testPublicRepo() {
    console.log("=== Testing Public Repo (Fomo-Cinema) ===");
    const url = `https://api.github.com/repos/VrajPanchal10/Fomo-Cinema`;
    const res = await fetch(url);
    console.log("Status:", res.status);
    console.log("Rate Limit Remaining:", res.headers.get("x-ratelimit-remaining"));
    if (!res.ok) {
        console.log("Error Body:", await res.text());
    } else {
        const json = await res.json();
        console.log("Repo Size (KB):", json.size);
    }
}

async function testPrivateRepo() {
    console.log("\n=== Testing Private Repo (Needs Token) ===");
    const mongoose = require("mongoose");
    await mongoose.connect(process.env.MONGO_URI);
    const userModel = require("d:/CareerPrep/Backend/src/models/user.model.js");
    const oauthService = require("d:/CareerPrep/Backend/src/services/github/githubOAuth.service.js");
    
    // Find a user with github token
    const user = await userModel.findOne({ "githubOAuth.encryptedAccessToken": { $ne: null } });
    if (!user) {
        console.log("No user with GitHub OAuth found in DB.");
        mongoose.disconnect();
        return;
    }
    console.log("Found User:", user.email);
    console.log("Token Exists in DB!");
    try {
        const gh = user.githubOAuth;
        const token = oauthService.decryptToken({
            encrypted: gh.encryptedAccessToken,
            iv: gh.tokenIv,
            authTag: gh.tokenAuthTag
        });
        console.log("Decrypted successfully:", token.substring(0, 10) + "...");
    } catch(e) {
        console.error("Decryption failed:", e.message);
    }
    mongoose.disconnect();
}

(async () => {
    try {
        await testPublicRepo();
        await testPrivateRepo();
    } catch (err) {
        console.error("Test failed:", err);
    }
})();
