import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { resetPassword, validateResetToken } from '../services/auth.api';
import { useToast } from '../../../context/ToastContext';
import { PasswordInput, LoadingButton, HelpTooltip } from '../../../components/ui';
import "../auth.form.scss";

const ResetPassword = () => {
    const { token } = useParams();
    const navigate = useNavigate();
    const { addToast } = useToast();

    // Verification state
    const [tokenStatus, setTokenStatus] = useState("verifying"); // verifying, valid, expired, used, invalid
    const [statusMessage, setStatusMessage] = useState("");

    // Form inputs
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [redirectTimer, setRedirectTimer] = useState(3);
    const redirectIntervalRef = useRef(null);

    // Verify token validity on page load
    useEffect(() => {
        const verifyToken = async () => {
            try {
                await validateResetToken(token);
                setTokenStatus("valid");
            } catch (err) {
                console.error("Token verification failed on mount:", err);
                const errorType = err?.response?.data?.errorType;
                if (errorType === "EXPIRED") {
                    setTokenStatus("expired");
                } else if (errorType === "USED") {
                    setTokenStatus("used");
                } else {
                    setTokenStatus("invalid");
                }
                setStatusMessage(err?.response?.data?.message || "Invalid reset link.");
            }
        };
        if (token) {
            verifyToken();
        } else {
            setTokenStatus("invalid");
        }
    }, [token]);

    // Redirect countdown timer logic
    useEffect(() => {
        if (isSuccess && redirectTimer > 0) {
            redirectIntervalRef.current = setInterval(() => {
                setRedirectTimer(prev => {
                    if (prev <= 1) {
                        clearInterval(redirectIntervalRef.current);
                        navigate('/login?reset=success');
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => {
            if (redirectIntervalRef.current) clearInterval(redirectIntervalRef.current);
        };
    }, [isSuccess, navigate]);

    // Validation rules
    const rules = [
        { label: "8+ characters", test: (val) => val.length >= 8 },
        { label: "uppercase", test: (val) => /[A-Z]/.test(val) },
        { label: "lowercase", test: (val) => /[a-z]/.test(val) },
        { label: "number", test: (val) => /[0-9]/.test(val) },
        { label: "special character", test: (val) => /[!@#$%^&*(),.?":{}|<>]/.test(val) }
    ];

    // Compute active checks
    const checkedCount = rules.filter(r => r.test(password)).length;

    // Password strength levels
    const getStrengthDetails = () => {
        if (password.length === 0) return { label: "", color: "rgba(255,255,255,0.1)", width: "0%" };
        if (checkedCount <= 1) return { label: "Weak", color: "#e74c3c", width: "20%" };
        if (checkedCount === 2) return { label: "Fair", color: "#e67e22", width: "40%" };
        if (checkedCount === 3) return { label: "Good", color: "#f1c40f", width: "60%" };
        if (checkedCount === 4) return { label: "Strong", color: "#2ecc71", width: "80%" };
        return { label: "Very Strong", color: "#27ae60", width: "100%" };
    };

    const strength = getStrengthDetails();

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            addToast("Passwords do not match.", "error");
            return;
        }

        if (checkedCount < rules.length) {
            addToast("Please satisfy all password complexity rules.", "error");
            return;
        }

        setLoading(true);
        try {
            await resetPassword({ token, password });
            setIsSuccess(true);
        } catch (err) {
            console.error("Reset password failed:", err);
            addToast(err?.response?.data?.message || "Failed to update password. Reset token may have expired.", "error");
        } finally {
            setLoading(false);
        }
    };

    // Render loading verification state
    if (tokenStatus === "verifying") {
        return (
            <main>
                <div className="form-container" style={{ textAlign: "center", padding: "3rem 1rem" }}>
                    <div style={{
                        width: "36px",
                        height: "36px",
                        border: "3.5px solid rgba(210, 13, 59, 0.1)",
                        borderTopColor: "#d20d3b",
                        borderRadius: "50%",
                        animation: "lazy-route-spin 0.8s linear infinite",
                        margin: "0 auto 1.5rem"
                    }} />
                    <p style={{ color: "rgba(255, 255, 255, 0.6)", fontSize: "0.9rem" }}>
                        Verifying reset link...
                    </p>
                </div>
            </main>
        );
    }

    // Render success landing view
    if (isSuccess) {
        return (
            <main>
                <div className="form-container" style={{ textAlign: "center", padding: "2rem 1.5rem", animation: "fadeIn 0.5s ease-out-back" }}>
                    <div style={{
                        width: "60px",
                        height: "60px",
                        borderRadius: "50%",
                        background: "rgba(39, 174, 96, 0.1)",
                        border: "2px solid #27ae60",
                        color: "#27ae60",
                        fontSize: "2rem",
                        lineHeight: "56px",
                        margin: "0 auto 1.5rem",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        animation: "scaleIn 0.4s ease-out-back"
                    }}>
                        ✓
                    </div>
                    <h2 style={{ fontSize: "1.5rem", color: "#ffffff", marginBottom: "1rem" }}>✓ Password Updated Successfully</h2>
                    <p style={{ fontSize: "0.95rem", color: "rgba(255,255,255,0.85)", marginBottom: "1rem", lineHeight: "1.6" }}>
                        Your password has been changed.
                    </p>
                    <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.6)", marginBottom: "2rem" }}>
                        All active sessions have been signed out.
                    </p>
                    <div style={{ fontSize: "1rem", color: "#d20d3b", fontWeight: "600", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                        <span>Redirecting to Login...</span>
                        <span style={{ fontSize: "1.8rem" }}>{redirectTimer}...</span>
                    </div>
                </div>
            </main>
        );
    }

    // Render error cards
    if (tokenStatus !== "valid") {
        let title = "Invalid Reset Link";
        let sub = "The reset link is invalid. Please request a new recovery link.";
        let buttonText = "Request New Link";
        let icon = "✕";
        let iconBg = "rgba(231, 76, 60, 0.1)";
        let iconBorder = "#e74c3c";

        if (tokenStatus === "expired") {
            title = "Reset Link Expired";
            sub = "This reset link is valid for 1 hour only and has expired.";
            buttonText = "Request New Link";
            icon = "⏰";
            iconBg = "rgba(241, 196, 15, 0.1)";
            iconBorder = "#f1c40f";
        } else if (tokenStatus === "used") {
            title = "This reset link has already been used.";
            sub = "Request another reset email.";
            buttonText = "Request another reset email";
            icon = "✕";
        }

        return (
            <main>
                <div className="form-container" style={{ textAlign: "center", padding: "2rem 1.5rem", animation: "fadeIn 0.5s ease" }}>
                    <div style={{
                        width: "60px",
                        height: "60px",
                        borderRadius: "50%",
                        background: iconBg,
                        border: `2px solid ${iconBorder}`,
                        color: iconBorder,
                        fontSize: "1.8rem",
                        lineHeight: "56px",
                        margin: "0 auto 1.5rem",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                    }}>
                        {icon}
                    </div>
                    <h2 style={{ fontSize: "1.4rem", color: "#ffffff", marginBottom: "1rem" }}>{title}</h2>
                    <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.7)", marginBottom: "2rem", lineHeight: "1.6" }}>
                        {sub}
                    </p>
                    <Link to="/forgot-password" className="button primary-button" style={{ display: "inline-block", textDecoration: "none", lineHeight: "45px", height: "45px" }}>
                        {buttonText}
                    </Link>
                </div>
            </main>
        );
    }

    // Render standard forms layout
    return (
        <main>
            <div className="form-container" style={{ animation: "fadeIn 0.5s ease-out-back" }}>
                <h1>Reset Password</h1>
                <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.7)", marginBottom: "1.5rem", textAlign: "center" }}>
                    Configure your new account password below.
                </p>
                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label htmlFor="password" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            New Password
                            <HelpTooltip term="" text="Choose a password with at least 8 characters, containing uppercase, lowercase, numbers, and special characters." />
                        </label>
                        <PasswordInput
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            id="password"
                            name="password"
                            placeholder="Enter new password"
                            required
                            autoFocus
                        />
                    </div>

                    {/* Live checklist */}
                    <div style={{ margin: "1rem 0", background: "rgba(255,255,255,0.03)", padding: "12px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.05)" }}>
                        <div style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.5)", marginBottom: "8px", fontWeight: "600" }}>Password Complexity:</div>
                        <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: "0.8rem" }}>
                            {rules.map((rule, idx) => {
                                const passed = rule.test(password);
                                return (
                                    <li key={idx} style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "5px", color: passed ? "#2ecc71" : "rgba(255,255,255,0.4)" }}>
                                        <span>{passed ? "✓" : "○"}</span>
                                        <span>{rule.label}</span>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>

                    {/* Password strength meter */}
                    {password.length > 0 && (
                        <div style={{ margin: "1rem 0" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "rgba(255,255,255,0.6)", marginBottom: "5px" }}>
                                <span>Password Strength:</span>
                                <span style={{ color: strength.color, fontWeight: "bold" }}>{strength.label}</span>
                            </div>
                            <div style={{ width: "100%", height: "6px", background: "rgba(255,255,255,0.1)", borderRadius: "3px", overflow: "hidden" }}>
                                <div style={{ width: strength.width, height: "100%", background: strength.color, transition: "width 0.3s ease, background 0.3s ease" }} />
                            </div>
                        </div>
                    )}

                    <div className="input-group">
                        <label htmlFor="confirmPassword">Confirm New Password</label>
                        <PasswordInput
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            id="confirmPassword"
                            name="confirmPassword"
                            placeholder="Confirm new password"
                            required
                        />
                    </div>

                    <LoadingButton
                        type="submit"
                        loading={loading}
                        loadingText="Saving password..."
                        className="button primary-button"
                        id="resetPasswordSubmitBtn"
                        style={{ marginTop: "1rem" }}
                    >
                        Save New Password
                    </LoadingButton>
                </form>
            </div>
        </main>
    );
};

export default ResetPassword;

