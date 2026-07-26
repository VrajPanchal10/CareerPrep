/**
 * Runtime Diagnostic: POST /api/interview — CSRF Trace
 *
 * Loads the REAL csrf.middleware.js, wraps it with diagnostic logging,
 * fires 8 controlled test requests, and prints exactly where each is
 * accepted or rejected.
 *
 * Usage:  node tools/trace_post.js       (run from Backend/)
 */
require("dotenv").config();
process.env.NODE_ENV = "development";

const express    = require("express");
const cookieParser = require("cookie-parser");
const http       = require("http");

/* ── Load the REAL middleware ─────────────────────────────────────────────── */
const csrfMiddleware = require("../src/middlewares/security/csrf.middleware");
const { CORS_ALLOWED_ORIGINS } = require("../src/config/security.config");

/* ── Minimal Express app with the same middleware order as app.js ─────── */
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use((req, _res, next) => { req.correlationId = "diag"; next(); });

/* ── Traced CSRF wrapper ─────────────────────────────────────────────────── */
function tracedCsrf(req, res, next) {
    const bar = "═".repeat(62);
    console.log(`\n${bar}`);
    console.log("🔍  CSRF MIDDLEWARE — ENTRY");
    console.log(bar);
    console.log("  Method         :", req.method);
    console.log("  URL            :", req.originalUrl);
    console.log("  Content-Type   :", req.headers["content-type"] || "(none)");
    console.log("  Origin         :", req.headers["origin"]       || "(none)");
    console.log("  Referer        :", req.headers["referer"]      || "(none)");
    console.log("  Cookie token   :", req.cookies?.token       ? "PRESENT" : "ABSENT");
    console.log("  Cookie csrfToken:", req.cookies?.csrfToken  ? "PRESENT" : "ABSENT");
    console.log("  X-CSRF-Token hdr:", req.headers["x-csrf-token"] ? "PRESENT" : "ABSENT");

    if (req.cookies?.csrfToken && req.headers["x-csrf-token"]) {
        const match = req.cookies.csrfToken === req.headers["x-csrf-token"];
        console.log("  Cookie==Header? :", match ? "YES ✅" : "NO ❌");
    }
    console.log("  CORS whitelist  :", JSON.stringify(CORS_ALLOWED_ORIGINS));

    /* Intercept res.status().json() so we can print the rejection payload */
    const _status = res.status.bind(res);
    const _json   = res.json.bind(res);
    let code = 200;
    res.status = (c) => { code = c; return _status(c); };
    res.json   = (b) => {
        if (code >= 400) {
            console.log(`\n  🔴  REJECTED  →  HTTP ${code}`);
            console.log(`  Body: ${JSON.stringify(b)}`);
        }
        return _json(b);
    };

    csrfMiddleware(req, res, () => {
        console.log("  ✅  CSRF PASSED  →  next()");
        next();
    });
}

/* ── Route under test (mirrors interview.routes.js line 14) ──────────── */
app.post("/api/interview/", tracedCsrf, (_req, res) => {
    console.log("  ✅  CONTROLLER REACHED  (generateInterViewReportController)");
    res.json({ success: true, reached: "controller" });
});

app.use((req, res) => {
    console.log(`  ❌  404  — no route matched: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ error: "Not found" });
});

/* ── HTTP request helper ─────────────────────────────────────────────────── */
function fire(port, label, { method="POST", path="/api/interview/", headers={}, body=null }) {
    return new Promise(resolve => {
        console.log(`\n${"─".repeat(62)}`);
        console.log(`📤  ${label}`);
        console.log(`    ${method} http://localhost:${port}${path}`);
        Object.entries(headers).forEach(([k,v]) => console.log(`    ${k}: ${v}`));
        console.log("─".repeat(62));

        const opts = { hostname:"127.0.0.1", port, path, method, headers };
        const req = http.request(opts, res => {
            let d = "";
            res.on("data", c => d += c);
            res.on("end", () => {
                console.log(`\n📥  HTTP ${res.statusCode}  ${res.statusMessage}`);
                try { console.log(`    ${JSON.stringify(JSON.parse(d))}`); } catch { console.log(`    ${d}`); }
                resolve(res.statusCode);
            });
        });
        req.on("error", e => { console.error("  req error:", e.message); resolve(0); });
        if (body) req.write(body);
        req.end();
    });
}

/* ── Run all probes ──────────────────────────────────────────────────────── */
app.listen(0, async function () {
    const port = this.address().port;
    console.log("╔══════════════════════════════════════════════════════════════╗");
    console.log("║  CSRF Diagnostic Trace — POST /api/interview               ║");
    console.log(`║  Diagnostic port: ${port}                                      ║`);
    console.log("║  Middleware file : src/middlewares/security/csrf.middleware.js║");
    console.log("╚══════════════════════════════════════════════════════════════╝");

    /* 1 — Bare POST (no cookies, no Origin, no Authorization) */
    await fire(port, "Test 1 · Bare POST — no cookies, no Origin, no Auth header", {
        headers: { "Content-Type": "application/json" }
    });

    /* 2 — Auth cookie only, no CSRF cookie */
    await fire(port, "Test 2 · Auth cookie PRESENT, CSRF cookie ABSENT", {
        headers: {
            "Content-Type": "application/json",
            "Cookie": "token=eyJhbGciOiJIUzI1NiJ9.fake",
            "Origin": "http://localhost:5173"
        }
    });

    /* 3 — Both cookies, but NO X-CSRF-Token header */
    await fire(port, "Test 3 · Both cookies, X-CSRF-Token header ABSENT", {
        headers: {
            "Content-Type": "application/json",
            "Cookie": "token=eyJhbGciOiJIUzI1NiJ9.fake; csrfToken=tok_abc123",
            "Origin": "http://localhost:5173"
        }
    });

    /* 4 — Both cookies + X-CSRF-Token header but VALUES MISMATCH */
    await fire(port, "Test 4 · Cookies + X-CSRF-Token header (MISMATCH)", {
        headers: {
            "Content-Type": "application/json",
            "Cookie": "token=eyJhbGciOiJIUzI1NiJ9.fake; csrfToken=tok_abc123",
            "Origin": "http://localhost:5173",
            "X-CSRF-Token": "WRONG_VALUE"
        }
    });

    /* 5 — Everything correct — should reach the controller */
    await fire(port, "Test 5 · ALL CORRECT — cookies + matching header + trusted origin", {
        headers: {
            "Content-Type": "application/json",
            "Cookie": "token=eyJhbGciOiJIUzI1NiJ9.fake; csrfToken=tok_abc123",
            "Origin": "http://localhost:5173",
            "X-CSRF-Token": "tok_abc123"
        },
        body: JSON.stringify({ test: true })
    });

    /* 6 — multipart/form-data (the actual interview upload content type) */
    const boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW";
    const mpBody = `--${boundary}\r\nContent-Disposition: form-data; name="jobDescription"\r\n\r\nTest JD\r\n--${boundary}--\r\n`;
    await fire(port, "Test 6 · multipart/form-data + all correct headers", {
        headers: {
            "Content-Type": `multipart/form-data; boundary=${boundary}`,
            "Cookie": "token=eyJhbGciOiJIUzI1NiJ9.fake; csrfToken=tok_abc123",
            "Origin": "http://localhost:5173",
            "X-CSRF-Token": "tok_abc123"
        },
        body: mpBody
    });

    /* 7 — Untrusted origin */
    await fire(port, "Test 7 · Trusted cookies + CSRF, but UNTRUSTED Origin", {
        headers: {
            "Content-Type": "application/json",
            "Cookie": "token=eyJhbGciOiJIUzI1NiJ9.fake; csrfToken=tok_abc123",
            "Origin": "https://evil.com",
            "X-CSRF-Token": "tok_abc123"
        }
    });

    /* 8 — Blocked Content-Type (form-urlencoded) */
    await fire(port, "Test 8 · application/x-www-form-urlencoded (blocked Content-Type)", {
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Cookie": "token=eyJhbGciOiJIUzI1NiJ9.fake; csrfToken=tok_abc123",
            "Origin": "http://localhost:5173",
            "X-CSRF-Token": "tok_abc123"
        },
        body: "key=value"
    });

    console.log("\n" + "═".repeat(62));
    console.log("🏁  All 8 probes complete.  See per-test verdicts above.");
    console.log("═".repeat(62) + "\n");
    this.close();
    process.exit(0);
});
