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

async function run() {
    try {
        let cookieJar = [];

        // Step 1: Login
        console.log('Step 1: Logging in as testuser123...');
        const loginBody = JSON.stringify({ email: 'testuser123@gmail.com', password: 'TestPass123!' });
        const loginRes = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: '/api/auth/login',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(loginBody),
            }
        }, loginBody);
        
        console.log('Login status:', loginRes.status);
        cookieJar = [...loginRes.cookies];
        
        let loginData;
        try {
            loginData = JSON.parse(loginRes.data);
        } catch(e) {
            console.log('Login response parse error:', loginRes.data.slice(0, 300));
            return;
        }

        if (loginRes.status !== 200) {
            console.log('Login failed:', loginData.message || loginRes.data);
            return;
        }
        console.log('Logged in as:', loginData.user?.username);

        // Step 2: Get fresh CSRF token from cookie jar
        const csrfCookie = cookieJar.find(c => c.includes('csrfToken'));
        let csrfToken = '';
        if (csrfCookie) {
            const match = csrfCookie.match(/csrfToken=([^;]+)/);
            csrfToken = match ? match[1] : '';
            console.log('CSRF token from cookie:', csrfToken ? 'found' : 'not found');
        }
        const cookieHeader = cookieJar.map(c => c.split(';')[0]).join('; ');

        // Step 3: Hit health endpoint
        console.log('\nStep 2: Calling GET /api/system/health...');
        const healthRes = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: '/api/system/health',
            method: 'GET',
            headers: {
                'Cookie': cookieHeader,
                'X-CSRF-Token': csrfToken
            }
        });
        
        console.log('Health check status:', healthRes.status);
        
        try {
            const health = JSON.parse(healthRes.data);
            if (!health.success) {
                console.log('Health check failed:', health.message, JSON.stringify(health.error));
                return;
            }
            console.log('Timestamp:', health.timestamp);
            console.log('\nProvider statuses:');
            Object.entries(health.providers || {}).forEach(([name, info]) => {
                const icon = info.status === 'healthy' ? '✅' 
                    : info.status === 'unconfigured' ? '⚠️ '
                    : info.status === 'degraded' ? '🟡'
                    : '❌';
                const extra = info.latencyMs !== undefined ? ` (${info.latencyMs}ms latency)` 
                    : info.error ? ` — ${info.error}`
                    : info.rateLimit ? ` (${info.rateLimit.remaining}/${info.rateLimit.limit} remaining)` 
                    : '';
                console.log(`  ${icon} ${name.padEnd(12)}: [${info.status}]${extra}`);
            });
        } catch(e) {
            console.log('Health response raw:', healthRes.data.slice(0, 500));
        }

    } catch (err) {
        console.error('Error:', err.message);
    }
}

run();
