import axios from "axios";

// ─── Axios Instance ───────────────────────────────────────────────────────────
const BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.MODE === "production" ? "" : "http://localhost:3000");

const apiClient = axios.create({
    baseURL: BASE_URL,
    withCredentials: true,
});

// ─── CSRF Helper ──────────────────────────────────────────────────────────────
/**
 * Reads the csrfToken value from document cookies.
 * The backend sets this cookie on every authenticated response.
 * The CSRF middleware validates it against the X-CSRF-Token header.
 */
function getCsrfTokenFromCookie() {
    const match = document.cookie
        .split("; ")
        .find((row) => row.startsWith("csrfToken="));
    if (!match) return null;
    const value = match.split("=")[1];
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

// ─── Request Interceptor: Inject CSRF Token ───────────────────────────────────
const CSRF_METHODS = ["post", "put", "delete", "patch"];

apiClient.interceptors.request.use((config) => {
    if (CSRF_METHODS.includes(config.method?.toLowerCase())) {
        const csrfToken = getCsrfTokenFromCookie();
        if (csrfToken) {
            config.headers["X-CSRF-Token"] = csrfToken;
        }
    }
    return config;
});

// ─── Response Interceptor: Token Refresh + CSRF Auto-Recovery + Error Normalization ────────────────
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // ── Auto-recovery for CSRF Token Mismatch ────────────────────────────────
        if (
            error.response?.status === 403 &&
            typeof error.response?.data?.message === "string" &&
            error.response.data.message.includes("CSRF") &&
            !originalRequest._csrfRetry
        ) {
            originalRequest._csrfRetry = true;
            try {
                // Perform a quick GET request to bootstrap fresh CSRF cookie from backend
                await axios.get(
                    `${BASE_URL}/api/auth/get-me`,
                    { withCredentials: true }
                );
                const freshCsrfToken = getCsrfTokenFromCookie();
                if (freshCsrfToken && CSRF_METHODS.includes(originalRequest.method?.toLowerCase())) {
                    originalRequest.headers["X-CSRF-Token"] = freshCsrfToken;
                }
                return apiClient(originalRequest);
            } catch (csrfErr) {
                // If GET fails, fall through to normal error handling
            }
        }

        // ── 401 Unauthorized: Attempt Refresh ─────────────────────────────────
        if (error.response?.status === 401 && !originalRequest._retry) {
            if (originalRequest.url?.includes("/api/auth/login") || originalRequest.url?.includes("/api/auth/refresh")) {
                return Promise.reject(error);
            }

            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                })
                    .then(() => apiClient(originalRequest))
                    .catch((err) => Promise.reject(err));
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                await axios.post(
                    `${BASE_URL}/api/auth/refresh`,
                    {},
                    { withCredentials: true }
                );

                processQueue(null);
                isRefreshing = false;

                // Retry original request — re-attach the refreshed CSRF token
                const refreshedCsrfToken = getCsrfTokenFromCookie();
                if (refreshedCsrfToken && CSRF_METHODS.includes(originalRequest.method?.toLowerCase())) {
                    originalRequest.headers["X-CSRF-Token"] = refreshedCsrfToken;
                }

                return apiClient(originalRequest);
            } catch (refreshError) {
                processQueue(refreshError);
                isRefreshing = false;
                window.dispatchEvent(new Event("session-expired"));
                return Promise.reject(refreshError);
            }
        }

        // ── Error Normalization: Attach userMessage ───────────────────────────
        error.userMessage =
            error.response?.data?.message ||
            error.response?.data?.error?.message ||
            error.message ||
            "An unexpected error occurred. Please try again.";

        return Promise.reject(error);
    }
);

export default apiClient;
