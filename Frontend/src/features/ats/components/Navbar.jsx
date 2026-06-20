import React from 'react'
import { NavLink } from 'react-router'
import { useAuth } from '../../auth/hooks/useAuth'
import './Navbar.scss'

const Navbar = () => {
    const { user, handleLogout } = useAuth()

    return (
        <header className="main-navbar">
            <div className="navbar-logo">
                <span className="logo-icon">🚀</span>
                <span className="logo-text">Career<span className="highlight">Prep</span></span>
            </div>
            <nav className="navbar-links">
                <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'nav-link--active' : ''}`} end>
                    Interview Coach
                </NavLink>
                <NavLink to="/ats" className={({ isActive }) => `nav-link ${isActive ? 'nav-link--active' : ''}`}>
                    ATS Match & Heatmap
                </NavLink>
                <NavLink to="/code" className={({ isActive }) => `nav-link ${isActive ? 'nav-link--active' : ''}`}>
                    Coding Workspace
                </NavLink>
            </nav>
            <div className="navbar-user">
                {user && (
                    <>
                        <span className="username">Hi, {user.username}</span>
                        <button onClick={handleLogout} className="logout-btn">
                            Logout
                        </button>
                    </>
                )}
            </div>
        </header>
    )
}

export default Navbar
