import { useAuth } from "../hooks/useAuth";
import { Navigate } from "react-router";
import React from 'react'

const Protected = ({children}) => {
    const { loading, user } = useAuth()

    if (loading) {
        return (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "75vh", flexDirection: "column", gap: "1rem" }}>
                <div style={{
                    width: "36px",
                    height: "36px",
                    border: "3.5px solid rgba(210, 13, 59, 0.1)",
                    borderTopColor: "#d20d3b",
                    borderRadius: "50%",
                    animation: "lazy-route-spin 0.8s linear infinite"
                }} />
                <p style={{ color: "rgba(255, 255, 255, 0.4)", fontSize: "0.82rem", letterSpacing: "0.05em", fontFamily: "inherit" }}>
                    Checking session...
                </p>
            </div>
        )
    }

    if (!user) {
        return <Navigate to={'/login'} />
    }

    return children
}

export default Protected