import { generateAtsReport, getAtsReportById, getAllAtsReports } from "../services/ats.api"
import { useContext, useEffect } from "react"
import { AtsContext } from "../ats.context"
import { useParams } from "react-router"

export const useAts = () => {
    const context = useContext(AtsContext)
    const { atsId } = useParams()

    if (!context) {
        throw new Error("useAts must be used within an AtsProvider")
    }

    const { loading, setLoading, report, setReport, reports, setReports } = context

    const generateReport = async ({ jobDescription, resumeFile }) => {
        setLoading(true)
        let data = null
        try {
            const response = await generateAtsReport({ jobDescription, resumeFile })
            data = response.atsReport
            setReport(data)
            // Refresh list
            await getReports()
        } catch (error) {
            console.error("Error in useAts generateReport:", error)
        } finally {
            setLoading(false)
        }
        return data
    }

    const getReportById = async (id) => {
        setLoading(true)
        let data = null
        try {
            const response = await getAtsReportById(id)
            data = response.atsReport
            setReport(data)
        } catch (error) {
            console.error("Error in useAts getReportById:", error)
        } finally {
            setLoading(false)
        }
        return data
    }

    const getReports = async () => {
        setLoading(true)
        let data = null
        try {
            const response = await getAllAtsReports()
            data = response.atsReports
            setReports(data)
        } catch (error) {
            console.error("Error in useAts getReports:", error)
        } finally {
            setLoading(false)
        }
        return data
    }

    useEffect(() => {
        if (atsId) {
            getReportById(atsId)
        } else {
            getReports()
        }
    }, [ atsId ])

    return { loading, report, reports, generateReport, getReportById, getReports }
}
