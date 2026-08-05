import api from "../../../utils/apiClient";


/**
 * @description Service to generate interview report based on user self description, resume and job description.
 */
export const generateInterviewReport = async ({ jobDescription, selfDescription, resumeFile, resumeText, onUploadProgress }) => {

    const formData = new FormData()
    formData.append("jobDescription", jobDescription)
    formData.append("selfDescription", selfDescription || "")
    if (resumeFile) {
        formData.append("resume", resumeFile)
    }
    if (resumeText) {
        formData.append("resumeText", resumeText)
    }

    const response = await api.post("/api/interview/", formData, {
        headers: {
            "Content-Type": "multipart/form-data"
        },
        onUploadProgress
    })

    return response.data

}


/**
 * @description Service to get interview report by interviewId.
 */
export const getInterviewReportById = async (interviewId) => {
    const response = await api.get(`/api/interview/report/${interviewId}`)

    return response.data
}

/**
 * @description Service to delete an interview report by interviewId.
 */
export const deleteInterviewReport = async (interviewId) => {
    const response = await api.delete(`/api/interview/report/${interviewId}`)

    return response.data
}


/**
 * @description Service to get all interview reports of logged in user.
 */
export const getAllInterviewReports = async () => {
    const response = await api.get("/api/interview/")

    return response.data
}





/* --- MOCK INTERVIEW SESSIONS API --- */

/**
 * @description Start a new mock session for a specific interview plan report template.
 */
export const startInterviewSession = async ({ interviewReportId }) => {
    const response = await api.post("/api/interview/session", { interviewReportId })
    return response.data
}

/**
 * @description Complete the current active interview session.
 */
export const completeInterviewSession = async ({ sessionId }) => {
    const response = await api.post(`/api/interview/session/${sessionId}/complete`, {})
    return response.data
}

/**
 * @description Fetch a specific interview session details.
 */
export const getInterviewSessionById = async ({ sessionId }) => {
    const response = await api.get(`/api/interview/session/${sessionId}`)
    return response.data
}

/**
 * @description Evaluate an answer for a specific question.
 */
export const evaluateInterviewAnswer = async ({ sessionId, questionType, questionIndex, userAnswer }) => {
    const response = await api.post("/api/interview/evaluate-answer", {
        sessionId,
        questionType,
        questionIndex,
        userAnswer
    })
    return response.data
}

/**
 * @description Fetch progress snapshots for a given interview report template.
 */
export const getInterviewProgress = async ({ reportId }) => {
    const response = await api.get(`/api/interview/progress/${reportId}`)
    return response.data
}

/**
 * @description Export and download the PDF performance card report.
 */
export const downloadPerformancePdf = async ({ reportId }) => {
    const response = await api.get(`/api/interview/report/pdf/${reportId}`, {
        responseType: "blob"
    })
    return response.data
}