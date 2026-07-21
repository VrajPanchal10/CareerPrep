import axios from "axios";

// ─── Axios Instance ───────────────────────────────────────────────────────────
const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
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
    return match ? match.split("=")[1] : null;
}

// ─── Request Interceptor: Inject CSRF Token ───────────────────────────────────
// CSRF protection only applies to mutating methods. GET/HEAD are read-only
// and do not require a CSRF token per the backend middleware spec.
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

// ─── Response Interceptor: Token Refresh + Error Normalization ────────────────
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error) => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve();
        }
    });
    failedQueue = [];
};

apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // ── 401 Handling: Token Refresh ──────────────────────────────────────
        if (error.response?.status === 401 && !originalRequest._retry) {
            // Avoid refresh loops on auth-specific endpoints
            if (
                originalRequest.url &&
                (
                    originalRequest.url.includes("/api/auth/login") ||
                    originalRequest.url.includes("/api/auth/register") ||
                    originalRequest.url.includes("/api/auth/get-me") ||
                    originalRequest.url.includes("/api/auth/refresh")
                )
            ) {
                return Promise.reject(error);
            }

            // Omit token refresh if on login or register pages
            const path = window.location.pathname;
            if (path === "/login" || path === "/register") {
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
                    `${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/auth/refresh`,
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
        // Provides a consistent, human-readable error message on every Axios error.
        // Hooks can use `err.userMessage` instead of repeating `err.response?.data?.message`.
        // The original error shape is preserved for backward compatibility.
        error.userMessage =
            error.response?.data?.message ||
            error.response?.data?.error?.message ||
            error.message ||
            "An unexpected error occurred. Please try again.";

        return Promise.reject(error);
    }
);

export default apiClient;
