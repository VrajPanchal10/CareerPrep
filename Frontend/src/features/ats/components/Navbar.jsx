import React, { useState, useEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router'
import { useAuth } from '../../auth/hooks/useAuth'
import './Navbar.scss'

const Navbar = () => {
    const { user, handleLogout } = useAuth()
    const [isOpen, setIsOpen] = useState(false)
    const location = useLocation()
    const menuRef = useRef(null)
    const buttonRef = useRef(null)

    // Close menu when navigation path changes
    useEffect(() => {
        setIsOpen(false)
    }, [location.pathname])

    // Close when clicking outside of drawer and hamburger
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (isOpen && 
                menuRef.current && !menuRef.current.contains(event.target) &&
                buttonRef.current && !buttonRef.current.contains(event.target)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [isOpen])

    // Close when pressing the Escape key
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (isOpen && event.key === 'Escape') {
                setIsOpen(false)
                buttonRef.current?.focus()
            }
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [isOpen])

    return (
        <header className="main-navbar">
            <div className="navbar-logo">
                <span className="logo-icon">🚀</span>
                <span className="logo-text">Career<span className="highlight">Prep</span></span>
            </div>

            {/* Collapsible Mobile Menu Hamburger Toggle */}
            <button 
                ref={buttonRef}
                onClick={() => setIsOpen(!isOpen)}
                className={`navbar-hamburger ${isOpen ? 'navbar-hamburger--open' : ''}`}
                aria-expanded={isOpen}
                aria-controls="navbarLinksContainer"
                aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
                id="mobileMenuToggleBtn"
            >
                <span className="hamburger-line" />
                <span className="hamburger-line" />
                <span className="hamburger-line" />
            </button>

            {/* Sidebar / Links Drawer Wrapper */}
            <div 
                ref={menuRef}
                className={`navbar-responsive-menu ${isOpen ? 'navbar-responsive-menu--open' : ''}`}
                id="navbarLinksContainer"
            >
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
                    <NavLink to="/analytics" className={({ isActive }) => `nav-link ${isActive ? 'nav-link--active' : ''}`}>
                        Performance Analytics
                    </NavLink>
                    <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'nav-link--active' : ''}`}>
                        Settings
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
            </div>
        </header>
    )
}

export default Navbar
