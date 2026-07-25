import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, Outlet } from 'react-router';
import { useAuth } from '../../features/auth/hooks/useAuth';
import './DashboardLayout.scss';

// SVG Icons
const Icons = {
    Rocket: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-3.05 11a22.35 22.35 0 0 1-3.95 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>
    ),
    Coach: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
    ),
    Ats: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
    ),
    Code: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
    ),
    Analytics: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
    ),
    Settings: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
    ),
    Search: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    ),
    Bell: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
    ),
    Help: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
    ),
    Logout: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
    )
};

const DashboardLayout = () => {
    const { user, handleLogout } = useAuth();
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    useEffect(() => {
        setIsSidebarOpen(false);
    }, [location.pathname]);

    return (
        <div className="dashboard-layout">
            {/* Sidebar */}
            <aside className={`dashboard-sidebar ${isSidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <span className="logo-icon"><Icons.Rocket /></span>
                    <span className="logo-text">Career<span className="highlight">Prep</span> <span className="pro-tag">Pro</span></span>
                </div>

                <nav className="sidebar-nav">
                    <NavLink to="/" className={({ isActive }) => `nav-item ${isActive && location.pathname === '/' ? 'active' : ''}`} end>
                        <span className="icon"><Icons.Coach /></span>
                        Interview Coach
                    </NavLink>
                    <NavLink to="/ats" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <span className="icon"><Icons.Ats /></span>
                        ATS Match & Heatmap
                    </NavLink>
                    <NavLink to="/code" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <span className="icon"><Icons.Code /></span>
                        Coding Workspace
                    </NavLink>
                    <NavLink to="/analytics" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <span className="icon"><Icons.Analytics /></span>
                        Performance Analytics
                    </NavLink>
                    <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <span className="icon"><Icons.Settings /></span>
                        Settings
                    </NavLink>
                </nav>

                <div className="sidebar-footer">
                    {user && (
                        <div className="user-profile-widget">
                            <div className="avatar">
                                {user.username ? user.username.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <div className="user-info">
                                <span className="username">{user.username || 'User'}</span>
                                <span className="badge">Pro Badge</span>
                            </div>
                            <button className="logout-btn" onClick={handleLogout} title="Logout">
                                <Icons.Logout />
                            </button>
                        </div>
                    )}
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="dashboard-main">
                {/* Top Header */}
                <header className="dashboard-header">
                    <div className="mobile-toggle" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                        ☰
                    </div>
                    
                    <div className="header-title">
                        <h2>{
                            location.pathname === '/' ? 'Refined Pro Dashboard' : 
                            location.pathname.includes('/voice') ? 'Voice-to-Voice AI Interview Simulator' :
                            location.pathname.includes('/github') ? 'GitHub Project Defense Interview Simulator' :
                            location.pathname.includes('/ats') ? 'ATS Match & Heatmap' :
                            location.pathname.includes('/code') ? 'Coding Workspace' :
                            location.pathname.includes('/analytics') ? 'Performance Analytics' :
                            location.pathname.includes('/settings') ? 'Settings' :
                            'Refined Pro Dashboard'
                        }</h2>
                    </div>

                    <div className="header-actions">
                        <div className="search-bar">
                            <span className="search-icon"><Icons.Search /></span>
                            <input type="text" placeholder="Search..." />
                        </div>
                        <button className="action-btn notifications" aria-label="Notifications">
                            <Icons.Bell />
                            <span className="indicator"></span>
                        </button>
                        <button className="action-btn help" aria-label="Help Center">
                            <Icons.Help />
                            <span>Help Center</span>
                        </button>
                    </div>
                </header>

                {/* Page Content */}
                <main className="dashboard-content">
                    <Outlet />
                </main>
            </div>
            
            {/* Overlay for mobile sidebar */}
            {isSidebarOpen && <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>}
        </div>
    );
};

export default DashboardLayout;
