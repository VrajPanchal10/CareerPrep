// Developer log aggregator helper (Development mode ONLY)
class DevLogger {
    static logs = [];
    static listeners = [];

    static log(category, details) {
        if (import.meta.env.PROD) return; // Completely disabled in production

        const logEntry = {
            id: Date.now() + Math.random().toString(),
            timestamp: new Date().toLocaleTimeString(),
            category, // "Resume Parsing", "ATS Analysis", "Repository Analysis", "Voice Interview", "Coding Evaluation"
            details: typeof details === "object" ? JSON.stringify(details, null, 2) : String(details)
        };
        DevLogger.logs.push(logEntry);
        DevLogger.listeners.forEach(cb => cb(DevLogger.logs));
    }

    static subscribe(cb) {
        DevLogger.listeners.push(cb);
        // Initial sync
        cb(DevLogger.logs);
        return () => {
            DevLogger.listeners = DevLogger.listeners.filter(listener => listener !== cb);
        };
    }

    static clear() {
        DevLogger.logs = [];
        DevLogger.listeners.forEach(cb => cb(DevLogger.logs));
    }
}

export default DevLogger;
