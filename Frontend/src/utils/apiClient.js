import axios from "axios";

// ─── Axios Instance ───────────────────────────────────────────────────────────
export const getApiBaseUrl = () => {
    return import.meta.env.VITE_API_URL || "http://localhost:3000";
};

const BASE_URL = getApiBaseUrl();

const apiClient = axios.create({
    baseURL: BASE_URL,
    withCredentials: true,
});

// ─── CSRF In-Memory Store ─────────────────────────────────────────────────────
let memoryCsrfToken = null;
let hasBootstrappedCsrf = false;

// ─── Request Interceptor: Inject CSRF Token ───────────────────────────────────
const CSRF_METHODS = ["post", "put", "delete", "patch"];

apiClient.interceptors.request.use(async (config) => {
    if (CSRF_METHODS.includes(config.method?.toLowerCase())) {
        // Single attempt to bootstrap from the backend if missing
        if (!memoryCsrfToken && !hasBootstrappedCsrf) {
            hasBootstrappedCsrf = true;
            try {
                const response = await axios.get(`${BASE_URL}/api/auth/get-me`, { withCredentials: true });
                if (response.data && response.data.csrfToken) {
                    memoryCsrfToken = response.data.csrfToken;
                }
            } catch (err) {
                // Fail silently; request will proceed and fail natively with 403
            }
        }

        if (memoryCsrfToken) {
            config.headers.set("X-CSRF-Token", memoryCsrfToken);
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
    (response) => {
        const url = response.config.url || "";
        
        // Target specifically the endpoints that issue a new token
        if (url.includes("/login") || url.includes("/refresh") || url.includes("/get-me")) {
            if (response.data && response.data.csrfToken) {
                memoryCsrfToken = response.data.csrfToken;
                hasBootstrappedCsrf = true;
            }
        }
        
        // Destroy orphaned memory token strictly on logout
        if (url.includes("/logout")) {
            memoryCsrfToken = null;
            hasBootstrappedCsrf = false;
        }
        
        return response;
    },
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
                const response = await axios.get(
                    `${BASE_URL}/api/auth/get-me`,
                    { withCredentials: true }
                );
                
                if (response.data && response.data.csrfToken) {
                    memoryCsrfToken = response.data.csrfToken;
                    hasBootstrappedCsrf = true;
                }
                
                if (memoryCsrfToken && CSRF_METHODS.includes(originalRequest.method?.toLowerCase())) {
                    originalRequest.headers.set("X-CSRF-Token", memoryCsrfToken);
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
                const refreshResponse = await axios.post(
                    `${BASE_URL}/api/auth/refresh`,
                    {},
                    { withCredentials: true }
                );

                if (refreshResponse.data && refreshResponse.data.csrfToken) {
                    memoryCsrfToken = refreshResponse.data.csrfToken;
                    hasBootstrappedCsrf = true;
                }

                processQueue(null);
                isRefreshing = false;

                // Retry original request — re-attach the refreshed CSRF token
                if (memoryCsrfToken && CSRF_METHODS.includes(originalRequest.method?.toLowerCase())) {
                    originalRequest.headers.set("X-CSRF-Token", memoryCsrfToken);
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
        if (error.response?.data instanceof Blob && error.response.data.type === 'application/json') {
            try {
                const text = await error.response.data.text();
                const json = JSON.parse(text);
                error.userMessage = json.message || json.error?.message || error.message || "An unexpected error occurred.";
            } catch (e) {
                error.userMessage = error.message || "An unexpected error occurred.";
            }
        } else {
            error.userMessage =
                error.response?.data?.message ||
                error.response?.data?.error?.message ||
                error.message ||
                "An unexpected error occurred. Please try again.";
        }

        return Promise.reject(error);
    }
);

export default apiClient;
