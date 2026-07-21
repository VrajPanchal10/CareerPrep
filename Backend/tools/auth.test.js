require("dotenv").config();
const http = require("http");
const assert = require("assert");
const mongoose = require("mongoose");
const authMiddlewarePath = require.resolve("../src/middlewares/auth.middleware");
const originalAuthMiddleware = require(authMiddlewarePath);
require.cache[authMiddlewarePath] = {
    id: authMiddlewarePath,
    filename: authMiddlewarePath,
    loaded: true,
    exports: {
        ...originalAuthMiddleware,
        authLimiter: (req, res, next) => next()
    }
};

const connectToDB = require("../src/config/database");
const app = require("../src/app");
const userModel = require("../src/models/user.model");
const tokenBlacklistModel = require("../src/models/blacklist.model");

// Create integration test runner
const server = http.createServer(app);

server.listen(0, async () => {
    const port = server.address().port;
    console.log(`[TEST_SERVER] Started auth integration server on port ${port}`);

    try {
        await connectToDB();
        await runAuthTests(port);
        console.log("\n=========================================");
        console.log("SUCCESS: ALL INTEGRATION AUTHENTICATION TESTS PASSED!");
        console.log("=========================================\n");
        server.close();
        await mongoose.connection.close();
        process.exit(0);
    } catch (err) {
        console.error("\n=========================================");
        console.error("FAIL: INTEGRATION AUTHENTICATION TESTS FAILED!");
        console.error(err);
        console.error("=========================================\n");
        server.close();
        await mongoose.connection.close();
        process.exit(1);
    }
});

// Helper to handle requests cleanly
async function makeRequest(port, method, path, headers = {}, body = null) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            port,
            method,
            path,
            headers: {
                "Content-Type": "application/json",
                ...headers
            }
        }, (res) => {
            let data = "";
            res.on("data", chunk => data += chunk);
            res.on("end", () => {
                let parsed = data;
                try {
                    parsed = JSON.parse(data);
                } catch (_) {}
                resolve({ status: res.statusCode, headers: res.headers, body: parsed });
            });
        });
        req.on("error", reject);
        if (body) {
            req.write(typeof body === "string" ? body : JSON.stringify(body));
        }
        req.end();
    });
}

// Extract cookies utility
function getCookieValue(headers, cookieName) {
    const setCookie = headers["set-cookie"];
    if (!setCookie) return null;
    for (const cookieStr of setCookie) {
        if (cookieStr.startsWith(`${cookieName}=`)) {
            return cookieStr.split(";")[0].split("=")[1];
        }
    }
    return null;
}

// Tests definition
async function runAuthTests(port) {
    const testEmail = `test_security_auth_${Date.now()}@careerprep.org`;
    const testUsername = `test_user_auth_${Date.now()}`;
    const initialPassword = "SecurePassword123";

    console.log(`[TEST] Email to register: ${testEmail}`);

    // Clean any residue
    await userModel.deleteMany({ email: testEmail });

    // 1. REGISTER
    console.log("[TEST] Testing Register Route...");
    const regRes = await makeRequest(port, "POST", "/api/auth/register", {}, {
        username: testUsername,
        email: testEmail,
        password: initialPassword
    });
    assert.strictEqual(regRes.status, 201);
    assert.ok(regRes.body.user);
    assert.strictEqual(regRes.body.user.email, testEmail);

    let authCookie = getCookieValue(regRes.headers, "token");
    assert.ok(authCookie, "Token cookie was not returned upon registration.");

    // 2. GET-ME (Verify Session)
    console.log("[TEST] Testing Get-Me Profile Details Route...");
    const meRes = await makeRequest(port, "GET", "/api/auth/get-me", {
        Cookie: `token=${authCookie}`
    });
    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meRes.body.user.email, testEmail);
    assert.strictEqual(meRes.body.user.mfaEnabled, false);
    assert.ok(meRes.body.user.sessionMetadata);

    // 3. FORGOT PASSWORD (Safe leak responses)
    console.log("[TEST] Testing Forgot Password Enumeration Safety...");
    const forgotRes = await makeRequest(port, "POST", "/api/auth/forgot-password", {}, {
        email: testEmail
    });
    assert.strictEqual(forgotRes.status, 200);
    assert.strictEqual(
        forgotRes.body.message,
        "If an account exists with that email address, a password reset link has been sent."
    );

    // Check reset token was compiled in database
    const dbUser = await userModel.findOne({ email: testEmail });
    assert.ok(dbUser.resetPasswordToken);
    assert.ok(dbUser.resetPasswordExpires > new Date());

    // 4. RESET PASSWORD (Policy & verify resets)
    console.log("[TEST] Testing Reset Password Complexity Policy Constraints...");
    // A. Invalid password complexity policy test
    const resetFailRes = await makeRequest(port, "POST", "/api/auth/reset-password", {}, {
        token: "some-raw-token",
        password: "short"
    });
    assert.strictEqual(resetFailRes.status, 400);
    assert.ok(resetFailRes.body.message.includes("at least 8 characters"));

    // B. Correct password update verify
    console.log("[TEST] Submitting successful password reset using direct database token lookup...");
    // We fetch the reset token from database to bypass SMTP send logic
    const dbUserReset = await userModel.findOne({ email: testEmail });
    
    // Mock token matching since we only hash in db. In actual flow, we compare plain token.
    // Let's create a raw token manually and save its hash to user record.
    const crypto = require("crypto");
    const rawResetToken = crypto.randomBytes(32).toString("hex");
    const hashedResetToken = crypto.createHash("sha256").update(rawResetToken).digest("hex");
    
    dbUserReset.resetPasswordToken = hashedResetToken;
    dbUserReset.resetPasswordExpires = Date.now() + 3600000;
    await dbUserReset.save();

    const resetSuccessRes = await makeRequest(port, "POST", "/api/auth/reset-password", {}, {
        token: rawResetToken,
        password: "NewSuperPassword123"
    });
    assert.strictEqual(resetSuccessRes.status, 200);
    assert.strictEqual(resetSuccessRes.body.message, "Password updated successfully. Please login.");

    // Confirm DB token got consumed & invalidated
    const dbUserAfterReset = await userModel.findOne({ email: testEmail });
    assert.strictEqual(dbUserAfterReset.resetPasswordToken, null);
    assert.strictEqual(dbUserAfterReset.resetPasswordExpires, null);
    assert.strictEqual(dbUserAfterReset.refreshSessions.length, 0); // Forced logout rotation completed

    // 5. LOGIN (New Credentials)
    console.log("[TEST] Testing Login with new credentials...");
    const loginRes = await makeRequest(port, "POST", "/api/auth/login", {}, {
        email: testEmail,
        password: "NewSuperPassword123"
    });
    assert.strictEqual(loginRes.status, 200);
    authCookie = getCookieValue(loginRes.headers, "token");
    assert.ok(authCookie);

    // 6. SLIDING TOKEN REFRESH & ROTATION
    console.log("[TEST] Testing Session Refresh Token Rotation...");
    const refreshRes = await makeRequest(port, "POST", "/api/auth/refresh", {
        Cookie: `token=${authCookie}`
    });
    assert.strictEqual(refreshRes.status, 200);
    
    const newAuthCookie = getCookieValue(refreshRes.headers, "token");
    assert.ok(newAuthCookie);
    assert.notStrictEqual(authCookie, newAuthCookie, "Refresh Token did not rotate session identifier.");

    authCookie = newAuthCookie; // Use rotated token

    // 7. MULTI-FACTOR AUTHENTICATION (MFA Setup)
    console.log("[TEST] Testing MFA Setup & Enablement...");
    const mfaEnableRes = await makeRequest(port, "POST", "/api/auth/mfa/enable", {
        Cookie: `token=${authCookie}`
    });
    assert.strictEqual(mfaEnableRes.status, 200);
    assert.ok(mfaEnableRes.body.secret);
    assert.ok(mfaEnableRes.body.qrCode.startsWith("data:image/png;base64,"));

    // Log out initial session before enabling MFA to keep active sessions clean
    console.log("[TEST] Logging out initial session...");
    const initialLogoutRes = await makeRequest(port, "GET", "/api/auth/logout", {
        Cookie: `token=${authCookie}`
    });
    assert.strictEqual(initialLogoutRes.status, 200);

    // Re-login to obtain a fresh session for MFA setup
    console.log("[TEST] Re-logging in to configure MFA...");
    const reloginRes = await makeRequest(port, "POST", "/api/auth/login", {}, {
        email: testEmail,
        password: "NewSuperPassword123"
    });
    assert.strictEqual(reloginRes.status, 200);
    authCookie = getCookieValue(reloginRes.headers, "token");
    assert.ok(authCookie);

    // Verify confirmation flow
    const otplibObj = require("otplib");
    const mfaSecret = mfaEnableRes.body.secret;
    const testTotpCode = await otplibObj.generate({ secret: mfaSecret });

    console.log("[TEST] Confirming MFA using generated TOTP code...");
    const mfaConfirmRes = await makeRequest(port, "POST", "/api/auth/mfa/confirm", {
        Cookie: `token=${authCookie}`
    }, {
        code: testTotpCode
    });
    assert.strictEqual(mfaConfirmRes.status, 200);
    assert.ok(mfaConfirmRes.body.recoveryCodes);
    assert.strictEqual(mfaConfirmRes.body.recoveryCodes.length, 8);

    const mfaRecoveryCodes = mfaConfirmRes.body.recoveryCodes;

    // Check DB state
    const dbUserMfa = await userModel.findOne({ email: testEmail });
    assert.strictEqual(dbUserMfa.mfaEnabled, true);
    // Log out configuration session before starting the MFA login test
    console.log("[TEST] Logging out configuration session...");
    const configLogoutRes = await makeRequest(port, "GET", "/api/auth/logout", {
        Cookie: `token=${authCookie}`
    });
    assert.strictEqual(configLogoutRes.status, 200);

    // 8. MFA LOGIN INTERCEPTION
    console.log("[TEST] Testing login with active MFA protection...");
    const mfaLoginRes = await makeRequest(port, "POST", "/api/auth/login", {}, {
        email: testEmail,
        password: "NewSuperPassword123"
    });
    assert.strictEqual(mfaLoginRes.status, 200);
    assert.strictEqual(mfaLoginRes.body.mfaRequired, true);
    assert.ok(mfaLoginRes.body.mfaToken);

    const mfaToken = mfaLoginRes.body.mfaToken;

    // 9. MFA RATE LIMIT LOCKOUTS (5 Failed Attempts)
    console.log("[TEST] Testing MFA Rate Limitlockout increments...");
    for (let i = 0; i < 4; i++) {
        const failRes = await makeRequest(port, "POST", "/api/auth/mfa/verify", {}, {
            mfaToken,
            code: "000000" // Wrong code
        });
        assert.strictEqual(failRes.status, 400);
        assert.ok(failRes.body.message.includes("attempts remaining"));
    }

    // 5th attempt trigger lockout
    console.log("[TEST] Sending 5th failed MFA attempt to verify 15-minute lock trigger...");
    const finalFailRes = await makeRequest(port, "POST", "/api/auth/mfa/verify", {}, {
        mfaToken,
        code: "000000"
    });
    assert.strictEqual(finalFailRes.status, 403);
    assert.ok(finalFailRes.body.message.includes("locked out"));

    // Invalidate lockout in database to continue testing verify recovery keys
    const dbUserLock = await userModel.findOne({ email: testEmail });
    dbUserLock.mfaFailedAttempts = 0;
    dbUserLock.mfaLockoutUntil = null;
    await dbUserLock.save();

    // 10. MFA RECOVERY CODE USE (Invalidate on use)
    console.log("[TEST] Testing login completion using raw recovery code...");
    const recoveryCode = mfaRecoveryCodes[0];
    const recoverVerifyRes = await makeRequest(port, "POST", "/api/auth/mfa/verify", {}, {
        mfaToken,
        code: recoveryCode
    });
    assert.strictEqual(recoverVerifyRes.status, 200);
    
    authCookie = getCookieValue(recoverVerifyRes.headers, "token");
    assert.ok(authCookie);

    // Verify recovery code was consumed and deleted from database list
    const dbUserConsumed = await userModel.findOne({ email: testEmail });
    assert.strictEqual(dbUserConsumed.mfaRecoveryCodes.length, 7);

    // 11. LOGOUT COOKIE CLEANUP & LIST CLEAR
    console.log("[TEST] Testing Logout cookie cleanup & sessions registry deletion...");
    const logoutRes = await makeRequest(port, "GET", "/api/auth/logout", {
        Cookie: `token=${authCookie}`
    });
    assert.strictEqual(logoutRes.status, 200);
    
    // Confirm sessionId got deleted from db list
    const dbUserLogout = await userModel.findOne({ email: testEmail });
    assert.strictEqual(dbUserLogout.refreshSessions.length, 0);

    // Cleanup user
    await userModel.deleteMany({ email: testEmail });
    console.log("[TEST] Integration cleanups completed.");
}
