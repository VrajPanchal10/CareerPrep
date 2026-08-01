import { useState, useEffect, useMemo, useCallback } from "react";
import { 
    fetchAtsReports, 
    fetchInterviewPlans, 
    fetchInterviewSessions, 
    fetchVoiceProgress, 
    fetchGithubProgress 
} from "../services/analytics.service";
import { calculateAverage, calculateBest, calculateConsistency, calculateImprovementTrend } from "../analyticsCalculations";
import { filterAttempts } from "../analyticsFilters";

/**
 * Custom hook managing unified analytics aggregation and calculations.
 */
export function useAnalytics(initialFilters = { dateRange: "all", role: "all", type: "all", repo: "all" }) {
    const [loading, setLoading] = useState(true);
    const [attempts, setAttempts] = useState([]);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [filters, setFilters] = useState(initialFilters);

    const loadAllMetrics = useCallback(async () => {
        setLoading(true);
        try {
            const [ats, plans, voice, github] = await Promise.all([
                fetchAtsReports(),
                fetchInterviewPlans(),
                fetchVoiceProgress(),
                fetchGithubProgress()
            ]);

            // Gather all sessions from all active interview plans
            let interviewSessions = [];
            if (Array.isArray(plans) && plans.length > 0) {
                const sessionLists = await Promise.all(
                    plans.map(p => fetchInterviewSessions(p._id).catch(() => []))
                );
                interviewSessions = sessionLists.flat();
            }

            const unifiedAttempts = [];

            // 1. Normalizing ATS Reports
            if (Array.isArray(ats)) {
                ats.forEach(report => {
                    unifiedAttempts.push({
                        id: report._id,
                        type: "ats",
                        title: report.resumeName || "ATS Resume Scan",
                        overallScore: report.atsScore || 0,
                        strongAreas: report.strongMatches || ["Resume Layout"],
                        weakAreas: report.missingKeywords || [],
                        date: report.createdAt || Date.now(),
                        role: report.jobTitle || "ATS Evaluation"
                    });
                });
            }

            // 2. Normalizing Interview Coaching Mock Sessions
            if (Array.isArray(interviewSessions)) {
                interviewSessions.forEach(session => {
                    unifiedAttempts.push({
                        id: session._id,
                        type: "interview",
                        title: "AI Interview Coach",
                        overallScore: session.overallScore || 0,
                        strongAreas: session.strongAreas || [],
                        weakAreas: session.weakAreas || [],
                        date: session.date || Date.now(),
                        role: "Software Engineer"
                    });
                });
            }



            // 4. Normalizing Verbal Mock Sessions
            if (voice && Array.isArray(voice.recentSessions)) {
                voice.recentSessions.forEach(attempt => {
                    unifiedAttempts.push({
                        id: attempt._id || attempt.id,
                        type: "voice",
                        title: "Verbal Mock Interview",
                        overallScore: attempt.overallScore || attempt.score || 0,
                        strongAreas: attempt.strongAreas || [],
                        weakAreas: attempt.weakAreas || [],
                        date: attempt.createdAt || attempt.completedAt || attempt.date || Date.now(),
                        role: "Communications"
                    });
                });
            }

            // 5. Normalizing Repository Defenses
            if (github && Array.isArray(github.recentAttempts)) {
                github.recentAttempts.forEach(attempt => {
                    unifiedAttempts.push({
                        id: attempt._id || attempt.id,
                        type: "github",
                        title: attempt.repoName || "Project Defense Review",
                        overallScore: attempt.readinessScore || attempt.score || 0,
                        strongAreas: attempt.strongAreas || [],
                        weakAreas: attempt.weakAreas || [],
                        date: attempt.createdAt || attempt.date || Date.now(),
                        role: "System Architecture"
                    });
                });
            }

            // Sort all attempts chronologically (oldest to newest)
            unifiedAttempts.sort((a, b) => new Date(a.date) - new Date(b.date));

            setAttempts(unifiedAttempts);
            setLastUpdated(new Date().toLocaleTimeString());
        } catch (err) {
            console.error("Aggregation failed in useAnalytics:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadAllMetrics();
    }, [loadAllMetrics]);

    // Apply filters with memoization to keep rendering efficient
    const filtered = useMemo(() => {
        return filterAttempts(attempts, filters);
    }, [attempts, filters]);

    // Compute and memoize statistics
    const summary = useMemo(() => {
        const scores = filtered.map(item => item.overallScore);
        
        const moduleCounts = { ats: 0, interview: 0, code: 0, voice: 0, github: 0 };
        const moduleScoreSums = { ats: 0, interview: 0, code: 0, voice: 0, github: 0 };
        const weakAreaCounts = {};

        filtered.forEach(item => {
            if (moduleCounts[item.type] !== undefined) {
                moduleCounts[item.type] += 1;
                moduleScoreSums[item.type] += (item.overallScore || 0);
            }
            if (Array.isArray(item.weakAreas)) {
                item.weakAreas.forEach(wa => {
                    if (wa) {
                        weakAreaCounts[wa] = (weakAreaCounts[wa] || 0) + 1;
                    }
                });
            }
        });
        
        const moduleAverages = {
            ats: moduleCounts.ats > 0 ? Math.round(moduleScoreSums.ats / moduleCounts.ats) : 0,
            interview: moduleCounts.interview > 0 ? Math.round(moduleScoreSums.interview / moduleCounts.interview) : 0,
            code: moduleCounts.code > 0 ? Math.round(moduleScoreSums.code / moduleCounts.code) : 0,
            voice: moduleCounts.voice > 0 ? Math.round(moduleScoreSums.voice / moduleCounts.voice) : 0,
            github: moduleCounts.github > 0 ? Math.round(moduleScoreSums.github / moduleCounts.github) : 0
        };
        
        const topWeaknesses = Object.entries(weakAreaCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 2)
            .map(entry => entry[0]);

        return {
            averageScore: calculateAverage(scores),
            bestScore: calculateBest(scores),
            consistencyScore: calculateConsistency(scores),
            improvementTrend: calculateImprovementTrend(scores),
            totalSessionsCount: filtered.length,
            moduleCounts,
            moduleAverages,
            topWeaknesses
        };
    }, [filtered]);

    const updateFilters = useCallback((newFilters) => {
        setFilters(prev => ({ ...prev, ...newFilters }));
    }, []);

    const exportDataFormat = useCallback(() => {
        // Formats dataset into standard table arrays suitable for CSV/JSON/PDF exports
        return filtered.map(item => ({
            "Exercise Type": item.type.toUpperCase(),
            "Title": item.title,
            "Target Role": item.role,
            "Rating Score": `${item.overallScore}%`,
            "Date": new Date(item.date).toLocaleDateString()
        }));
    }, [filtered]);

    return {
        loading,
        attempts: filtered,
        rawAttempts: attempts,
        summary,
        lastUpdated,
        filters,
        updateFilters,
        refresh: loadAllMetrics,
        exportData: exportDataFormat
    };
}
