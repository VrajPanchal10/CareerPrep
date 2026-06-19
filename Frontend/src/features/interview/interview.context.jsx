import { createContext,useState } from "react";


export const InterviewContext = createContext()

export const InterviewProvider = ({ children }) => {
    const [loading, setLoading] = useState(false)
    const [report, setReport] = useState(null)
    const [reports, setReports] = useState([])
    const [activeSession, setActiveSession] = useState(null)
    const [progressHistory, setProgressHistory] = useState([])

    return (
        <InterviewContext.Provider value={{ 
            loading, setLoading, 
            report, setReport, 
            reports, setReports,
            activeSession, setActiveSession,
            progressHistory, setProgressHistory
        }}>
            {children}
        </InterviewContext.Provider>
    )
}