import React, { useState } from 'react';
import Navbar from '../../ats/components/Navbar';
import ProfileCard from '../components/ProfileCard';
import SecurityCard from '../components/SecurityCard';
import './settings.scss';

const SettingsPage = () => {
    const [activeTab, setActiveTab] = useState('profile');

    const renderTabContent = () => {
        switch(activeTab) {
            case 'profile': return <ProfileCard />;
            case 'security': return <SecurityCard />;
            default: return <ProfileCard />;
        }
    };

    return (
        <div className="settings-page">
            <Navbar />
            <div className="settings-container">
                <header className="settings-header">
                    <h1>Account Settings</h1>
                    <p>Manage your profile and security preferences.</p>
                </header>

                <div className="settings-layout">
                    <aside className="settings-sidebar">
                        <nav>
                            <button className={activeTab === 'profile' ? 'active' : ''} onClick={() => setActiveTab('profile')}>
                                👤 Profile
                            </button>
                            <button className={activeTab === 'security' ? 'active' : ''} onClick={() => setActiveTab('security')}>
                                🔒 Security
                            </button>
                        </nav>
                    </aside>

                    <main className="settings-content">
                        {renderTabContent()}
                    </main>
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;
