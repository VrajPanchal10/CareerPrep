import React, { useState, useEffect } from 'react';
import { fetchSecurity, revokeDevice, revokeAllDevices, updatePassword } from '../services/settings.api';
import { enableMfa, confirmMfa } from '../../auth/services/auth.api'; // reuse from auth
import { useToast } from '../../../context/ToastContext';
import { LoadingButton } from '../../../components/ui';

const parseDeviceInfo = (userAgent) => {
    if (!userAgent) return { os: 'Unknown OS', browser: 'Unknown Browser' };
    let os = 'Unknown OS';
    if (userAgent.includes('Win')) os = 'Windows';
    else if (userAgent.includes('Mac')) os = 'macOS';
    else if (userAgent.includes('Linux')) os = 'Linux';
    else if (userAgent.includes('Android')) os = 'Android';
    else if (userAgent.includes('like Mac')) os = 'iOS';

    let browser = 'Unknown Browser';
    if (userAgent.includes('Chrome') && !userAgent.includes('Edg') && !userAgent.includes('OPR')) browser = 'Google Chrome';
    else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) browser = 'Safari';
    else if (userAgent.includes('Firefox')) browser = 'Mozilla Firefox';
    else if (userAgent.includes('Edg')) browser = 'Microsoft Edge';
    else if (userAgent.includes('OPR') || userAgent.includes('Opera')) browser = 'Opera';

    return { os, browser };
};

const SecurityCard = () => {
    const { addToast } = useToast();
    const [loading, setLoading] = useState(true);
    
    const [securityData, setSecurityData] = useState({
        mfaEnabled: false,
        recoveryCodesGenerated: false,
        devices: []
    });

    const [pwd, setPwd] = useState({ current: '', new: '', confirm: '' });
    const [pwdLoading, setPwdLoading] = useState(false);
    
    const [showPwd, setShowPwd] = useState({ current: false, new: false, confirm: false });

    // MFA State
    const [mfaSetupActive, setMfaSetupActive] = useState(false);
    const [qrCode, setQrCode] = useState('');
    const [mfaCode, setMfaCode] = useState('');
    const [mfaActionLoading, setMfaActionLoading] = useState(false);

    const load = async () => {
        try {
            const data = await fetchSecurity();
            setSecurityData(data.security);
        } catch (err) {
            addToast("Failed to load security info", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const handlePasswordUpdate = async () => {
        if (pwd.new !== pwd.confirm) {
            return addToast("New passwords do not match", "error");
        }
        setPwdLoading(true);
        try {
            await updatePassword({ currentPassword: pwd.current, newPassword: pwd.new });
            addToast("Password updated successfully", "success");
            setPwd({ current: '', new: '', confirm: '' });
            load();
        } catch (err) {
            addToast(err?.response?.data?.message || "Failed to update password", "error");
        } finally {
            setPwdLoading(false);
        }
    };

    const handleEnableMFA = async () => {
        setMfaActionLoading(true);
        try {
            const data = await enableMfa();
            setQrCode(data.qrCode);
            setMfaSetupActive(true);
        } catch (err) {
            addToast("Failed to initiate MFA setup", "error");
        } finally {
            setMfaActionLoading(false);
        }
    };

    const handleConfirmMFA = async () => {
        setMfaActionLoading(true);
        try {
            await confirmMfa({ code: mfaCode });
            addToast("MFA enabled successfully", "success");
            setMfaSetupActive(false);
            load();
        } catch (err) {
            addToast("Invalid code", "error");
        } finally {
            setMfaActionLoading(false);
        }
    };

    const handleRevoke = async (id) => {
        try {
            await revokeDevice(id);
            addToast("Device revoked successfully", "success");
            load();
        } catch (err) {
            addToast("Failed to revoke device", "error");
        }
    };

    const handleRevokeAll = async () => {
        try {
            await revokeAllDevices();
            addToast("All other devices have been signed out.", "success");
            load();
        } catch (err) {
            addToast("Failed to revoke devices", "error");
        }
    };

    const toggleShowPwd = (field) => {
        setShowPwd(prev => ({ ...prev, [field]: !prev[field] }));
    };

    if (loading) return <div className="settings-card"><p>Loading security details...</p></div>;

    return (
        <>
            <div className="settings-card">
                <h2>1. Password Update</h2>
                <div className="card-body">
                    <div className="form-group" style={{ position: 'relative' }}>
                        <label>Current Password</label>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <input 
                                type={showPwd.current ? "text" : "password"} 
                                value={pwd.current} 
                                onChange={(e) => setPwd({...pwd, current: e.target.value})} 
                                style={{ width: '100%', paddingRight: '40px' }}
                            />
                            <button 
                                type="button"
                                onClick={() => toggleShowPwd('current')}
                                style={{ position: 'absolute', right: '10px', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.2rem' }}
                            >
                                {showPwd.current ? "👁️‍🗨️" : "👁️"}
                            </button>
                        </div>
                    </div>
                    <div className="form-group" style={{ position: 'relative' }}>
                        <label>New Password</label>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <input 
                                type={showPwd.new ? "text" : "password"} 
                                value={pwd.new} 
                                onChange={(e) => setPwd({...pwd, new: e.target.value})} 
                                style={{ width: '100%', paddingRight: '40px' }}
                            />
                            <button 
                                type="button"
                                onClick={() => toggleShowPwd('new')}
                                style={{ position: 'absolute', right: '10px', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.2rem' }}
                            >
                                {showPwd.new ? "👁️‍🗨️" : "👁️"}
                            </button>
                        </div>
                    </div>
                    <div className="form-group" style={{ position: 'relative' }}>
                        <label>Confirm Password</label>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <input 
                                type={showPwd.confirm ? "text" : "password"} 
                                value={pwd.confirm} 
                                onChange={(e) => setPwd({...pwd, confirm: e.target.value})} 
                                style={{ width: '100%', paddingRight: '40px' }}
                            />
                            <button 
                                type="button"
                                onClick={() => toggleShowPwd('confirm')}
                                style={{ position: 'absolute', right: '10px', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.2rem' }}
                            >
                                {showPwd.confirm ? "👁️‍🗨️" : "👁️"}
                            </button>
                        </div>
                    </div>
                    <div style={{ marginTop: '0.5rem' }}>
                        <LoadingButton onClick={handlePasswordUpdate} loading={pwdLoading} className="btn-primary">
                            Update Password
                        </LoadingButton>
                    </div>
                </div>
            </div>

            <div className="settings-card">
                <h2>2. Multi-Factor Authentication (MFA)</h2>
                <div className="card-body">
                    <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                        <div>
                            <span style={{color: securityData.mfaEnabled ? '#10b981' : '#94a3b8'}}>
                                {securityData.mfaEnabled ? '✔ Authenticator App Enabled' : '❌ Authenticator App Disabled'}
                            </span>
                        </div>
                        <div>
                            <span style={{color: securityData.recoveryCodesGenerated ? '#10b981' : '#94a3b8'}}>
                                {securityData.recoveryCodesGenerated ? '✔ Recovery Codes Generated' : '❌ Recovery Codes Not Generated'}
                            </span>
                        </div>
                    </div>

                    {!securityData.mfaEnabled && !mfaSetupActive && (
                        <div style={{ marginTop: '1rem' }}>
                            <LoadingButton onClick={handleEnableMFA} loading={mfaActionLoading} className="btn-primary">
                                Set Up MFA
                            </LoadingButton>
                        </div>
                    )}

                    {mfaSetupActive && (
                        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', marginTop: '1rem' }}>
                            <p>Scan this QR code with your authenticator app:</p>
                            <img src={qrCode} alt="MFA QR" style={{ borderRadius: '8px', marginBottom: '1rem' }} />
                            <div className="form-group">
                                <label>Verification Code</label>
                                <input type="text" value={mfaCode} onChange={e => setMfaCode(e.target.value)} />
                            </div>
                            <div style={{ marginTop: '1rem' }}>
                                <LoadingButton onClick={handleConfirmMFA} loading={mfaActionLoading} className="btn-primary">
                                    Verify & Enable
                                </LoadingButton>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="settings-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ border: 'none', margin: 0, padding: 0 }}>3. Logged-in Devices</h2>
                    <button onClick={handleRevokeAll} style={{ background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer' }}>
                        Sign Out All
                    </button>
                </div>
                <div className="card-body">
                    {securityData.devices.map(dev => {
                        const parsedInfo = parseDeviceInfo(dev.deviceInfo);
                        const isRecent = new Date(dev.lastActivity).getTime() > Date.now() - 1000 * 60 * 60 * 24; // within 24h
                        return (
                            <div key={dev._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                                <div>
                                    <div style={{ fontWeight: '600' }}>{parsedInfo.os}</div>
                                    <div style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>{parsedInfo.browser}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                                        Last Active: {isRecent ? "Recently" : new Date(dev.lastActivity).toLocaleDateString()}
                                    </div>
                                </div>
                                <button onClick={() => handleRevoke(dev._id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.9rem', padding: '0.5rem 1rem', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px' }}>
                                    Sign Out
                                </button>
                            </div>
                        );
                    })}
                    {securityData.devices.length === 0 && <p style={{color: '#94a3b8'}}>No active devices tracked.</p>}
                </div>
            </div>
        </>
    );
};

export default SecurityCard;
