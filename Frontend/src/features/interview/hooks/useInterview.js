import { 
    getAllInterviewReports, 
    generateInterviewReport, 
    getInterviewReportById, 
    generateResumePdf,
    startInterviewSession,
    completeInterviewSession,
    getInterviewSessionById,
    evaluateInterviewAnswer,
    getInterviewProgress,
    downloadPerformancePdf
} from "../services/interview.api"
import { useContext, useEffect } from "react"
import { InterviewContext } from "../interview.context"
import { useParams } from "react-router"


export const useInterview = () => {

    const context = useContext(InterviewContext)
    const { interviewId } = useParams()

    if (!context) {
        throw new Error("useInterview must be used within an InterviewProvider")
    }

    const { 
        loading, setLoading, 
        report, setReport, 
        reports, setReports,
        activeSession, setActiveSession,
        progressHistory, setProgressHistory
    } = context

    const generateReport = async ({ jobDescription, selfDescription, resumeFile }) => {
        setLoading(true)
        let response = null
        try {
            response = await generateInterviewReport({ jobDescription, selfDescription, resumeFile })
            setReport(response.interviewReport)
        } catch (error) {
            console.log(error)
        } finally {
            setLoading(false)
        }

        return response.interviewReport
    }

    const getReportById = async (id) => {
        setLoading(true)
        let response = null
        try {
            response = await getInterviewReportById(id)
            setReport(response.interviewReport)
        } catch (error) {
            console.log(error)
        } finally {
            setLoading(false)
        }
        return response.interviewReport
    }

    const getReports = async () => {
        setLoading(true)
        let response = null
        try {
            response = await getAllInterviewReports()
            setReports(response.interviewReports)
        } catch (error) {
            console.log(error)
        } finally {
            setLoading(false)
        }

        return response.interviewReports
    }

    const getResumePdf = async (interviewReportId) => {
        setLoading(true)
        let response = null
        try {
            response = await generateResumePdf({ interviewReportId })
            const url = window.URL.createObjectURL(new Blob([ response ], { type: "application/pdf" }))
            const link = document.createElement("a")
            link.href = url
            link.setAttribute("download", `resume_${interviewReportId}.pdf`)
            document.body.appendChild(link)
            link.click()
        }
        catch (error) {
            console.log(error)
        } finally {
            setLoading(false)
        }
    }

    /* --- SESSION & DASHBOARD LOGIC --- */

    const startSession = async (reportId) => {
        setLoading(true)
        let data = null
        try {
            const response = await startInterviewSession({ interviewReportId: reportId })
            data = response.session
            setActiveSession(data)
        } catch (error) {
            console.error("Error startSession hook:", error)
        } finally {
            setLoading(false)
        }
        return data
    }

    const submitAnswer = async ({ sessionId, questionType, questionIndex, userAnswer }) => {
        setLoading(true)
        let data = null
        try {
            const response = await evaluateInterviewAnswer({
                sessionId,
                questionType,
                questionIndex,
                userAnswer
            })
            data = response.evaluation
            // Refresh local session data
            setActiveSession(response.session)
        } catch (error) {
            console.error("Error submitAnswer hook:", error)
        } finally {
            setLoading(false)
        }
        return data
    }

    const completeSession = async (sessionId) => {
        setLoading(true)
        let data = null
        try {
            const response = await completeInterviewSession({ sessionId })
            data = response.session
            setActiveSession(data)
            if (report?._id) {
                await loadProgress(report._id)
            }
        } catch (error) {
            console.error("Error completeSession hook:", error)
        } finally {
            setLoading(false)
        }
        return data
    }

    const loadSessionById = async (sessionId) => {
        setLoading(true)
        let data = null
        try {
            const response = await getInterviewSessionById({ sessionId })
            data = response.session
            setActiveSession(data)
        } catch (error) {
            console.error("Error loadSessionById hook:", error)
        } finally {
            setLoading(false)
        }
        return data
    }

    const loadProgress = async (reportId) => {
        try {
            const response = await getInterviewProgress({ reportId })
            setProgressHistory(response.progress || [])
        } catch (error) {
            console.error("Error loadProgress hook:", error)
        }
    }

    const downloadReportPdf = async (reportId) => {
        setLoading(true)
        try {
            const response = await downloadPerformancePdf({ reportId })
            const url = window.URL.createObjectURL(new Blob([ response ], { type: "application/pdf" }))
            const link = document.createElement("a")
            link.href = url
            link.setAttribute("download", `performance_report_${reportId}.pdf`)
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
        } catch (error) {
            console.error("Error downloadReportPdf hook:", error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (interviewId) {
            getReportById(interviewId)
            loadProgress(interviewId)
        } else {
            getReports()
        }
    }, [ interviewId ])

    return { 
        loading, report, reports, activeSession, progressHistory, 
        generateReport, getReportById, getReports, getResumePdf,
        startSession, submitAnswer, completeSession, loadSessionById, loadProgress,
        downloadReportPdf
    }

}