/**
 * Computes comparative details across two or more historical attempts.
 */
export function compareAttempts(attemptsList) {
    if (!Array.isArray(attemptsList) || attemptsList.length === 0) {
        return {
            initialScore: 0,
            latestScore: 0,
            scoreDiff: 0,
            gainedStrengths: [],
            resolvedWeaknesses: [],
            progression: [],
            count: 0
        };
    }

    // Sort chronologically
    const sorted = [...attemptsList].sort((a, b) => {
        const dateA = new Date(a.createdAt || a.date || 0);
        const dateB = new Date(b.createdAt || b.date || 0);
        return dateA - dateB;
    });

    const count = sorted.length;
    const initial = sorted[0];
    const latest = sorted[count - 1];

    const initialScore = Number(initial.overallScore || initial.score || 0);
    const latestScore = Number(latest.overallScore || latest.score || 0);
    const scoreDiff = latestScore - initialScore;

    // Normalizing values for mapping checks
    const initialStr = (initial.strongAreas || []).map(s => s.toLowerCase());
    const gainedStrengths = (latest.strongAreas || []).filter(s => !initialStr.includes(s.toLowerCase()));

    const latestWeak = (latest.weakAreas || []).map(w => w.toLowerCase());
    const resolvedWeaknesses = (initial.weakAreas || []).filter(w => !latestWeak.includes(w.toLowerCase()));

    const progression = sorted.map((att, idx) => ({
        attemptNum: idx + 1,
        score: Number(att.overallScore || att.score || 0),
        date: new Date(att.createdAt || att.date || Date.now()).toLocaleDateString()
    }));

    return {
        initialScore,
        latestScore,
        scoreDiff,
        gainedStrengths,
        resolvedWeaknesses,
        progression,
        count
    };
}
