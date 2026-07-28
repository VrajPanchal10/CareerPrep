import React, { useState, useEffect } from 'react';
import { fetchSecurity, revokeDevice, revokeAllDevices, updatePassword } from '../services/settings.api';
import { useToast } from '../../../context/ToastContext';
import { LoadingButton, PasswordInput } from '../../../components/ui';
import { useAuth } from '../../auth/hooks/useAuth';
import { useNavigate } from 'react-router';
import { formatErrorMessage } from '../../../utils/apiClient';

// Relative time calculation helper
const getRelativeTimeString = (dateString) => {
    if (!dateString) return 'Just now';
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
};

const SecurityCard = () => {
    const { addToast } = useToast();
    const { setUser } = useAuth();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [securityData, setSecurityData] = useState({
        devices: []
    });

    const [pwd, setPwd] = useState({ current: '', new: '', confirm: '' });
    const [pwdLoading, setPwdLoading] = useState(false);
    const [revokeLoading, setRevokeLoading] = useState({});
    const [revokeAllLoading, setRevokeAllLoading] = useState(false);

    const load = async () => {
        try {
            const data = await fetchSecurity();
            setSecurityData({
                devices: data.security?.devices || []
            });
        } catch (err) {
            addToast(formatErrorMessage(err, "Failed to load security info"), "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const handlePasswordUpdate = async () => {
        if (!pwd.current || !pwd.new || !pwd.confirm) {
            return addToast("Please complete all password fields.", "error");
        }
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
            addToast(formatErrorMessage(err, "Failed to update password"), "error");
        } finally {
            setPwdLoading(false);
        }
    };

    const handleRevoke = async (id, isCurrentDevice) => {
        setRevokeLoading(prev => ({ ...prev, [id]: true }));
        try {
            const res = await revokeDevice(id);
            if (isCurrentDevice || res?.isCurrentDevice) {
                addToast("Current session signed out.", "info");
                setUser(null);
                navigate("/login");
                return;
            }
            addToast("Device signed out successfully", "success");
            await load();
        } catch (err) {
            addToast(formatErrorMessage(err, "Failed to revoke device"), "error");
        } finally {
            setRevokeLoading(prev => ({ ...prev, [id]: false }));
        }
    };

    const handleRevokeAll = async () => {
        setRevokeAllLoading(true);
        try {
            await revokeAllDevices();
            addToast("All other devices have been signed out.", "success");
            await load();
        } catch (err) {
            addToast(formatErrorMessage(err, "Failed to sign out other devices"), "error");
        } finally {
            setRevokeAllLoading(false);
        }
    };

    if (loading) return <div className="settings-card"><p>Loading security details...</p></div>;

    return (
        <>
            {/* 1. Password Update Section */}
            <div className="settings-card">
                <h2>1. Password Update</h2>
                <div className="card-body">
                    <div className="form-group">
                        <label htmlFor="currentPassword">Current Password</label>
                        <PasswordInput 
                            id="currentPassword"
                            name="currentPassword"
                            placeholder="Enter current password"
                            value={pwd.current} 
                            onChange={(e) => setPwd({...pwd, current: e.target.value})} 
                        />
                    </div>
                    <div className="form-group" style={{ marginTop: '1rem' }}>
                        <label htmlFor="newPassword">New Password</label>
                        <PasswordInput 
                            id="newPassword"
                            name="newPassword"
                            placeholder="Enter new password"
                            value={pwd.new} 
                            onChange={(e) => setPwd({...pwd, new: e.target.value})} 
                        />
                    </div>
                    <div className="form-group" style={{ marginTop: '1rem' }}>
                        <label htmlFor="confirmPassword">Confirm Password</label>
                        <PasswordInput 
                            id="confirmPassword"
                            name="confirmPassword"
                            placeholder="Re-enter new password"
                            value={pwd.confirm} 
                            onChange={(e) => setPwd({...pwd, confirm: e.target.value})} 
                        />
                    </div>
                    <div style={{ marginTop: '1.25rem' }}>
                        <LoadingButton onClick={handlePasswordUpdate} loading={pwdLoading} className="btn-primary">
                            Update Password
                        </LoadingButton>
                    </div>
                </div>
            </div>

            {/* 2. Logged-in Devices Section */}
            <div className="settings-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <h2 style={{ border: 'none', margin: 0, padding: 0 }}>2. Logged-in Devices</h2>
                    {securityData.devices.length > 1 && (
                        <LoadingButton 
                            onClick={handleRevokeAll} 
                            loading={revokeAllLoading}
                            style={{ 
                                background: 'transparent', 
                                border: '1px solid #ef4444', 
                                color: '#ef4444', 
                                padding: '0.4rem 0.9rem', 
                                borderRadius: '6px', 
                                cursor: 'pointer',
                                fontSize: '0.85rem'
                            }}
                        >
                            Sign Out All Other Devices
                        </LoadingButton>
                    )}
                </div>
                <div className="card-body" style={{ marginTop: '1rem' }}>
                    {securityData.devices.map(dev => {
                        const isCurrent = dev.isCurrentDevice;
                        const deviceId = dev.sessionId || dev._id;
                        return (
                            <div 
                                key={deviceId} 
                                style={{ 
                                    display: 'flex', 
                                    justify: 'space-between', 
                                    alignItems: 'center', 
                                    padding: '1.1rem 1.25rem', 
                                    background: isCurrent ? 'rgba(56, 189, 248, 0.05)' : 'rgba(255,255,255,0.02)', 
                                    border: isCurrent ? '1px solid rgba(56, 189, 248, 0.25)' : '1px solid rgba(255,255,255,0.06)',
                                    borderRadius: '10px',
                                    marginBottom: '0.85rem',
                                    flexWrap: 'wrap',
                                    gap: '1rem'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{
                                        width: '42px',
                                        height: '42px',
                                        borderRadius: '10px',
                                        background: isCurrent ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '1.25rem'
                                    }}>
                                        {dev.deviceType === 'Mobile' ? '📱' : dev.deviceType === 'Tablet' ? '平板' : '💻'}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: '600', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                            {dev.os} • {dev.browser}
                                            {isCurrent && (
                                                <span style={{ 
                                                    background: 'rgba(16, 185, 129, 0.15)', 
                                                    border: '1px solid rgba(16, 185, 129, 0.3)',
                                                    color: '#10b981', 
                                                    fontSize: '0.75rem', 
                                                    padding: '0.15rem 0.55rem', 
                                                    borderRadius: '12px',
                                                    fontWeight: '600'
                                                }}>
                                                    ✓ Current Device
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: '0.825rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                                            IP: {dev.ip} • Last Active: {getRelativeTimeString(dev.lastActivity)}
                                        </div>
                                    </div>
                                </div>
                                <LoadingButton 
                                    onClick={() => handleRevoke(deviceId, isCurrent)} 
                                    loading={revokeLoading[deviceId]}
                                    style={{ 
                                        background: 'transparent', 
                                        color: '#ef4444', 
                                        fontSize: '0.85rem', 
                                        padding: '0.45rem 1rem', 
                                        border: '1px solid rgba(239, 68, 68, 0.35)', 
                                        borderRadius: '6px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Sign Out
                                </LoadingButton>
                            </div>
                        );
                    })}
                    {securityData.devices.length === 0 && (
                        <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No active sessions recorded.</p>
                    )}
                </div>
            </div>
        </>
    );
};

export default SecurityCard;
