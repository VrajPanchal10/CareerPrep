import apiClient from "../../../utils/apiClient";

export async function fetchProfile() {
    const response = await apiClient.get("/api/settings/profile");
    return response.data;
}

export async function updateProfile(data) {
    const response = await apiClient.put("/api/settings/profile", data);
    return response.data;
}

export async function updatePassword(data) {
    const response = await apiClient.put("/api/settings/password", data);
    return response.data;
}

export async function fetchPreferences() {
    const response = await apiClient.get("/api/settings/preferences");
    return response.data;
}

export async function updatePreferences(data) {
    const response = await apiClient.put("/api/settings/preferences", data);
    return response.data;
}

export async function fetchSecurity() {
    const response = await apiClient.get("/api/settings/security");
    return response.data;
}

export async function revokeDevice(id) {
    const response = await apiClient.delete(`/api/settings/device/${id}`);
    return response.data;
}

export async function revokeAllDevices() {
    const response = await apiClient.delete("/api/settings/devices");
    return response.data;
}

export async function fetchConnectedAccounts() {
    const response = await apiClient.get("/api/settings/connected-accounts");
    return response.data;
}

export async function exportData() {
    const response = await apiClient.get("/api/settings/export");
    return response.data;
}

export async function deleteAccount(password) {
    const response = await apiClient.post("/api/settings/delete-account", { password });
    return response.data;
}
