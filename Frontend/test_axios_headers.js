import axios from "axios";
import http from "http";
import FormData from "form-data"; // Use Node form-data equivalent for simulation

// 1. Setup a dummy HTTP server to capture the EXACT headers Axios generates
const server = http.createServer((req, res) => {
    console.log("=== INCOMING HEADERS TO BACKEND ===");
    console.log("X-CSRF-Token:", req.headers["x-csrf-token"] || "MISSING!");
    console.log("Content-Type:", req.headers["content-type"] || "MISSING!");
    res.writeHead(200);
    res.end();
});

server.listen(0, async () => {
    const port = server.address().port;
    const BASE_URL = `http://localhost:${port}`;

    // 2. Exact apiClient.js setup
    const apiClient = axios.create({
        baseURL: BASE_URL,
        withCredentials: true,
    });

    const CSRF_METHODS = ["post", "put", "delete", "patch"];

    apiClient.interceptors.request.use((config) => {
        // Log if config.headers is an AxiosHeaders instance
        console.log("=== AXIOS INTERCEPTOR EXECUTION ===");
        console.log("Is config.headers an AxiosHeaders instance?", config.headers.constructor.name === "AxiosHeaders");

        if (CSRF_METHODS.includes(config.method?.toLowerCase())) {
            const csrfToken = "tok_dummy123";
            
            // This is the exact code in your apiClient.js
            config.headers["X-CSRF-Token"] = csrfToken; 
            
            console.log("Interceptor assigned header via bracket notation.");
        }
        return config;
    });

    // 3. Exact API call from interview.api.js
    const formData = new FormData();
    formData.append("test", "data");

    console.log("\n--- FIRING REQUEST ---");
    try {
        await apiClient.post("/", formData, {
            headers: {
                "Content-Type": "multipart/form-data"
            }
        });
    } catch (err) {
        console.error(err.message);
    }

    server.close();
});
