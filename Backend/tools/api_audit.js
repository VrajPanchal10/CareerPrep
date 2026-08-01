/**
 * CareerPrep E2E API Verification Script
 * Tests every major endpoint with a real authenticated session.
 * Run: node api_audit.js
 */
const http = require('http');

function makeRequest(options, body) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            const cookies = res.headers['set-cookie'] || [];
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data, cookies, headers: res.headers }));
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

const BASE = { hostname: 'localhost', port: 3000 };

const results = [];

function report(name, status, note) {
    const icon = status === 'PASS' ? '✅' : status === 'SKIP' ? '⏭️ ' : '❌';
    results.push({ name, status, note });
    console.log(`  ${icon} [${status}] ${name}${note ? ' — ' + note : ''}`);
}

async function run() {
    let cookieJar = [];
    let csrfToken = '';
    let interviewId = '';
    let atsId = '';
    let voiceSessionId = '';


    // ── Login ─────────────────────────────────────────────────────────────
    console.log('\n🔐 AUTH');
    const loginBody = JSON.stringify({ email: 'testuser123@gmail.com', password: 'TestPass123!' });
    const loginRes = await makeRequest({ ...BASE, path: '/api/auth/login', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(loginBody) }
    }, loginBody);
    cookieJar = [...loginRes.cookies];
    
    const loginData = JSON.parse(loginRes.data);
    if (loginRes.status === 200) {
        report('POST /api/auth/login', 'PASS', `user: ${loginData.user?.username}`);
        // Extract CSRF from cookies
        const csrfCookie = cookieJar.find(c => c.includes('csrfToken'));
        if (csrfCookie) {
            const match = csrfCookie.match(/csrfToken=([^;]+)/);
            csrfToken = match ? match[1] : '';
        }
    } else {
        report('POST /api/auth/login', 'FAIL', loginData.message || loginRes.data.slice(0, 100));
        console.log('\n❌ Cannot continue without login');
        return;
    }

    const cookieHeader = () => cookieJar.map(c => c.split(';')[0]).join('; ');
    const authHeaders = () => ({ Cookie: cookieHeader(), 'X-CSRF-Token': csrfToken });

    // ── GET /api/auth/get-me ───────────────────────────────────────────────
    const meRes = await makeRequest({ ...BASE, path: '/api/auth/get-me', method: 'GET',
        headers: authHeaders() });
    const meData = JSON.parse(meRes.data);
    if (meRes.status === 200 && meData.user) {
        report('GET /api/auth/get-me', 'PASS', `username: ${meData.user.username}`);
    } else {
        report('GET /api/auth/get-me', 'FAIL', meData.message || meRes.status);
    }

    // ── System Health ─────────────────────────────────────────────────────
    console.log('\n🏥 SYSTEM HEALTH');
    const healthRes = await makeRequest({ ...BASE, path: '/api/system/health', method: 'GET',
        headers: authHeaders() });
    const healthData = JSON.parse(healthRes.data);
    if (healthRes.status === 200 && healthData.success) {
        report('GET /api/system/health', 'PASS', `${Object.keys(healthData.providers).length} providers checked`);
        Object.entries(healthData.providers).forEach(([name, info]) => {
            const icon = info.status === 'healthy' ? '✅' : info.status === 'unconfigured' ? '⚠️ ' : '❌';
            console.log(`    ${icon} ${name}: ${info.status}${info.error ? ' — ' + info.error : ''}`);
        });
    } else {
        report('GET /api/system/health', 'FAIL', healthData.message);
    }

    // ── Interview Reports ─────────────────────────────────────────────────
    console.log('\n📋 INTERVIEW COACH');
    const reportsRes = await makeRequest({ ...BASE, path: '/api/interview', method: 'GET',
        headers: authHeaders() });
    try {
        const reportsData = JSON.parse(reportsRes.data);
        if (reportsRes.status === 200 && reportsData.success) {
            const count = reportsData.interviewReports?.length || 0;
            interviewId = reportsData.interviewReports?.[0]?._id;
            report('GET /api/interview', 'PASS', `${count} reports`);
        } else {
            report('GET /api/interview', 'FAIL', reportsData.message || reportsRes.status);
        }
    } catch(e) { report('GET /api/interview', 'FAIL', `parse error: ${reportsRes.data.slice(0,100)}`); }

    // ── ATS Reports ───────────────────────────────────────────────────────
    console.log('\n📄 ATS MATCH');
    const atsRes = await makeRequest({ ...BASE, path: '/api/ats', method: 'GET',
        headers: authHeaders() });
    try {
        const atsData = JSON.parse(atsRes.data);
        if (atsRes.status === 200 && atsData.success) {
            const count = atsData.atsReports?.length || 0;
            atsId = atsData.atsReports?.[0]?._id;
            report('GET /api/ats', 'PASS', `${count} reports`);
        } else {
            report('GET /api/ats', 'FAIL', atsData.message || atsRes.status);
        }
    } catch(e) { report('GET /api/ats', 'FAIL', `parse error: ${atsRes.data.slice(0,100)}`); }

    if (atsId) {
        const singleAtsRes = await makeRequest({
            ...BASE,
            path: `/api/ats/report/${atsId}`,
            method: 'GET',
            headers: authHeaders()
        });
        try {
            const singleAtsData = JSON.parse(singleAtsRes.data);
            if (singleAtsRes.status === 200 && singleAtsData.success) {
                report(`GET /api/ats/report/:atsId`, 'PASS', `Successfully retrieved report ${atsId}`);
            } else {
                report(`GET /api/ats/report/:atsId`, 'FAIL', singleAtsData.message || singleAtsRes.status);
            }
        } catch(e) {
            report(`GET /api/ats/report/:atsId`, 'FAIL', `parse error`);
        }
    } else {
        report(`GET /api/ats/report/:atsId`, 'SKIP', `No historical ATS report to query`);
    }


    // ── Voice Sessions ────────────────────────────────────────────────────
    console.log('\n🎤 VOICE INTERVIEW');
    const vsRes = await makeRequest({ ...BASE, path: '/api/voice-session', method: 'GET',
        headers: authHeaders() });
    try {
        const vsData = JSON.parse(vsRes.data);
        if (vsRes.status === 200 && vsData.success) {
            const count = vsData.sessions?.length || 0;
            voiceSessionId = vsData.sessions?.[0]?._id;
            report('GET /api/voice-session', 'PASS', `${count} sessions`);
        } else {
            report('GET /api/voice-session', 'FAIL', vsData.message || vsRes.status);
        }
    } catch(e) { report('GET /api/voice-session', 'FAIL', `parse error: ${vsRes.data.slice(0,100)}`); }

    // ── Voice Progress ────────────────────────────────────────────────────
    const vpRes = await makeRequest({ ...BASE, path: '/api/voice-session/progress', method: 'GET',
        headers: authHeaders() });
    try {
        const vpData = JSON.parse(vpRes.data);
        if (vpRes.status === 200 && vpData.success) {
            report('GET /api/voice-session/progress', 'PASS', `readinessScore: ${vpData.progressStats?.voiceReadinessScore}`);
        } else {
            report('GET /api/voice-session/progress', 'FAIL', vpData.message || vpRes.status);
        }
    } catch(e) { report('GET /api/voice-session/progress', 'FAIL', `parse error`); }

    // ── GitHub Defense (Repo Interview) ───────────────────────────────────
    console.log('\n🛡️  GITHUB DEFENSE');
    const ghRes = await makeRequest({ ...BASE, path: '/api/github-defense/dashboard', method: 'GET',
        headers: authHeaders() });
    try {
        const ghData = JSON.parse(ghRes.data);
        if (ghRes.status === 200 && ghData.success) {
            report('GET /api/github-defense/dashboard', 'PASS', `dashboard: ${ghData.dashboard ? 'has data' : 'no data yet'}`);
        } else {
            report('GET /api/github-defense/dashboard', 'FAIL', ghData.message || ghRes.status);
        }
    } catch(e) { report('GET /api/github-defense/dashboard', 'FAIL', `parse error: ${ghRes.data.slice(0,100)}`); }

    // ── GitHub OAuth Status ───────────────────────────────────────────────
    const ghOauthRes = await makeRequest({ ...BASE, path: '/api/github-oauth/status', method: 'GET',
        headers: authHeaders() });
    try {
        const ghOauthData = JSON.parse(ghOauthRes.data);
        if (ghOauthRes.status === 200 && ghOauthData.success) {
            report('GET /api/github-oauth/status', 'PASS', `connected: ${ghOauthData.connected}`);
        } else {
            report('GET /api/github-oauth/status', 'FAIL', ghOauthData.message || ghOauthRes.status);
        }
    } catch(e) { report('GET /api/github-oauth/status', 'FAIL', `parse error`); }

    // ── AI Gateway Status ─────────────────────────────────────────────────
    console.log('\n🤖 AI GATEWAY');
    const aiRes = await makeRequest({ ...BASE, path: '/api/ai/status', method: 'GET',
        headers: authHeaders() });
    try {
        const aiData = JSON.parse(aiRes.data);
        if (aiRes.status === 200 && aiData.success) {
            report('GET /api/ai/status', 'PASS', `gemini: ${aiData.health?.gemini?.status}`);
        } else {
            report('GET /api/ai/status', 'FAIL', aiData.message || aiRes.status);
        }
    } catch(e) { report('GET /api/ai/status', 'FAIL', `parse error`); }

    // ── Forgot Password ───────────────────────────────────────────────────
    console.log('\n🔑 FORGOT PASSWORD (generic response expected)');
    const fpBody = JSON.stringify({ email: 'nonexistent@example.com' });
    const fpRes = await makeRequest({ ...BASE, path: '/api/auth/forgot-password', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(fpBody), Cookie: cookieHeader(), 'X-CSRF-Token': csrfToken }
    }, fpBody);
    try {
        const fpData = JSON.parse(fpRes.data);
        if (fpRes.status === 200 && fpData.success) {
            report('POST /api/auth/forgot-password', 'PASS', 'generic success response (as designed)');
        } else {
            report('POST /api/auth/forgot-password', 'FAIL', fpData.message || fpRes.status);
        }
    } catch(e) { report('POST /api/auth/forgot-password', 'FAIL', `status: ${fpRes.status}`); }

    // ── Summary ───────────────────────────────────────────────────────────
    console.log('\n\n═══════════════════════════════════════════');
    console.log('AUDIT SUMMARY');
    console.log('═══════════════════════════════════════════');
    const pass = results.filter(r => r.status === 'PASS').length;
    const fail = results.filter(r => r.status === 'FAIL').length;
    const skip = results.filter(r => r.status === 'SKIP').length;
    console.log(`✅ PASSED: ${pass}`);
    console.log(`❌ FAILED: ${fail}`);
    console.log(`⏭️  SKIPPED: ${skip}`);
    console.log(`📊 TOTAL: ${results.length}`);
    console.log(`\n🎯 Pass Rate: ${Math.round(pass/results.length*100)}%`);
    
    if (fail > 0) {
        console.log('\nFailed endpoints:');
        results.filter(r => r.status === 'FAIL').forEach(r => {
            console.log(`  ❌ ${r.name} — ${r.note}`);
        });
    }
}

run().catch(e => console.error('Fatal:', e.message));
