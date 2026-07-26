require("dotenv").config({ path: __dirname + "/Backend/.env" });
process.env.NODE_ENV = "development";
const express = require(__dirname + "/Backend/node_modules/express");
const cookieParser = require(__dirname + "/Backend/node_modules/cookie-parser");
const http = require("http");
const csrfMiddleware = require(__dirname + "/Backend/src/middlewares/security/csrf.middleware");
const { CORS_ALLOWED_ORIGINS } = require(__dirname + "/Backend/src/config/security.config");

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use((req, _res, next) => { req.correlationId = "diag"; next(); });

function tracedCsrf(req, res, next) {
    const bar = "=".repeat(62);
    console.log("\n" + bar);
    console.log("CSRF MIDDLEWARE ENTRY");
    console.log(bar);
    console.log("  Method         :", req.method);
    console.log("  URL            :", req.originalUrl);
    console.log("  Content-Type   :", req.headers["content-type"] || "(none)");
    console.log("  Origin         :", req.headers["origin"] || "(none)");
    console.log("  Referer        :", req.headers["referer"] || "(none)");
    console.log("  Cookie token   :", req.cookies?.token ? "PRESENT" : "ABSENT");
    console.log("  Cookie csrfToken:", req.cookies?.csrfToken ? "PRESENT" : "ABSENT");
    console.log("  X-CSRF-Token hdr:", req.headers["x-csrf-token"] ? "PRESENT" : "ABSENT");
    if (req.cookies?.csrfToken && req.headers["x-csrf-token"]) {
        const match = req.cookies.csrfToken === req.headers["x-csrf-token"];
        console.log("  Cookie==Header? :", match ? "YES" : "NO");
    }
    console.log("  CORS whitelist  :", JSON.stringify(CORS_ALLOWED_ORIGINS));

    const _status = res.status.bind(res);
    const _json = res.json.bind(res);
    let code = 200;
    res.status = (c) => { code = c; return _status(c); };
    res.json = (b) => {
        if (code >= 400) {
            console.log("\n  REJECTED  ->  HTTP " + code);
            console.log("  Body: " + JSON.stringify(b));
        }
        return _json(b);
    };
    csrfMiddleware(req, res, () => {
        console.log("  CSRF PASSED -> next()");
        next();
    });
}

app.post("/api/interview/", tracedCsrf, (_req, res) => {
    console.log("  CONTROLLER REACHED");
    res.json({ success: true, reached: "controller" });
});

app.use((req, res) => {
    console.log("  404 - no route matched: " + req.method + " " + req.originalUrl);
    res.status(404).json({ error: "Not found" });
});

function fire(port, label, opts) {
    return new Promise(resolve => {
        console.log("\n" + "-".repeat(62));
        console.log("TEST: " + label);
        console.log("  " + (opts.method||"POST") + " http://localhost:" + port + (opts.path||"/api/interview/"));
        console.log("-".repeat(62));

        const o = { hostname: "127.0.0.1", port, path: opts.path||"/api/interview/", method: opts.method||"POST", headers: opts.headers||{} };
        const req = http.request(o, res => {
            let d = "";
            res.on("data", c => d += c);
            res.on("end", () => {
                console.log("\nRESPONSE: HTTP " + res.statusCode);
                try { console.log("  " + JSON.stringify(JSON.parse(d))); } catch { console.log("  " + d); }
                resolve(res.statusCode);
            });
        });
        req.on("error", e => { console.error("  error:", e.message); resolve(0); });
        if (opts.body) req.write(opts.body);
        req.end();
    });
}

app.listen(0, async function () {
    const port = this.address().port;
    console.log("=== CSRF Diagnostic Trace ===");
    console.log("Port: " + port);
    console.log("Middleware: Backend/src/middlewares/security/csrf.middleware.js\n");

    await fire(port, "1. Bare POST - no cookies, no Origin, no Auth", {
        headers: { "Content-Type": "application/json" }
    });
    await fire(port, "2. Auth cookie PRESENT, CSRF cookie ABSENT", {
        headers: { "Content-Type": "application/json", "Cookie": "token=eyJ.fake", "Origin": "http://localhost:5173" }
    });
    await fire(port, "3. Both cookies, X-CSRF-Token header ABSENT", {
        headers: { "Content-Type": "application/json", "Cookie": "token=eyJ.fake; csrfToken=tok_abc", "Origin": "http://localhost:5173" }
    });
    await fire(port, "4. Both cookies + X-CSRF-Token header MISMATCH", {
        headers: { "Content-Type": "application/json", "Cookie": "token=eyJ.fake; csrfToken=tok_abc", "Origin": "http://localhost:5173", "X-CSRF-Token": "WRONG" }
    });
    await fire(port, "5. ALL CORRECT - cookies + matching header + trusted origin", {
        headers: { "Content-Type": "application/json", "Cookie": "token=eyJ.fake; csrfToken=tok_abc", "Origin": "http://localhost:5173", "X-CSRF-Token": "tok_abc" },
        body: JSON.stringify({ test: true })
    });
    const bnd = "----WebKitFormBoundary7MA4YWxkTrZu0gW";
    await fire(port, "6. multipart/form-data + all correct", {
        headers: { "Content-Type": "multipart/form-data; boundary=" + bnd, "Cookie": "token=eyJ.fake; csrfToken=tok_abc", "Origin": "http://localhost:5173", "X-CSRF-Token": "tok_abc" },
        body: "--" + bnd + "\r\nContent-Disposition: form-data; name=\"jd\"\r\n\r\nTest\r\n--" + bnd + "--\r\n"
    });
    await fire(port, "7. Correct cookies + CSRF but UNTRUSTED Origin", {
        headers: { "Content-Type": "application/json", "Cookie": "token=eyJ.fake; csrfToken=tok_abc", "Origin": "https://evil.com", "X-CSRF-Token": "tok_abc" }
    });
    await fire(port, "8. application/x-www-form-urlencoded (blocked Content-Type)", {
        headers: { "Content-Type": "application/x-www-form-urlencoded", "Cookie": "token=eyJ.fake; csrfToken=tok_abc", "Origin": "http://localhost:5173", "X-CSRF-Token": "tok_abc" },
        body: "key=value"
    });

    console.log("\n" + "=".repeat(62));
    console.log("ALL 8 PROBES COMPLETE");
    console.log("=".repeat(62));
    this.close();
    process.exit(0);
});
