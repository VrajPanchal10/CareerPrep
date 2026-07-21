/**
 * Reusable helper metrics calculations for analytics.
 */

export function calculateAverage(scores) {
    if (!Array.isArray(scores) || scores.length === 0) return 0;
    const valid = scores.map(Number).filter(v => !isNaN(v));
    if (valid.length === 0) return 0;
    const sum = valid.reduce((acc, v) => acc + v, 0);
    return Math.round(sum / valid.length);
}

export function calculateBest(scores) {
    if (!Array.isArray(scores) || scores.length === 0) return 0;
    const valid = scores.map(Number).filter(v => !isNaN(v));
    if (valid.length === 0) return 0;
    return Math.max(...valid);
}

/**
 * Calculates consistency rating on a scale of 0 to 100 based on standard deviation.
 * Lower standard deviation = higher consistency.
 */
export function calculateConsistency(scores) {
    if (!Array.isArray(scores) || scores.length < 2) return 100;
    const valid = scores.map(Number).filter(v => !isNaN(v));
    if (valid.length < 2) return 100;

    const avg = valid.reduce((acc, v) => acc + v, 0) / valid.length;
    const variance = valid.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / valid.length;
    const stdDev = Math.sqrt(variance);

    // Map stdDev to a 0-100 score where 0 variance = 100 score, stdDev of 25+ = 0 score
    const consistency = Math.max(0, 100 - (stdDev * 4));
    return Math.round(consistency);
}

/**
 * Calculates the total score growth trend across historical attempts.
 */
export function calculateImprovementTrend(scores) {
    if (!Array.isArray(scores) || scores.length < 2) return 0;
    const valid = scores.map(Number).filter(v => !isNaN(v));
    if (valid.length < 2) return 0;

    const first = valid[0];
    const last = valid[valid.length - 1];
    return last - first;
}
