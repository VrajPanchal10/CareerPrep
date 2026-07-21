import api from "../../../utils/apiClient";

/**
 * @description Service to generate ATS match report based on resume file and job description.
 */
export const generateAtsReport = async ({ jobDescription, resumeFile, onUploadProgress }) => {
    const formData = new FormData()
    formData.append("jobDescription", jobDescription)
    formData.append("resume", resumeFile)

    const response = await api.post("/api/ats/analyze", formData, {
        headers: {
            "Content-Type": "multipart/form-data"
        },
        onUploadProgress
    })

    return response.data
}

/**
 * @description Service to get a specific ATS report by ID.
 */
export const getAtsReportById = async (atsId) => {
    const response = await api.get(`/api/ats/report/${atsId}`)
    return response.data
}

/**
 * @description Service to get all ATS reports of the logged-in user.
 */
export const getAllAtsReports = async () => {
    const response = await api.get("/api/ats/")
    return response.data
}
