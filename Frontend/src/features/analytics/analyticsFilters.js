/**
 * Helper to apply dynamic filters onto raw analytics attempts lists.
 */
export function filterAttempts(attemptsList, filters = {}) {
    if (!Array.isArray(attemptsList)) return [];

    return attemptsList.filter(item => {
        // Date range filter checks
        if (filters.dateRange && filters.dateRange !== "all") {
            const itemDate = new Date(item.createdAt || item.date || Date.now());
            const limit = new Date();
            if (filters.dateRange === "7days") {
                limit.setDate(limit.getDate() - 7);
            } else if (filters.dateRange === "30days") {
                limit.setDate(limit.getDate() - 30);
            }
            if (itemDate < limit) return false;
        }

        // Target role check
        if (filters.role && filters.role !== "all") {
            const itemRole = (item.role || item.jobDescription || item.jobTitle || "").toLowerCase();
            const filterRole = filters.role.toLowerCase();
            if (!itemRole.includes(filterRole)) return false;
        }

        // Exercise type check
        if (filters.type && filters.type !== "all") {
            const itemType = (item.type || "").toLowerCase();
            if (itemType !== filters.type.toLowerCase()) return false;
        }

        return true;
    });
}
