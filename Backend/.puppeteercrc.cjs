const { join } = require("path");

/**
 * @type {import("puppeteer").Configuration}
 * Configures Puppeteer to store downloaded Chrome browser inside the project workspace
 * so that Render includes the browser binary in the final production runtime container.
 */
module.exports = {
    cacheDirectory: join(__dirname, ".cache", "puppeteer")
};
