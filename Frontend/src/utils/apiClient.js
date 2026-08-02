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

        // Auto-unwrap JSON error responses when responseType is 'blob'
        if (error.response?.data instanceof Blob && (error.response.data.type?.includes("json") || error.response.data.type === "")) {
            try {
                const text = await error.response.data.text();
                const json = JSON.parse(text);
                error.response.data = json;
            } catch (e) {
                // If text is not valid JSON, leave error.response.data as is
            }
        }

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

                // Ensure refreshError is normalized with userMessage and string message
                if (refreshError && typeof refreshError === "object") {
                    refreshError.userMessage = refreshError.userMessage || refreshError.response?.data?.message || "Session expired. Please log in again.";
                    refreshError.errorCode = refreshError.errorCode || refreshError.response?.data?.code || "SESSION_EXPIRED";
                    if (!refreshError.message || refreshError.message === "[object Object]") {
                        refreshError.message = refreshError.userMessage;
                    }
                }

                return Promise.reject(refreshError);
            }
        }

        // ── Error Normalization: Network, Timeout, Server & Structured Backend Codes ───
        let userMessage = null;
        let errorCode = error.response?.data?.code || null;

        if (typeof window !== "undefined" && window.navigator && window.navigator.onLine === false) {
            userMessage = "No internet connection. Please check your network and try again.";
            errorCode = "OFFLINE";
        } else if (error.code === "ERR_NETWORK" || error.message === "Network Error" || (!error.response && !error.code)) {
            userMessage = "No internet connection. Please check your network and try again.";
            errorCode = "OFFLINE";
        } else if (error.code === "ECONNABORTED" || (error.message && error.message.toLowerCase().includes("timeout"))) {
            userMessage = "The request timed out. Please try again.";
            errorCode = "TIMEOUT";
        } else if (error.response?.status === 429 || errorCode === "TOO_MANY_ATTEMPTS") {
            userMessage = "Too many attempts. Please try again later.";
            errorCode = "TOO_MANY_ATTEMPTS";
        } else if (error.response?.status === 503 || errorCode === "AI_UNAVAILABLE") {
            userMessage = "AI service is temporarily unavailable. Please try again in a few moments.";
            errorCode = "AI_UNAVAILABLE";
        } else if (error.response?.status >= 500) {
            userMessage = error.response?.data?.message || "Something went wrong on our server. Please try again later.";
            errorCode = errorCode || "SERVER_ERROR";
        }

        if (!userMessage) {
            if (error.response?.data instanceof Blob && error.response.data.type === "application/json") {
                try {
                    const text = await error.response.data.text();
                    const json = JSON.parse(text);
                    userMessage = json.message || json.error?.message || "An unexpected error occurred.";
                    errorCode = json.code || errorCode;
                } catch (e) {
                    userMessage = "An unexpected error occurred. Please try again.";
                }
            } else {
                userMessage =
                    error.response?.data?.message ||
                    error.response?.data?.error?.message ||
                    error.message ||
                    "An unexpected error occurred. Please try again.";
            }
        }

        error.userMessage = userMessage;
        error.errorCode = errorCode;

        return Promise.reject(error);
    }
);

/**
 * Standardized helper to resolve a truthful, user-friendly error message from any error object
 */
export const formatErrorMessage = (error, defaultFallback = "An unexpected error occurred. Please try again.") => {
    if (!error) return defaultFallback;
    if (error.userMessage) return error.userMessage;
    if (typeof error === "string") return error;
    if (error.response?.data?.message) return error.response.data.message;
    if (error.message) return error.message;
    return defaultFallback;
};

export default apiClient;

