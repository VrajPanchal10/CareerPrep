const express = require("express");
const cookieParser = require("cookie-parser");
const http = require("http");
const assert = require("assert");

const nonceMiddleware = require("../src/middlewares/security/nonce.middleware");
const securityHeadersMiddleware = require("../src/middlewares/security/securityHeaders.middleware");
const csrfMiddleware = require("../src/middlewares/security/csrf.middleware");

const app = express();
app.use(nonceMiddleware);
app.use(securityHeadersMiddleware);
app.use(cookieParser());
app.use(express.json());

// Dummy endpoints for validation tracing
app.get("/read", (req, res) => {
    res.send("read success");
});

app.post("/mutate", csrfMiddleware, (req, res) => {
    res.send("mutate success");
});

const server = http.createServer(app);
server.listen(0, async () => {
    const port = server.address().port;
    console.log(`Integration test server running on port: ${port}`);

    try {
        await runTests(port);
        console.log("-----------------------------------------");
        console.log("SUCCESS: ALL INTEGRATION SECURITY TESTS PASSED!");
        console.log("-----------------------------------------");
        server.close();
        process.exit(0);
    } catch (err) {
        console.error("-----------------------------------------");
        console.error("FAIL: INTEGRATION SECURITY TESTS FAILED!");
        console.error(err);
        console.log("-----------------------------------------");
        server.close();
        process.exit(1);
    }
});

async function makeRequest(port, method, path, headers = {}, body = null) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            port,
            method,
            path,
            headers
        }, (res) => {
            let data = "";
            res.on("data", chunk => data += chunk);
            res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
        });
        req.on("error", reject);
        if (body) req.write(body);
        req.end();
    });
}

async function runTests(port) {
    // Test 1: GET requests should bypass CSRF and contain nonce CSP
    const t1 = await makeRequest(port, "GET", "/read");
    assert.strictEqual(t1.status, 200);
    assert.ok(t1.headers["content-security-policy"], "Missing CSP Header");
    assert.ok(t1.headers["content-security-policy"].includes("nonce-"), "CSP missing nonce token mapping");
    assert.strictEqual(t1.headers["x-frame-options"]?.toLowerCase(), "deny");
    console.log("✓ Test 1 Passed: GET bypasses CSRF and returns nonce security headers");

    // Test 2: Mutating request in development from local client should bypass check
    process.env.NODE_ENV = "development";
    const t2 = await makeRequest(port, "POST", "/mutate", { "content-type": "application/json" });
    assert.strictEqual(t2.status, 200);
    console.log("✓ Test 2 Passed: Dev API client checks pass");

    // Test 3: Mutating request in production with no cookies or authorization should fail
    process.env.NODE_ENV = "production";
    const t3 = await makeRequest(port, "POST", "/mutate", { "content-type": "application/json" });
    assert.strictEqual(t3.status, 403);
    console.log("✓ Test 3 Passed: Prod API request without JWT authorization is blocked");

    // Test 4: Mutating requests with suspicious URL-encoded content-types should fail
    const t4 = await makeRequest(port, "POST", "/mutate", { 
        "content-type": "application/x-www-form-urlencoded",
        "authorization": "Bearer dummy-token"
    });
    assert.strictEqual(t4.status, 415);
    console.log("✓ Test 4 Passed: Blocked invalid media content-types");

    // Test 5: Browser request with mismatched CSRF headers should fail
    const t5 = await makeRequest(port, "POST", "/mutate", {
        "cookie": "token=dummy-jwt-token; csrfToken=dummy-csrf-token",
        "content-type": "application/json"
    });
    assert.strictEqual(t5.status, 403);
    console.log("✓ Test 5 Passed: Browser token mismatch blocked");
}
