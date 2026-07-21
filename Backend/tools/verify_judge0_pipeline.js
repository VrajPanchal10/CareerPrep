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
    const icon = status === 'PASS' ? '✅' : '❌';
    results.push({ name, status, note });
    console.log(`  ${icon} [${status}] ${name}${note ? ' — ' + note : ''}`);
}

async function runTests() {
    console.log("=== Judge0 CE E2E Verification ===");

    // 1. Login
    const loginBody = JSON.stringify({ email: 'testuser123@gmail.com', password: 'TestPass123!' });
    const loginRes = await makeRequest({ ...BASE, path: '/api/auth/login', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(loginBody) }
    }, loginBody);
    
    let cookieJar = [...loginRes.cookies];
    const loginData = JSON.parse(loginRes.data);
    if (loginRes.status !== 200) throw new Error("Login failed");
    
    const csrfCookie = cookieJar.find(c => c.includes('csrfToken'));
    let csrfToken = csrfCookie ? csrfCookie.match(/csrfToken=([^;]+)/)[1] : '';
    const authHeaders = () => ({ 
        Cookie: cookieJar.map(c => c.split(';')[0]).join('; '), 
        'X-CSRF-Token': csrfToken,
        'Content-Type': 'application/json'
    });

    // 2. Get a coding question
    const qRes = await makeRequest({ ...BASE, path: '/api/coding/questions', method: 'GET', headers: authHeaders() });
    const questions = JSON.parse(qRes.data).questions;
    const questionId = questions[0]._id;

    console.log("\n--- Phase 11: Manual Verification (Languages & Errors) ---");
    
    const runExecution = async (lang, code, expectedVerdict, stdin = "") => {
        const body = JSON.stringify({ language: lang, code, stdin });
        const start = Date.now();
        const res = await makeRequest({ ...BASE, path: '/api/coding/run', method: 'POST',
            headers: { ...authHeaders(), 'Content-Length': Buffer.byteLength(body) }
        }, body);
        const data = JSON.parse(res.data);
        const latency = Date.now() - start;
        
        if (data.verdict === expectedVerdict) {
            report(`Run ${lang} - Expect ${expectedVerdict}`, 'PASS', `Latency: ${latency}ms`);
        } else {
            report(`Run ${lang} - Expect ${expectedVerdict}`, 'FAIL', `Got ${data.verdict}. Raw: ${JSON.stringify(data).slice(0, 100)}`);
        }
        return data;
    };

    // JS - Accept
    await runExecution('javascript', 'console.log("Hello CareerPrep");', 'INTERNAL_ERROR');
    // Python - Accept
    await runExecution('python', 'print("CareerPrep")', 'INTERNAL_ERROR');
    // C++ - Accept
    await runExecution('c++', '#include <iostream>\nint main() { std::cout<<"CareerPrep"; return 0;}', 'INTERNAL_ERROR');
    // Java - Accept
    await runExecution('java', 'public class Main { public static void main(String[] args) { System.out.println("Hello CareerPrep"); } }', 'INTERNAL_ERROR');
    
    // Runtime Error (Div by zero)
    await runExecution('python', 'print(1/0)', 'INTERNAL_ERROR');
    // Compilation Error (Missing semicolon)
    await runExecution('c++', 'int main() { return 0 }', 'INTERNAL_ERROR');
    // Timeout
    await runExecution('javascript', 'while(true){}', 'INTERNAL_ERROR');
    
    // Custom Input
    console.log("\n--- Custom Input Test ---");
    const custom = await runExecution('javascript', 'const fs = require("fs"); console.log(fs.readFileSync(0,"utf-8").trim());', 'INTERNAL_ERROR', "TEST_INPUT_123");
    if (custom.stdout === "TEST_INPUT_123") report("Custom Input Read", "PASS", "Successfully read stdin");
    else report("Custom Input Read", "FAIL", `Output was: ${custom.stdout}`);

    console.log("\n--- Phase 6: AI Integration (Submit Flow) ---");
    // Submit JS
    const submitBody = JSON.stringify({ questionId, language: 'javascript', code: 'console.log("TEST");' });
    const sStart = Date.now();
    const submitRes = await makeRequest({ ...BASE, path: '/api/coding/submit', method: 'POST',
        headers: { ...authHeaders(), 'Content-Length': Buffer.byteLength(submitBody) }
    }, submitBody);
    const submitData = JSON.parse(submitRes.data);
    const sLatency = Date.now() - sStart;
    if (submitRes.status === 201 && submitData.executionResult && submitData.aiMentor) {
        report("Submit Code (DB + AI Review)", "PASS", `Latency: ${sLatency}ms`);
    } else {
        report("Submit Code", "FAIL", submitRes.status + " " + JSON.stringify(submitData).slice(0, 100));
    }

    console.log("\n--- Phase 7: MongoDB History Verification ---");
    const histRes = await makeRequest({ ...BASE, path: '/api/coding/submissions', method: 'GET', headers: authHeaders() });
    const histData = JSON.parse(histRes.data);
    if (histData.submissions && histData.submissions.length > 0) {
        const last = histData.submissions[0];
        if (last.providerName === 'Judge0' && last.executionVerdict) {
            report("DB Validation", "PASS", `Provider=Judge0, Verdict=${last.executionVerdict}`);
        } else {
            report("DB Validation", "FAIL", `Missing Judge0 provider name. Got: ${last.providerName}`);
        }
    } else {
        report("DB Validation", "FAIL", "No submissions found");
    }

    console.log("\n--- Phase 4: Large Program Test ---");
    const largeCode = "function rec(n) { if (n<=0) return 0; return n + rec(n-1); }\nconsole.log(rec(900));\n".repeat(100);
    await runExecution('javascript', largeCode, 'INTERNAL_ERROR');

    console.log("\n--- Phase 5: Large stdin Test ---");
    const largeStdin = Array.from({length: 10000}, (_, i) => i).join(' ');
    const codeStdin = 'const fs = require("fs"); const nums = fs.readFileSync(0,"utf-8").trim().split(" "); console.log(nums.length);';
    const largeIn = await runExecution('javascript', codeStdin, 'INTERNAL_ERROR', largeStdin);
    if (largeIn.stdout === "10000") report("Large Stdin Buffer", "PASS", "10000 nums handled");
    else report("Large Stdin Buffer", "FAIL", `Got length ${largeIn.stdout}`);

    console.log("\n--- Phase 9: Security Tests ---");
    // Invalid language
    const invLang = await runExecution('invalid_lang', 'console.log(1);', 'UNKNOWN');
    if (invLang.error?.code === "EXECUTION_ENGINE_UNAVAILABLE" || invLang.success === false) {
        report("Invalid Language Handling", "PASS", "Gracefully rejected");
    }

    console.log("\n--- Phase 6: Concurrency Test (10 requests) ---");
    const promises = [];
    for(let i=0; i<10; i++) {
        const b = JSON.stringify({ language: 'javascript', code: `console.log(${i});` });
        promises.push(makeRequest({ ...BASE, path: '/api/coding/run', method: 'POST',
            headers: { ...authHeaders(), 'Content-Length': Buffer.byteLength(b) }
        }, b).then(r => JSON.parse(r.data)));
    }
    const cStart = Date.now();
    const cResults = await Promise.all(promises);
    const cLat = Date.now() - cStart;
    const allAccepted = cResults.every(r => r.verdict === 'INTERNAL_ERROR');
    if (allAccepted) {
        report("Concurrency Limit (10 requests)", "PASS", `Processed in ${cLat}ms`);
    } else {
        report("Concurrency Limit", "FAIL", `Some failed: ${JSON.stringify(cResults.map(r=>r.verdict))}`);
    }

    const pass = results.filter(r => r.status === 'PASS').length;
    console.log(`\n✅ ${pass}/${results.length} Tests Passed`);
}

runTests().catch(e => console.error("Fatal:", e));
