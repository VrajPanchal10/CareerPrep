import React, { createContext, useState } from "react";

export const AtsContext = createContext()

export const AtsProvider = ({ children }) => {
    const [loading, setLoading] = useState(false)
    const [report, setReport] = useState(null)
    const [reports, setReports] = useState([])

    return (
        <AtsContext.Provider value={{ loading, setLoading, report, setReport, reports, setReports }}>
            {children}
        </AtsContext.Provider>
    )
}
