import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { forgotPassword } from '../services/auth.api';
import { useToast } from '../../../context/ToastContext';
import { LoadingButton } from '../../../components/ui';
import "../auth.form.scss";

const ForgotPassword = () => {
    const { addToast } = useToast();
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [isSent, setIsSent] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const timerRef = useRef(null);

    // Resend countdown timer logic
    useEffect(() => {
        if (countdown > 0) {
            timerRef.current = setTimeout(() => {
                setCountdown(prev => prev - 1);
            }, 1000);
        }
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [countdown]);

    const handleRequestLink = async (targetEmail) => {
        setLoading(true);
        try {
            await forgotPassword({ email: targetEmail });
            setIsSent(true);
            setCountdown(60); // Start 60s delay
            addToast("Recovery Email Sent", "success");
        } catch (err) {
            console.error("Forgot password request failed:", err);
            addToast(err?.response?.data?.message || "Failed to process request. Please try again.", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        handleRequestLink(email);
    };

    const handleResend = () => {
        if (countdown === 0) {
            handleRequestLink(email);
        }
    };

    return (
        <main>
            <div className="form-container" style={{ animation: "fadeIn 0.5s ease-out-back" }}>
                {!isSent ? (
                    <>
                        <h1>Forgot Password</h1>
                        <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.7)", marginBottom: "1.5rem", textAlign: "center", lineHeight: "1.5" }}>
                            Enter your registered email address. We'll send you a secure password reset link.
                        </p>
                        <form onSubmit={handleSubmit}>
                            <div className="input-group">
                                <label htmlFor="email">Email Address</label>
                                <input
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    type="email"
                                    id="email"
                                    name="email"
                                    placeholder="Enter email address"
                                    required
                                    autoFocus
                                    aria-label="Email Address for password recovery"
                                />
                            </div>
                            <LoadingButton
                                type="submit"
                                loading={loading}
                                loadingText="Sending link..."
                                className="button primary-button"
                                id="forgotPasswordSubmitBtn"
                                style={{ marginTop: "1rem" }}
                            >
                                Request Reset Link
                            </LoadingButton>
                        </form>
                    </>
                ) : (
                    <div style={{ textAlign: "center", padding: "1rem 0" }}>
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
                            animation: "scaleIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
                        }}>
                            ✓
                        </div>
                        <p style={{ fontSize: "1rem", color: "#ffffff", marginBottom: "2rem", lineHeight: "1.6" }}>
                            If an account exists, we've sent a reset link. Please check your inbox.
                        </p>
                        
                        <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "1.5rem", marginBottom: "1rem" }}>
                            <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.5)", marginBottom: "1rem" }}>
                                Didn't receive it?
                            </p>
                            <button
                                onClick={handleResend}
                                disabled={countdown > 0 || loading}
                                className="button secondary-button"
                                style={{
                                    width: "auto",
                                    padding: "0.6rem 1.5rem",
                                    fontSize: "0.85rem",
                                    opacity: countdown > 0 ? 0.6 : 1,
                                    cursor: countdown > 0 ? "not-allowed" : "pointer"
                                }}
                            >
                                {countdown > 0 ? `Resend in ${countdown} seconds` : "Resend Reset Link"}
                            </button>
                        </div>
                    </div>
                )}
                <p style={{ marginTop: "1.5rem", fontSize: "0.85rem", textAlign: "center" }}>
                    Back to <Link to="/login" style={{ color: "#d20d3b", textDecoration: "none", fontWeight: "600" }}>Login</Link>
                </p>
            </div>
        </main>
    );
};

export default ForgotPassword;

