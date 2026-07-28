import React, { useState, useEffect } from 'react';
import { fetchProfile, updateProfile, deleteAccount } from '../services/settings.api';
import { useToast } from '../../../context/ToastContext';
import { LoadingButton, PasswordInput } from '../../../components/ui';
import { useAuth } from '../../auth/hooks/useAuth';
import { useNavigate } from 'react-router';
import { formatErrorMessage } from '../../../utils/apiClient';

const ProfileCard = () => {
    const { addToast } = useToast();
    const { user, setUser } = useAuth();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    const [profile, setProfile] = useState({
        username: '',
        email: '',
        avatarUrl: '',
        createdAt: null
    });

    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deletePassword, setDeletePassword] = useState('');
    const [deleteLoading, setDeleteLoading] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await fetchProfile();
                setProfile({
                    username: data.profile.username || '',
                    email: data.profile.email || '',
                    avatarUrl: data.profile.avatarUrl || '',
                    createdAt: data.profile.createdAt
                });
            } catch (err) {
                addToast(formatErrorMessage(err, "Failed to load profile"), "error");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [addToast]);

    const handleChange = (e) => {
        setProfile(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const data = await updateProfile({
                username: profile.username,
                email: profile.email,
                avatarUrl: profile.avatarUrl
            });

            if (data && data.profile) {
                if (typeof setUser === 'function') {
                    setUser(prev => ({
                        ...prev,
                        username: data.profile.username,
                        email: data.profile.email,
                        avatarUrl: data.profile.avatarUrl
                    }));
                }
                setProfile(prev => ({
                    ...prev,
                    username: data.profile.username || '',
                    email: data.profile.email || '',
                    avatarUrl: data.profile.avatarUrl || '',
                    createdAt: data.profile.createdAt || prev.createdAt
                }));
                addToast(data.message || "Profile updated successfully", "success");
            } else {
                addToast("Profile update failed.", "error");
            }
        } catch (err) {
            if (import.meta.env.DEV) {
                console.error("[ProfileCard] Profile update error:", err);
            }
            addToast(formatErrorMessage(err, "Failed to update profile. Please try again."), "error");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deletePassword) {
            return addToast("Password is required to delete account.", "error");
        }
        setDeleteLoading(true);
        try {
            await deleteAccount(deletePassword);
            addToast("Account permanently deleted.", "success");
            setUser(null);
            navigate("/login");
        } catch (err) {
            addToast(formatErrorMessage(err, "Failed to delete account"), "error");
        } finally {
            setDeleteLoading(false);
        }
    };

    if (loading) return <div className="settings-card"><p>Loading profile...</p></div>;

    const memberSinceDate = profile.createdAt || user?.createdAt;
    const memberSince = memberSinceDate 
        ? new Date(memberSinceDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        : new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    return (
        <>
            <div className="settings-card">
                <h2>Profile Overview</h2>
                <div className="card-body">
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1rem' }}>
                        <div style={{ 
                            width: '80px', 
                            height: '80px', 
                            borderRadius: '50%', 
                            background: profile.avatarUrl ? `url(${profile.avatarUrl}) center/cover` : '#334155',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '2rem'
                        }}>
                            {!profile.avatarUrl && '👤'}
                        </div>
                        <div>
                            <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Member Since</div>
                            <div style={{ fontWeight: '600' }}>{memberSince}</div>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Avatar URL</label>
                        <input 
                            name="avatarUrl" 
                            value={profile.avatarUrl} 
                            onChange={handleChange} 
                            placeholder="https://example.com/avatar.jpg" 
                        />
                    </div>

                    <div className="form-group">
                        <label>Full Name / Username</label>
                        <input 
                            name="username" 
                            value={profile.username} 
                            onChange={handleChange} 
                            placeholder="Your Name" 
                        />
                    </div>

                    <div className="form-group">
                        <label>Email Address</label>
                        <input 
                            name="email" 
                            type="email"
                            value={profile.email} 
                            onChange={handleChange} 
                            placeholder="your.email@example.com" 
                        />
                        <small style={{ color: '#64748b', fontSize: '0.75rem' }}>
                            Note: Updating your email may require re-verification in the future.
                        </small>
                    </div>

                    <div style={{ marginTop: '1rem' }}>
                        <LoadingButton 
                            onClick={handleSave} 
                            loading={saving} 
                            className="btn-primary"
                        >
                            Save Profile
                        </LoadingButton>
                    </div>
                </div>
            </div>

            <div className="settings-card" style={{ border: '1px solid rgba(239, 68, 68, 0.3)', marginTop: '2rem' }}>
                <h2 style={{ color: '#ef4444', borderBottomColor: 'rgba(239, 68, 68, 0.2)' }}>Danger Zone</h2>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Permanently remove your account and all associated data from CareerPrep servers. This action cannot be undone.</p>
                
                <div className="card-body">
                    {!deleteModalOpen ? (
                        <button 
                            onClick={() => setDeleteModalOpen(true)}
                            style={{ background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '0.75rem 1.5rem', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', width: 'fit-content' }}
                        >
                            Delete Account
                        </button>
                    ) : (
                        <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '1.5rem', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                            <h3 style={{ color: '#ef4444', marginTop: 0 }}>Are you absolutely sure?</h3>
                            <p style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>Please enter your password to confirm permanent deletion.</p>
                            
                            <div className="form-group" style={{ marginBottom: '1rem' }}>
                                <PasswordInput 
                                    placeholder="Enter your password" 
                                    value={deletePassword} 
                                    onChange={(e) => setDeletePassword(e.target.value)} 
                                    id="deletePassword"
                                    name="deletePassword"
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <LoadingButton onClick={handleDelete} loading={deleteLoading} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>
                                    Confirm Delete
                                </LoadingButton>
                                <button onClick={() => setDeleteModalOpen(false)} style={{ background: 'transparent', border: '1px solid #64748b', color: '#cbd5e1', padding: '0.6rem 1.2rem', borderRadius: '6px', cursor: 'pointer' }}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default ProfileCard;
