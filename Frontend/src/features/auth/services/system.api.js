import api from "../../../utils/apiClient";

export async function fetchSystemHealth() {
    try {
        const response = await api.get("/api/system/health");
        return response.data;
    } catch (err) {
        throw err;
    }
}
