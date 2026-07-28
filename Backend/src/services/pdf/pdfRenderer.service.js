const puppeteer = require("puppeteer");
const ejs = require("ejs");
const path = require("path");
const fs = require("fs");
const { logSecurityEvent } = require("../../utils/securityLogger");

// Ensure Puppeteer cache directory is inside the project workspace for cloud persistence (Render/Vercel)
if (!process.env.PUPPETEER_CACHE_DIR) {
    const defaultCacheDir = path.join(process.cwd(), ".cache", "puppeteer");
    process.env.PUPPETEER_CACHE_DIR = defaultCacheDir;
}

// Singleton browser instance state
let browserInstance = null;
let launchPromise = null;

/**
 * Get or launch the shared Puppeteer browser instance.
 * Automatically recovers from crashes or unexpected disconnections.
 */
async function getBrowser() {
    // 1. Return if instance is active and connected
    if (browserInstance && browserInstance.isConnected()) {
        return browserInstance;
    }

    // 2. Return the active launch promise if launch is already in progress
    if (launchPromise) {
        return launchPromise;
    }

    const launchOptions = {
        headless: true,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--no-first-run",
            "--no-zygote",
            "--single-process"
        ]
    };

    // Use environment override if set (e.g. system Chromium)
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    // 3. Initiate launch
    console.log(`[PDF DIAGNOSTIC] 4. Launching shared Puppeteer browser instance (Cache DIR: ${process.env.PUPPETEER_CACHE_DIR})...`);
    launchPromise = puppeteer.launch(launchOptions)
        .then(browser => {
            console.log(`[PDF DIAGNOSTIC] 4b. Puppeteer browser launched successfully.`);
            browserInstance = browser;
            launchPromise = null;

            // Handle unexpected crash / termination gracefully
            browser.once("disconnected", () => {
                console.warn("[Puppeteer] Browser instance disconnected or crashed. Resetting singleton.");
                if (browserInstance === browser) {
                    browserInstance = null;
                }
            });

            return browser;
        })
        .catch(err => {
            console.error("[PDF DIAGNOSTIC ERROR] Puppeteer launch failed:", err.message);
            launchPromise = null;
            throw err;
        });

    return launchPromise;
}

/**
 * Reusable PDF Rendering Service.
 * Compiles EJS templates, executes Puppeteer safely cross-platform via a shared browser instance,
 * and handles missing binaries or timeouts gracefully.
 */
async function renderPdf(templateName, data = {}, printOptions = {}) {
    const correlationId = data.correlationId || "pdf-rendering";
    const clientIp = data.clientIp || "unknown";

    // 1. Resolve template path and compile HTML using EJS
    let htmlContent = "";
    let headerHtml = "<div></div>";
    let footerHtml = "<div></div>";

    try {
        const templatesDir = path.join(__dirname, "../../templates/pdf");
        let mainTemplatePath = path.join(templatesDir, templateName);
        let isRawHtml = templateName.trim().startsWith("<") || templateName.includes("<html");

        if (isRawHtml) {
            htmlContent = templateName;
        } else {
            if (!fs.existsSync(mainTemplatePath)) {
                throw new Error(`Template file not found at: ${mainTemplatePath}`);
            }
            // Render main content
            htmlContent = await ejs.renderFile(mainTemplatePath, data);
        }

        // Render header and footer partials if exist
        const headerPath = path.join(templatesDir, "partials/header.ejs");
        const footerPath = path.join(templatesDir, "partials/footer.ejs");

        if (fs.existsSync(headerPath)) {
            headerHtml = await ejs.renderFile(headerPath, data);
        }
        if (fs.existsSync(footerPath)) {
            footerHtml = await ejs.renderFile(footerPath, data);
        }
        console.log(`[PDF DIAGNOSTIC] 3. HTML Template compiled successfully. Length: ${htmlContent.length} chars.`);
    } catch (err) {
        console.error("[PDF DIAGNOSTIC ERROR] EJS template compilation failed:", err.message);
        logSecurityEvent({
            eventType: "PDF_TEMPLATE_COMPILATION_FAILED",
            ip: clientIp,
            correlationId,
            details: { templateName, error: err.message }
        });
        throw new Error(`Failed to compile EJS layout templates: ${err.message}`);
    }

    // 2. Resolve browser instance
    let browser;
    try {
        browser = await getBrowser();
    } catch (err) {
        console.error("===== PDF GENERATION ERROR: PUPPETEER LAUNCH FAILED =====");
        console.error("Failure Step: Puppeteer Launch");
        console.error("Executable Path:", process.env.PUPPETEER_EXECUTABLE_PATH || "default");
        console.error("Exact Exception:", err.message);
        console.error(err.stack);
        console.error("=========================================================");
        logSecurityEvent({
            eventType: "PDF_CHROME_LAUNCH_FAILED",
            ip: clientIp,
            correlationId,
            details: { 
                error: err.message, 
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "default"
            }
        });
        throw new Error(
            `PDF generation engine failed to launch Chrome: ${err.message}`
        );
    }

    // 3. Render page on the shared browser instance and generate PDF buffer
    let page;
    try {
        page = await browser.newPage();

        // Enforce safe load timeouts (30 seconds)
        await page.setDefaultNavigationTimeout(30000);
        await page.setDefaultTimeout(30000);

        await page.setContent(htmlContent, { waitUntil: "domcontentloaded" });

        const pdfBuffer = await page.pdf({
            format: "A4",
            margin: {
                top: "20mm",
                bottom: "20mm",
                left: "15mm",
                right: "15mm"
            },
            printBackground: true,
            displayHeaderFooter: true,
            headerTemplate: headerHtml,
            footerTemplate: footerHtml,
            ...printOptions
        });

        await page.close();
        console.log(`[PDF DIAGNOSTIC] 5. PDF generated successfully by Puppeteer (${pdfBuffer.length} bytes).`);
        return pdfBuffer;
    } catch (err) {
        if (page) {
            await page.close().catch(() => {});
        }
        console.error("===== PDF GENERATION ERROR: PAGE RENDERING FAILED =====");
        console.error("Failure Step: page.setContent() / page.pdf()");
        console.error("HTML Length:", htmlContent ? htmlContent.length : 0);
        console.error("Exact Exception:", err.message);
        console.error(err.stack);
        console.error("======================================================");
        logSecurityEvent({
            eventType: "PDF_GENERATION_FAILED",
            ip: clientIp,
            correlationId,
            details: { templateName, error: err.message }
        });
        throw new Error(`Failed to print PDF file: ${err.message}`);
    }
}

/**
 * Shut down the shared Puppeteer browser instance gracefully.
 */
async function shutdown() {
    if (browserInstance) {
        try {
            await browserInstance.close();
        } catch (err) {
            console.error("[Puppeteer] Error closing shared browser:", err.message);
        } finally {
            browserInstance = null;
        }
    }
}

module.exports = {
    renderPdf,
    shutdown
};
