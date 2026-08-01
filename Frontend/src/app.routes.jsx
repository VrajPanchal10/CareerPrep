import { createBrowserRouter, Outlet, useLocation } from "react-router";
import React, { useEffect, lazy, Suspense } from "react";
import Protected from "./features/auth/components/Protected";
import { ErrorBoundaryPage, ThemeToggle, DeveloperLogs } from "./components/ui";
import SessionExpiredModal from "./components/ui/SessionExpiredModal/SessionExpiredModal";
import DashboardLayout from "./components/layout/DashboardLayout";

// ── Lazy Loaded Pages ──────────────────────────────────────────────────────────
const Login = lazy(() => import("./features/auth/pages/Login"));
const Register = lazy(() => import("./features/auth/pages/Register"));
const ForgotPassword = lazy(() => import("./features/auth/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./features/auth/pages/ResetPassword"));
const Settings = lazy(() => import("./features/settings/pages/SettingsPage"));
const Home = lazy(() => import("./features/interview/pages/Home"));
const Interview = lazy(() => import("./features/interview/pages/Interview"));
const AtsHome = lazy(() => import("./features/ats/pages/AtsHome"));
const AtsDashboard = lazy(() => import("./features/ats/pages/AtsDashboard"));
const PerformanceDashboard = lazy(() => import("./features/interview/pages/PerformanceDashboard"));
const VoiceDashboard = lazy(() => import("./features/voiceInterview/pages/VoiceDashboard"));
const VoiceInterviewRoom = lazy(() => import("./features/voiceInterview/pages/VoiceInterviewRoom"));
const GithubDashboard = lazy(() => import("./features/githubDefense/pages/GithubDashboard"));
const GithubInterviewRoom = lazy(() => import("./features/githubDefense/pages/GithubInterviewRoom"));
const GlobalAnalytics = lazy(() => import("./features/analytics/pages/GlobalAnalytics"));

// Inject keyframe animation dynamically for the lazy loading spinner
if (typeof document !== "undefined") {
    const styleId = "lazy-loading-spin-style";
    if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.innerHTML = `
            @keyframes lazy-route-spin {
                to { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }
}

const PageLoadingFallback = () => (
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
            Loading workspace...
        </p>
    </div>
);

const LayoutWrapper = () => {
    const { pathname } = useLocation();

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [pathname]);

    const noSidebarRoutes = ['/login', '/register', '/forgot-password', '/reset-password'];
    const showSidebar = !noSidebarRoutes.some(route => pathname.startsWith(route));

    return (
        <>
            <Suspense fallback={<PageLoadingFallback />}>
                {showSidebar ? <DashboardLayout /> : <Outlet />}
            </Suspense>
            {!showSidebar && (
                <div style={{ position: "fixed", top: "18px", right: "24px", zIndex: 1200 }}>
                    <ThemeToggle />
                </div>
            )}
            <DeveloperLogs />
            <SessionExpiredModal />
        </>
    );
};

export const router = createBrowserRouter([
    {
        element: <LayoutWrapper />,
        errorElement: <ErrorBoundaryPage />,
        children: [
            {
                path: "/login",
                element: <Login />
            },
            {
                path: "/register",
                element: <Register />
            },
            {
                path: "/",
                element: <Protected><Home /></Protected>
            },
            {
                path: "/interview/:interviewId",
                element: <Protected><Interview /></Protected>
            },
            {
                path: "/interview/:interviewId/dashboard",
                element: <Protected><PerformanceDashboard /></Protected>
            },
            {
                path: "/ats",
                element: <Protected><AtsHome /></Protected>
            },
            {
                path: "/ats/:atsId",
                element: <Protected><AtsDashboard /></Protected>
            },
            {
                path: "/voice-interview",
                element: <Protected><VoiceDashboard /></Protected>
            },
            {
                path: "/voice-interview/room/:sessionId",
                element: <Protected><VoiceInterviewRoom /></Protected>
            },
            {
                path: "/github-defense",
                element: <Protected><GithubDashboard /></Protected>
            },
            {
                path: "/github-defense/room/:sessionId",
                element: <Protected><GithubInterviewRoom /></Protected>
            },
            {
                path: "/analytics",
                element: <Protected><GlobalAnalytics /></Protected>
            },
            {
                path: "/forgot-password",
                element: <ForgotPassword />
            },
            {
                path: "/reset-password/:token",
                element: <ResetPassword />
            },
            {
                path: "/settings",
                element: <Protected><Settings /></Protected>
            }
        ]
    }
]);