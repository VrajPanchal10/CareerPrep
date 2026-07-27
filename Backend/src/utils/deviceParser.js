/**
 * Device & User Agent Parsing Utility
 * Parses raw User-Agent headers into structured OS, Browser, and Device Type metadata.
 */
function parseUserAgent(userAgent = "") {
    if (!userAgent || typeof userAgent !== "string") {
        return {
            os: "Unknown OS",
            browser: "Unknown Browser",
            deviceType: "Desktop"
        };
    }

    let os = "Unknown OS";
    if (userAgent.includes("Windows NT 10.0") || userAgent.includes("Windows 11") || userAgent.includes("Windows 10")) os = "Windows 10/11";
    else if (userAgent.includes("Windows")) os = "Windows";
    else if (userAgent.includes("Mac OS X") || userAgent.includes("Macintosh")) os = "macOS";
    else if (userAgent.includes("Android")) os = "Android";
    else if (userAgent.includes("iPhone") || userAgent.includes("iPad") || userAgent.includes("iPod")) os = "iOS";
    else if (userAgent.includes("Linux")) os = "Linux";

    let browser = "Unknown Browser";
    if (userAgent.includes("Edg/")) browser = "Microsoft Edge";
    else if (userAgent.includes("OPR/") || userAgent.includes("Opera")) browser = "Opera";
    else if (userAgent.includes("Chrome/") && !userAgent.includes("Edg/")) browser = "Google Chrome";
    else if (userAgent.includes("Safari/") && !userAgent.includes("Chrome/")) browser = "Safari";
    else if (userAgent.includes("Firefox/")) browser = "Mozilla Firefox";

    let deviceType = "Desktop";
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(userAgent)) {
        deviceType = "Mobile";
    } else if (/iPad|Tablet|PlayBook/.test(userAgent)) {
        deviceType = "Tablet";
    }

    return { os, browser, deviceType };
}

module.exports = { parseUserAgent };
