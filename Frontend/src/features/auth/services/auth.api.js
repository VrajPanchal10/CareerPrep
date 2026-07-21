import api from "../../../utils/apiClient";

export async function register({ username, email, password }) {
    try {
        const response = await api.post('/api/auth/register', {
            username, email, password
        })
        return response.data
    } catch (err) {
        throw err;
    }
}

export async function login({ email, password, rememberMe }) {
    try {
        const response = await api.post("/api/auth/login", {
            email, password, rememberMe
        })
        return response.data
    } catch (err) {
        throw err;
    }
}

export async function logout() {
    try {
        const response = await api.get("/api/auth/logout")
        return response.data
    } catch (err) {
        throw err;
    }
}

export async function getMe() {
    try {
        const response = await api.get("/api/auth/get-me")
        return response.data
    } catch (err) {
        // 401 = no active session (expected for unauthenticated visitors).
        // Log only unexpected errors so the console is not polluted on every page load.
        if (err.response?.status !== 401) {
            console.error("[auth.api] getMe unexpected error:", err);
        }
        throw err;
    }
}

export async function forgotPassword({ email }) {
    try {
        const response = await api.post("/api/auth/forgot-password", { email });
        return response.data;
    } catch (err) {
        throw err;
    }
}

export async function resetPassword({ token, password }) {
    try {
        const response = await api.post("/api/auth/reset-password", { token, password });
        return response.data;
    } catch (err) {
        throw err;
    }
}

export async function validateResetToken(token) {
    try {
        const response = await api.get(`/api/auth/reset-password/validate/${token}`);
        return response.data;
    } catch (err) {
        throw err;
    }
}

export async function enableMfa() {
    try {
        const response = await api.post("/api/auth/mfa/enable", {});
        return response.data;
    } catch (err) {
        throw err;
    }
}

export async function confirmMfa({ code }) {
    try {
        const response = await api.post("/api/auth/mfa/confirm", { code });
        return response.data;
    } catch (err) {
        throw err;
    }
}

export async function disableMfa() {
    try {
        const response = await api.post("/api/auth/mfa/disable", {});
        return response.data;
    } catch (err) {
        throw err;
    }
}

export async function verifyMfa({ mfaToken, code }) {
    try {
        const response = await api.post("/api/auth/mfa/verify", { mfaToken, code });
        return response.data;
    } catch (err) {
        throw err;
    }
}