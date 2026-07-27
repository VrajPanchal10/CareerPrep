import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router';
import "../auth.form.scss";
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../../../context/ToastContext';
import { PasswordInput, LoadingButton, HelpTooltip } from '../../../components/ui';

const Login = () => {
    const { loading, handleLogin } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { addToast } = useToast();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [rememberMe, setRememberMe] = useState(false);

    // Trigger toast if navigated from a successful password reset
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (location.state?.resetSuccess || params.get("reset") === "success") {
            addToast("Password Updated", "success");
            window.history.replaceState({}, document.title);
        }
    }, [location, addToast]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const data = await handleLogin({ email, password, rememberMe });
            if (data && data.user) {
                navigate('/');
            }
        } catch (err) {
            // Error toasts are handled in useAuth hook
        }
    };

    return (
        <main>
            <div className="form-container">
                <h1>Login</h1>
                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label htmlFor="email">Email</label>
                        <input
                            value={email}
                            onChange={(e) => { setEmail(e.target.value); }}
                            type="email" 
                            id="email" 
                            name='email' 
                            placeholder='Enter email address' 
                            required 
                        />
                    </div>
                    <div className="input-group">
                        <label htmlFor="password" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            Password
                            <HelpTooltip term="" text="Enter your account password securely." />
                        </label>
                        <PasswordInput
                            value={password}
                            onChange={(e) => { setPassword(e.target.value); }}
                            id="password" 
                            name='password' 
                            placeholder='Enter password' 
                            required 
                        />
                    </div>
                    <div className="auth-options-row">
                        <div className="remember-me-group">
                            <input 
                                type="checkbox" 
                                id="rememberMe" 
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                            />
                            <label htmlFor="rememberMe">
                                Remember Me
                            </label>
                        </div>
                        <Link to="/forgot-password" className="forgot-password-link">
                            Forgot password?
                        </Link>
                    </div>
                    <LoadingButton 
                        type="submit"
                        loading={loading}
                        loadingText="Logging in..."
                        className="button primary-button"
                        id="loginSubmitBtn"
                    >
                        Login
                    </LoadingButton>
                </form>
                <p>Don't have an account? <Link to={"/register"}>Register</Link> </p>
            </div>
        </main>
    );
};

export default Login;