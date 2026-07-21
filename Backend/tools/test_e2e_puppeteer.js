const puppeteer = require("puppeteer");
const path = require("path");

(async () => {
    console.log("Starting E2E Puppeteer Test...");
    const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    const page = await browser.newPage();
    
    // Configure viewport
    await page.setViewport({ width: 1280, height: 800 });

    // Catch any page-level exceptions
    page.on("pageerror", (err) => {
        console.error("BROWSER PAGE ERROR:", err.toString());
    });

    try {
        // 1. Go to register page
        console.log("Navigating to register page...");
        await page.goto("http://localhost:5173/register", { waitUntil: "networkidle2" });

        const testUsername = "e2e_user_" + Date.now();
        const testEmail = `e2e_${Date.now()}@example.com`;
        const testPassword = "Password123!";

        console.log(`Registering user: ${testUsername} (${testEmail})`);
        await page.type("#username", testUsername);
        await page.type("#email", testEmail);
        await page.type("#password", testPassword);
        
        await Promise.all([
            page.waitForNavigation({ waitUntil: "networkidle2" }),
            page.click("button[type='submit']")
        ]);

        console.log("Registration complete. Logged in and redirected to home/dashboard.");

        // 2. Go to GitHub Defense
        console.log("Navigating to GitHub Defense page...");
        await page.goto("http://localhost:5173/github-defense", { waitUntil: "networkidle2" });
        
        console.log("Current URL:", page.url());

        // Wait for input selector
        console.log("Waiting for #repoUrl input field...");
        await page.waitForSelector("#repoUrl", { timeout: 10000 });

        // 3. Test Invalid Repository URL (should return clean 404)
        console.log("=== Testing Invalid Repo (Expecting 404) ===");
        await page.type("#repoUrl", "https://github.com/VrajPanchal10/non-existent-repo-xyz");
        
        // Click analyze
        await page.click("#repoSubmitBtn");
        console.log("Clicked analyze on invalid repo. Waiting for error alert...");

        // Wait for error container to appear
        const errorSelector = "div[style*='rgba(231, 76, 60']"; // style contains rgba(231, 76, 60
        await page.waitForSelector(errorSelector, { timeout: 15000 });
        
        const errorText = await page.evaluate((sel) => {
            return document.querySelector(sel).innerText;
        }, errorSelector);
        
        console.log("Result error message shown in UI:", errorText);

        // Capture screenshot of invalid repo error
        const screenshotPath404 = path.join("C:/Users/HP/.gemini/antigravity-ide/brain/e4c4df8a-13da-44d8-8d71-a86e82f9a16d", "invalid_repo_error.png");
        await page.screenshot({ path: screenshotPath404 });
        console.log(`Saved screenshot 404 to: ${screenshotPath404}`);

        // Clean up input
        await page.evaluate(() => {
            document.querySelector("#repoUrl").value = "";
        });

        // 4. Test Private Repository URL (should return clean 403 since not authenticated via OAuth)
        console.log("\n=== Testing Private Repo Fomo-Cinema (Expecting 403) ===");
        await page.type("#repoUrl", "https://github.com/VrajPanchal10/Fomo-Cinema");
        
        await page.click("#repoSubmitBtn");
        console.log("Clicked analyze on private Fomo-Cinema. Waiting for 403 error alert...");

        // Wait for error container
        await page.waitForSelector(errorSelector, { timeout: 15000 });
        const privateErrorText = await page.evaluate((sel) => {
            return document.querySelector(sel).innerText;
        }, errorSelector);
        console.log("Result error message shown in UI:", privateErrorText);

        // Capture screenshot of private repo error
        const screenshotPath403 = path.join("C:/Users/HP/.gemini/antigravity-ide/brain/e4c4df8a-13da-44d8-8d71-a86e82f9a16d", "fomo_cinema_private_error.png");
        await page.screenshot({ path: screenshotPath403 });
        console.log(`Saved screenshot 403 to: ${screenshotPath403}`);

        // Clean up input
        await page.evaluate(() => {
            document.querySelector("#repoUrl").value = "";
        });

        // 5. Test Valid Public Repository URL (should succeed via GITHUB_SYSTEM_TOKEN fallback)
        console.log("\n=== Testing Valid Public Repo Spoon-Knife (Expecting Success) ===");
        await page.type("#repoUrl", "https://github.com/octocat/Spoon-Knife");
        
        await page.click("#repoSubmitBtn");
        console.log("Clicked analyze on Spoon-Knife. Waiting for AI analysis timeline (can take up to 25s)...");

        // Wait for .dashboard-content to appear (indicates analysis finished and dashboard rendered)
        try {
            await page.waitForSelector(".dashboard-content", { timeout: 45000 });
            console.log("Analysis success! Dashboard content rendered.");

            // Check if Dial Score has parsed score
            const scoreText = await page.evaluate(() => {
                return document.querySelector(".dial-score-text").innerText.replace(/\n/g, " ");
            });
            console.log("Dial Score text:", scoreText);

            // Capture screenshot of successfully analyzed repo
            const screenshotPathSuccess = path.join("C:/Users/HP/.gemini/antigravity-ide/brain/e4c4df8a-13da-44d8-8d71-a86e82f9a16d", "spoon_knife_analyzed.png");
            await page.screenshot({ path: screenshotPathSuccess });
            console.log(`Saved success screenshot to: ${screenshotPathSuccess}`);
        } catch (waitErr) {
            const hasError = await page.evaluate(() => {
                const el = document.querySelector("div[style*='rgba(231, 76, 60']");
                return el ? el.innerText : null;
            });
            if (hasError) {
                console.log("Analysis failed with UI error:", hasError);
            } else {
                console.log("Analysis timed out. Page URL is:", page.url());
            }
            const screenshotPathErr = path.join("C:/Users/HP/.gemini/antigravity-ide/brain/e4c4df8a-13da-44d8-8d71-a86e82f9a16d", "spoon_knife_error.png");
            await page.screenshot({ path: screenshotPathErr });
            console.log(`Saved failure screenshot to: ${screenshotPathErr}`);
            throw waitErr;
        }

    } catch (err) {
        console.error("TEST FAILED:", err);
    } finally {
        await browser.close();
        console.log("Puppeteer E2E test finished.");
    }
})();
