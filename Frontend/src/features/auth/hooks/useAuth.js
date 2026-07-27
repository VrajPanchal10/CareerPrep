import { useContext } from "react";
import { AuthContext } from "../auth.context";
import { login, register, logout } from "../services/auth.api";
import { useToast } from "../../../context/ToastContext";

export const useAuth = () => {
    const context = useContext(AuthContext);
    const { user, setUser, loading, setLoading } = context;
    const { addToast } = useToast();

    const handleLogin = async ({ email, password, rememberMe }) => {
        setLoading(true);
        try {
            const data = await login({ email, password, rememberMe });
            if (data && data.user) {
                setUser(data.user);
                addToast("Login successful! Welcome back.", "success");
            }
            return data;
        } catch (err) {
            console.error("Login error:", err);
            addToast(err.response?.data?.message || "Invalid email or password. Please try again.", "error");
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async ({ username, email, password }) => {
        setLoading(true);
        try {
            const data = await register({ username, email, password });
            setUser(data.user);
            addToast("Registration Successful", "success");
            return data;
        } catch (err) {
            console.error("Registration error:", err);
            addToast(err.response?.data?.message || "Registration failed. Please try again.", "error");
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        setLoading(true);
        try {
            await logout();
            setUser(null);
            addToast("Logged Out", "info");
        } catch (err) {
            console.error("Logout error:", err);
            addToast("Failed to logout cleanly.", "warning");
        } finally {
            setLoading(false);
        }
    };

    return { user, setUser, loading, handleRegister, handleLogin, handleLogout };
};