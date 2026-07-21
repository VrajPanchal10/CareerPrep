/**
 * Docker Resilience Test - Tests that Judge0 downtime is handled gracefully
 * and recovery works after restart.
 */
const http = require('http');

function makeRequest(options, body) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            const cookies = res.headers['set-cookie'] || [];
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data, cookies }));
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

const BASE = { hostname: 'localhost', port: 3000 };

async function main() {
    // 1. Login
    const loginBody = JSON.stringify({ email: 'testuser123@gmail.com', password: 'TestPass123!' });
    const loginRes = await makeRequest({ ...BASE, path: '/api/auth/login', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(loginBody) }
    }, loginBody);
    const loginData = JSON.parse(loginRes.data);
    if (loginRes.status !== 200) throw new Error("Login failed: " + loginRes.data);
    const cookieJar = [...loginRes.cookies];
    const csrfCookie = cookieJar.find(c => c.includes('csrfToken'));
    const csrfToken = csrfCookie ? csrfCookie.match(/csrfToken=([^;]+)/)[1] : '';
    const cookieHeader = cookieJar.map(c => c.split(';')[0]).join('; ');
    const headers = { Cookie: cookieHeader, 'X-CSRF-Token': csrfToken, 'Content-Type': 'application/json' };

    // 2. Test WHILE Judge0 is DOWN - should get engine unavailable error
    console.log("--- Resilience: Judge0 STOPPED ---");
    const runBody = JSON.stringify({ language: 'javascript', code: 'console.log("test")', stdin: '' });
    const runRes = await makeRequest({ ...BASE, path: '/api/coding/run', method: 'POST',
        headers: { ...headers, 'Content-Length': Buffer.byteLength(runBody) }
    }, runBody);
    const runData = JSON.parse(runRes.data);
    
    if (runRes.status === 503 || (runData.error?.code && runData.error.code.includes('UNAVAILABLE'))) {
        console.log("  ✅ PASS — Judge0 down: Got meaningful 503 error:", runData.message);
    } else if (runData.verdict) {
        console.log("  ⚠️  NOTE — Returned a verdict (likely cached):", runData.verdict, "status:", runRes.status);
    } else {
        console.log("  ❌ FAIL — Unexpected response:", runRes.status, JSON.stringify(runData).slice(0, 150));
    }

    // 3. Health check while down
    console.log("--- Health check while DOWN ---");
    const hRes = await makeRequest({ ...BASE, path: '/api/coding/health', method: 'GET', headers });
    const hData = JSON.parse(hRes.data);
    console.log("  Health status:", hRes.status, "engine.status:", hData.engine?.status, "healthy:", hData.success);
    if (hData.engine?.cache?.runtimeCount > 0) {
        console.log("  ✅ PASS — Cache preserved during downtime. runtimeCount:", hData.engine.cache.runtimeCount);
    } else {
        console.log("  ⚠️  WARN — Cache empty during downtime");
    }
    
    console.log("\nNow start Judge0 containers manually and run: node resilience_recovery.js");
}

main().catch(e => console.error("Fatal:", e.message));
