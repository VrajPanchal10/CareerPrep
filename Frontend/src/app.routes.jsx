import { createBrowserRouter } from "react-router";
import Login from "./features/auth/pages/Login";
import Register from "./features/auth/pages/Register";
import Protected from "./features/auth/components/Protected";
import Home from "./features/interview/pages/Home";
import Interview from "./features/interview/pages/Interview";
import AtsHome from "./features/ats/pages/AtsHome";
import AtsDashboard from "./features/ats/pages/AtsDashboard";
import PerformanceDashboard from "./features/interview/pages/PerformanceDashboard";
import CodeWorkspace from "./features/code/pages/CodeWorkspace";
import CodingDashboard from "./features/code/pages/CodingDashboard";
import VoiceDashboard from "./features/voiceInterview/pages/VoiceDashboard";
import VoiceInterviewRoom from "./features/voiceInterview/pages/VoiceInterviewRoom";
import GithubDashboard from "./features/githubDefense/pages/GithubDashboard";
import GithubInterviewRoom from "./features/githubDefense/pages/GithubInterviewRoom";


export const router = createBrowserRouter([
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
        path: "/code",
        element: <Protected><CodeWorkspace /></Protected>
    },
    {
        path: "/code/dashboard",
        element: <Protected><CodingDashboard /></Protected>
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
    }
])
