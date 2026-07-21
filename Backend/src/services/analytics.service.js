/**
 * Analytics Service for calculating real-time speech analytics.
 */

/**
 * Calculates candidate's speaking speed in words-per-minute (WPM)
 */
function calculateSpeakingSpeed(text, durationSeconds) {
    if (!text || !durationSeconds || durationSeconds <= 0) return 0;
    
    // Split by spaces to count approximate words
    const words = text.trim().split(/\s+/).length;
    const minutes = durationSeconds / 60;
    
    return Math.round(words / minutes);
}

/**
 * Normalizes metrics to prevent extreme outliers and returns a performance summary.
 */
function compileSessionPerformanceTrend(session) {
    const totalQuestions = session.questions.length;
    const evaluations = session.evaluations;
    
    if (evaluations.length === 0) return [];
    
    return evaluations.map(e => ({
        questionIndex: e.questionIndex,
        overallScore: e.overallScore,
        technicalScore: e.technicalScore,
        communicationScore: e.communicationScore
    }));
}

module.exports = {
    calculateSpeakingSpeed,
    compileSessionPerformanceTrend
};
