import { generateAtsReport, getAtsReportById, getAllAtsReports, deleteAtsReport } from "../services/ats.api"
import { useContext, useEffect } from "react"
import { AtsContext } from "../ats.context"
import { useParams } from "react-router"
import { useToast } from "../../../context/ToastContext"

export const useAts = () => {
    const context = useContext(AtsContext)
    const { atsId } = useParams()
    const { addToast } = useToast()

    if (!context) {
        throw new Error("useAts must be used within an AtsProvider")
    }

    const { loading, setLoading, report, setReport, reports, setReports } = context

    const generateReport = async ({ jobDescription, resumeFile, onUploadProgress }) => {
        setLoading(true)
        let data = null
        try {
            const response = await generateAtsReport({ jobDescription, resumeFile, onUploadProgress })
            data = response.atsReport
            setReport(data)
            // Refresh list
            await getReports()
        } catch (error) {
            console.error("Error in useAts generateReport:", error)
            addToast(error?.response?.data?.message || "Failed to generate ATS analysis report.", "error")
        } finally {
            setLoading(false)
        }
        return data
    }

    const getReportById = async (id) => {
        setLoading(true)
        setReport(null)
        let data = null
        try {
            const response = await getAtsReportById(id)
            data = response.atsReport
            setReport(data)
        } catch (error) {
            console.error("Error in useAts getReportById:", error)
            addToast("Failed to retrieve ATS report.", "error")
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
            addToast("Failed to load ATS reports history.", "error")
        } finally {
            setLoading(false)
        }
        return data
    }

    const deleteReport = async (id) => {
        setLoading(true)
        try {
            const data = await deleteAtsReport(id)
            if (data && data.success) {
                setReports(prev => (prev || []).filter(r => r && r._id !== id))
                if (report && report._id === id) {
                    setReport(null)
                }
                addToast("ATS Match Scan deleted successfully.", "success")
                return true
            } else {
                addToast(data?.message || "Failed to delete ATS Match Scan.", "error")
                return false
            }
        } catch (error) {
            console.error("Error deleteReport hook in useAts:", error)
            if (!navigator.onLine || error?.code === "ERR_NETWORK" || error?.message === "Network Error") {
                addToast("No internet connection. Please check your network and try again.", "error")
            } else {
                const msg = error?.response?.data?.message || "Failed to delete ATS Match Scan."
                addToast(msg, "error")
            }
            return false
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (atsId) {
            getReportById(atsId)
        } else {
            getReports()
        }
    }, [ atsId ])

    return { loading, report, reports, generateReport, getReportById, getReports, deleteReport }
}
