import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getMe, enableMfa, confirmMfa, disableMfa } from '../services/auth.api';
import { fetchSystemHealth } from '../services/system.api';
import { useToast } from '../../../context/ToastContext';
import { LoadingButton } from '../../../components/ui';
import Navbar from '../../ats/components/Navbar';
import "./settings.scss";

const Settings = () => {
    const { user, setUser } = useAuth();
    const { addToast } = useToast();

    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState(null);

    // MFA configuration states
    const [mfaStatus, setMfaStatus] = useState(false);
    const [qrCode, setQrCode] = useState("");
    const [mfaSecret, setMfaSecret] = useState("");
    const [verificationCode, setVerificationCode] = useState("");
    const [setupActive, setSetupActive] = useState(false);
    const [recoveryCodes, setRecoveryCodes] = useState([]);
    const [actionLoading, setActionLoading] = useState(false);

    // Health state
    const [health, setHealth] = useState(null);
    const [healthLoading, setHealthLoading] = useState(true);
    const [refreshingHealth, setRefreshingHealth] = useState(false);

    const loadHealth = async (showLoading = true) => {
        if (showLoading) setHealthLoading(true);
        else setRefreshingHealth(true);
        try {
            const data = await fetchSystemHealth();
            setHealth(data.providers);
        } catch (err) {
            console.error("Failed to load system health:", err);
            setHealth(null);
        } finally {
            setHealthLoading(false);
            setRefreshingHealth(false);
        }
    };

    const renderProviderStatus = (name, data, description) => {
        if (!data) return null;
        let badgeColor = "#95a5a6";
        let badgeBg = "rgba(149, 165, 166, 0.15)";
        let statusText = "Unknown";
        let extraInfo = "";

        if (data.status === "healthy" || data.status === "connected") {
            badgeColor = "#2ecc71";
            badgeBg = "rgba(46, 204, 113, 0.15)";
            statusText = "Healthy";
            if (data.latencyMs) {
                extraInfo = `${data.latencyMs}ms latency`;
            } else if (data.rateLimit) {
                extraInfo = `${data.rateLimit.remaining}/${data.rateLimit.limit} requests remaining`;
            }
        } else if (data.status === "degraded") {
            badgeColor = "#f39c12";
            badgeBg = "rgba(243, 156, 18, 0.15)";
            statusText = "Degraded";
            if (data.model) {
                extraInfo = `Model: ${data.model}`;
            }
        } else if (data.status === "unconfigured") {
            badgeColor = "#f1c40f";
            badgeBg = "rgba(241, 196, 15, 0.15)";
            statusText = "Unconfigured";
        } else {
            badgeColor = "#e74c3c";
            badgeBg = "rgba(231, 76, 60, 0.15)";
            statusText = "Offline";
            if (data.error) {
                extraInfo = data.error;
            }
        }

        return (
            <div className="health-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.8rem 1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', textAlign: 'left' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{name}</span>
                    <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>{description}</span>
                    {extraInfo && (
                        <span style={{ fontSize: '0.75rem', color: badgeColor, fontFamily: 'monospace', marginTop: '0.1rem' }}>
                            {extraInfo}
                        </span>
                    )}
                </div>
                <span style={{
                    color: badgeColor,
                    background: badgeBg,
                    border: `1px solid ${badgeColor}`,
                    padding: '0.2rem 0.6rem',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                }}>
                    {statusText}
                </span>
            </div>
        );
    };

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const data = await getMe();
                setProfile(data.user);
                setMfaStatus(data.user.mfaEnabled);
            } catch (err) {
                console.error("Failed to load user profile:", err);
                addToast("Failed to retrieve profile data.", "error");
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
        loadHealth();
    }, []);

    const handleStartMfaSetup = async () => {
        setActionLoading(true);
        setRecoveryCodes([]);
        try {
            const data = await enableMfa();
            setQrCode(data.qrCode);
            setMfaSecret(data.secret);
            setSetupActive(true);
            addToast("MFA setup initialized. Please scan the QR Code.", "info");
        } catch (err) {
            console.error("MFA enable initialization failed:", err);
            addToast(err?.response?.data?.message || "Failed to initialize MFA setup.", "error");
        } finally {
            setActionLoading(false);
        }
    };

    const handleConfirmMfa = async (e) => {
        e.preventDefault();
        if (!verificationCode) return;
        setActionLoading(true);
        try {
            const data = await confirmMfa({ code: verificationCode });
            setMfaStatus(true);
            setSetupActive(false);
            setQrCode("");
            setMfaSecret("");
            setVerificationCode("");
            setRecoveryCodes(data.recoveryCodes || []);
            // Update context user details
            setUser(prev => ({ ...prev, mfaEnabled: true }));
            addToast("MFA has been successfully configured on your account.", "success");
        } catch (err) {
            console.error("MFA confirmation failed:", err);
            addToast(err?.response?.data?.message || "Invalid verification code. Please try again.", "error");
        } finally {
            setActionLoading(false);
        }
    };

    const handleDisableMfa = async () => {
        if (!window.confirm("Are you sure you want to disable Multi-Factor Authentication? This will reduce your account security.")) {
            return;
        }
        setActionLoading(true);
        setRecoveryCodes([]);
        try {
            await disableMfa();
            setMfaStatus(false);
            setUser(prev => ({ ...prev, mfaEnabled: false }));
            addToast("MFA has been disabled successfully.", "info");
        } catch (err) {
            console.error("Disable MFA failed:", err);
            addToast(err?.response?.data?.message || "Failed to disable MFA.", "error");
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="settings-dashboard-container">
                <Navbar />
                <div className="settings-main-content">
                    <p style={{ textAlign: "center", marginTop: "4rem", color: "rgba(255,255,255,0.6)" }}>Loading your configuration settings...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="settings-dashboard-container">
            <Navbar />
            <div className="settings-main-content">
                <h1>Account Settings</h1>
                <p className="subtitle">Manage your account profile details and security configurations.</p>

                <div className="settings-grid">
                    {/* PROFILE CARD */}
                    <div className="settings-card">
                        <h2>Profile Overview</h2>
                        <div className="profile-details-row">
                            <div className="detail-item">
                                <span className="detail-label">Username</span>
                                <span className="detail-value">{profile?.username}</span>
                            </div>
                            <div className="detail-item">
                                <span className="detail-label">Email Address</span>
                                <span className="detail-value">{profile?.email}</span>
                            </div>
                        </div>

                        <h3 style={{ marginTop: '2rem', fontSize: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>Active Session Tracking</h3>
                        <div className="profile-details-row" style={{ marginTop: '1rem' }}>
                            <div className="detail-item">
                                <span className="detail-label">Last Login Timestamp</span>
                                <span className="detail-value">
                                    {profile?.sessionMetadata?.lastLogin ? new Date(profile.sessionMetadata.lastLogin).toLocaleString() : 'N/A'}
                                </span>
                            </div>
                            <div className="detail-item">
                                <span className="detail-label">Last Session Activity</span>
                                <span className="detail-value">
                                    {profile?.sessionMetadata?.lastActivity ? new Date(profile.sessionMetadata.lastActivity).toLocaleString() : 'N/A'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* SECURITY / MFA CARD */}
                    <div className="settings-card">
                        <h2>Multi-Factor Authentication (MFA)</h2>
                        <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.7)", lineHeight: "1.6", marginBottom: "1.5rem" }}>
                            Multi-Factor Authentication adds an extra layer of protection to your account. In addition to your password, you will be prompted to enter a verification code from an authenticator application (like Google Authenticator or Microsoft Authenticator) during logins.
                        </p>

                        <div className="mfa-status-banner" style={{ background: mfaStatus ? "rgba(39, 174, 96, 0.1)" : "rgba(192, 57, 43, 0.1)", border: mfaStatus ? "1px solid #27ae60" : "1px solid #c0392b" }}>
                            <span style={{ color: mfaStatus ? "#2ab76b" : "#e74c3c" }}>
                                Status: <strong>{mfaStatus ? "ENABLED" : "DISABLED"}</strong>
                            </span>
                        </div>

                        {!mfaStatus && !setupActive && (
                            <LoadingButton
                                onClick={handleStartMfaSetup}
                                loading={actionLoading}
                                className="button primary-button"
                                style={{ marginTop: "1rem" }}
                            >
                                Setup Authenticator App MFA
                            </LoadingButton>
                        )}

                        {setupActive && (
                            <div className="mfa-setup-section">
                                <h3 style={{ fontSize: '1rem', marginTop: '1.5rem' }}>Configure Google Authenticator</h3>
                                <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', margin: '0.5rem 0 1rem 0' }}>
                                    1. Scan the QR code below using your authenticator app, or input the text secret key: <code>{mfaSecret}</code>
                                </p>

                                <div className="qr-container" style={{ background: '#fff', padding: '10px', display: 'inline-block', borderRadius: '6px', marginBottom: '1.5rem' }}>
                                    {qrCode && <img src={qrCode} alt="Authenticator App QR Code" style={{ display: 'block', width: '180px', height: '180px' }} />}
                                </div>

                                <form onSubmit={handleConfirmMfa} style={{ marginTop: '1rem' }}>
                                    <div className="input-group">
                                        <label htmlFor="verifyCode">2. Enter 6-digit Verification Code</label>
                                        <input
                                            value={verificationCode}
                                            onChange={(e) => setVerificationCode(e.target.value)}
                                            type="text"
                                            id="verifyCode"
                                            placeholder="Example: 123456"
                                            required
                                            maxLength={6}
                                            style={{ letterSpacing: '2px', textAlign: 'center' }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                        <LoadingButton
                                            type="submit"
                                            loading={actionLoading}
                                            className="button primary-button"
                                        >
                                            Confirm & Enable
                                        </LoadingButton>
                                        <button
                                            type="button"
                                            onClick={() => setSetupActive(false)}
                                            className="button"
                                            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', cursor: 'pointer' }}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}

                        {mfaStatus && (
                            <LoadingButton
                                onClick={handleDisableMfa}
                                loading={actionLoading}
                                className="button"
                                style={{ marginTop: "1rem", background: "#c0392b", border: "none", color: "#fff" }}
                            >
                                Disable Authenticator MFA
                            </LoadingButton>
                        )}

                        {/* RECOVERY CODES DISPLAY */}
                        {recoveryCodes.length > 0 && (
                            <div className="recovery-codes-section" style={{ marginTop: '2rem', background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '8px', borderLeft: '4px solid #f39c12' }}>
                                <h3 style={{ fontSize: '1rem', color: '#f39c12', margin: 0 }}>Backup Recovery Codes</h3>
                                <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', margin: '0.5rem 0 1rem 0', lineHeight: '1.5' }}>
                                    <strong>CRITICAL:</strong> Save these backup codes securely. If you lose access to your authenticator app, you can use these codes to verify your login session. Each code is hashed and can only be used once!
                                </p>
                                <div className="codes-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontFamily: 'monospace', fontSize: '0.9rem', color: '#fff', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '6px' }}>
                                    {recoveryCodes.map((code, idx) => (
                                        <span key={idx} style={{ letterSpacing: '0.5px' }}>{code}</span>
                                    ))}
                                </div>
                                <button
                                    onClick={() => {
                                        const text = `CareerPrep MFA Backup Recovery Codes\nGenerated: ${new Date().toLocaleString()}\n\n` + recoveryCodes.join('\n');
                                        const blob = new Blob([text], { type: 'text/plain' });
                                        const url = URL.createObjectURL(blob);
                                        const link = document.createElement('a');
                                        link.href = url;
                                        link.download = 'careerprep-recovery-codes.txt';
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                        URL.revokeObjectURL(url);
                                        addToast("Recovery codes saved to download file.", "success");
                                    }}
                                    className="button"
                                    style={{ marginTop: '1rem', background: '#f39c12', border: 'none', color: '#fff', width: '100%', fontSize: '0.85rem' }}
                                >
                                    Download Recovery Codes Text File
                                </button>
                            </div>
                        )}
                    </div>

                    {/* SYSTEM HEALTH CARD */}
                    <div className="settings-card system-health-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.8rem' }}>
                            <h2 style={{ margin: 0, border: 'none', padding: 0 }}>System Provider Health</h2>
                            <button 
                                onClick={() => loadHealth(false)}
                                disabled={refreshingHealth}
                                className="health-refresh-btn"
                                style={{
                                    background: 'rgba(255,255,255,0.08)',
                                    border: 'none',
                                    borderRadius: '4px',
                                    color: '#fff',
                                    padding: '0.4rem 0.8rem',
                                    fontSize: '0.8rem',
                                    cursor: 'pointer',
                                    transition: 'background 0.2s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem'
                                }}
                            >
                                {refreshingHealth ? 'Refreshing...' : 'Refresh Status'}
                            </button>
                        </div>
                        <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.7)", lineHeight: "1.6", marginBottom: "1.5rem" }}>
                            Monitor the operational availability, connection latency, and configurations of external integrated providers.
                        </p>

                        {healthLoading ? (
                            <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.5)', textAlign: 'center', padding: '2rem 0' }}>Querying diagnostics API...</p>
                        ) : !health ? (
                            <div className="health-error-banner" style={{ background: "rgba(192, 57, 43, 0.1)", border: "1px solid #c0392b", padding: "1rem", borderRadius: "6px", color: "#e74c3c", fontSize: "0.9rem" }}>
                                Failed to fetch live connection diagnostics from the server.
                            </div>
                        ) : (
                            <div className="health-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {renderProviderStatus("Gemini AI", health.gemini, "LLM Orchestrator")}
                                {renderProviderStatus("Groq AI", health.groq, "Inference Acceleration")}
                                {renderProviderStatus("OpenRouter AI", health.openrouter, "Fallback Model Gateway")}
                                {renderProviderStatus("Judge0 Engine", health.judge0, "Code Sandbox Execution")}
                                {renderProviderStatus("GitHub API", health.github, "Project Analysis Metadata")}
                                {renderProviderStatus("Sarvam Audio", health.sarvam, "STT / TTS Synthesis")}
                                {renderProviderStatus("SMTP Gateway", health.smtp, "Email Notification Dispatcher")}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
