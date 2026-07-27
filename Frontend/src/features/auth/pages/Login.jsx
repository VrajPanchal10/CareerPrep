import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router'
import "../auth.form.scss"
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../../../context/ToastContext'
import { PasswordInput, LoadingButton, HelpTooltip } from '../../../components/ui'

const Login = () => {
    const { loading, handleLogin, handleMfaVerify } = useAuth()
    const navigate = useNavigate()
    const { addToast } = useToast()

    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [rememberMe, setRememberMe] = useState(false)

    // Trigger toast if navigated from a successful password reset
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (location.state?.resetSuccess || params.get("reset") === "success") {
            addToast("Password Updated", "success");
            window.history.replaceState({}, document.title);
        }
    }, [location, addToast]);

    // MFA Verification state parameters
    const [mfaRequired, setMfaRequired] = useState(false)
    const [mfaToken, setMfaToken] = useState("")
    const [mfaCode, setMfaCode] = useState("")
    const [verifyLoading, setVerifyLoading] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            const data = await handleLogin({ email, password, rememberMe })
            if (data && data.mfaRequired) {
                setMfaToken(data.mfaToken)
                setMfaRequired(true)
            } else if (data && data.user) {
                navigate('/')
            }
        } catch (err) {
            // Error toasts are handled in useAuth hook
        }
    }

    const handleVerifySubmit = async (e) => {
        e.preventDefault()
        setVerifyLoading(true)
        try {
            const data = await handleMfaVerify({ mfaToken, code: mfaCode })
            if (data && data.user) {
                navigate('/')
            }
        } catch (err) {
            // Error toasts are handled in useAuth hook
        } finally {
            setVerifyLoading(false)
        }
    }

    return (
        <main>
            <div className="form-container">
                {mfaRequired ? (
                    <>
                        <h1>Two-Step Verification</h1>
                        <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.7)", marginBottom: "1.5rem", textAlign: "center" }}>
                            Enter the 6-digit authenticator code or one of your backup recovery codes below.
                        </p>
                        <form onSubmit={handleVerifySubmit}>
                            <div className="input-group">
                                <label htmlFor="mfaCode">Verification Code</label>
                                <input
                                    value={mfaCode}
                                    onChange={(e) => setMfaCode(e.target.value)}
                                    type="text"
                                    id="mfaCode"
                                    placeholder="Enter 6-digit code or recovery key"
                                    required
                                    autoFocus
                                    style={{ letterSpacing: "1px", textAlign: "center" }}
                                />
                            </div>
                            <LoadingButton
                                type="submit"
                                loading={verifyLoading}
                                loadingText="Verifying..."
                                className="button primary-button"
                                id="mfaVerifySubmitBtn"
                            >
                                Verify & Log In
                            </LoadingButton>
                        </form>
                        <p style={{ marginTop: "1.5rem" }}>
                            Back to <span style={{ color: "#d20d3b", cursor: "pointer", textDecoration: "underline" }} onClick={() => setMfaRequired(false)}>Login Page</span>
                        </p>
                    </>
                ) : (
                    <>
                        <h1>Login</h1>
                        <form onSubmit={handleSubmit}>
                            <div className="input-group">
                                <label htmlFor="email">Email</label>
                                <input
                                    value={email}
                                    onChange={(e) => { setEmail(e.target.value) }}
                                    type="email" id="email" name='email' placeholder='Enter email address' required />
                            </div>
                            <div className="input-group">
                                <label htmlFor="password" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                    Password
                                    <HelpTooltip term="" text="Enter your account password securely." />
                                </label>
                                <PasswordInput
                                    value={password}
                                    onChange={(e) => { setPassword(e.target.value) }}
                                    id="password" name='password' placeholder='Enter password' required />
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
                        <p>Don't have an account? <Link to={"/register"} >Register</Link> </p>
                    </>
                )}
            </div>
        </main>
    )
}

export default Login