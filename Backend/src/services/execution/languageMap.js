const judge0Provider = require("./judge0.provider");

// Default aliases for Monaco editor mapping
const MONACO_MAP = {
    javascript: "javascript",
    typescript: "typescript",
    python: "python",
    c: "c",
    "c++": "cpp",
    cpp: "cpp",
    java: "java",
    go: "go",
    rust: "rust",
    kotlin: "kotlin",
    ruby: "ruby",
    php: "php",
    "c#": "csharp",
    csharp: "csharp",
    bash: "shell",
    r: "r",
    dart: "dart",
    swift: "swift",
    scala: "scala"
};

/**
 * Check if a language is supported based on the cached Piston runtimes.
 * @param {string} languageName
 * @returns {Promise<boolean>}
 */
async function isSupported(languageName) {
    if (!languageName) return false;
    const runtimes = await judge0Provider.getRuntimes();
    const normalizedName = languageName.toLowerCase();
    
    // When cache is empty (Judge0 down), fall back to known MONACO_MAP entries
    // This allows the actual execution to fail with a proper 503 (engine unavailable)
    // rather than a misleading 400 (unsupported language).
    if (runtimes.length === 0) {
        return normalizedName in MONACO_MAP;
    }
    
    // Check if any runtime matches language or alias
    return runtimes.some(r => r.name.toLowerCase().includes(normalizedName) || (MONACO_MAP[normalizedName] && r.name.toLowerCase().includes(MONACO_MAP[normalizedName])));
}

/**
 * Get a list of supported languages for the frontend.
 * Groups versions intelligently or returns a consolidated list.
 * @returns {Promise<Array<{ key: string, name: string, version: string, monacoId: string }>>}
 */
async function getSupportedLanguages() {
    const runtimes = await judge0Provider.getRuntimes();
    
    // Group by language to pick the highest version (or just return unique)
    const uniqueLanguages = new Map();
    
    runtimes.forEach(r => {
        // Simple heuristic to extract base language name from e.g. "Python (3.8.1)"
        const baseLang = r.name.split(" ")[0].toLowerCase();
        uniqueLanguages.set(baseLang, {
            language: baseLang,
            name: r.name,
            version: r.name.match(/\((.*?)\)/)?.[1] || "latest"
        });
    });

    return Array.from(uniqueLanguages.values()).map(r => ({
        key: r.language,
        name: r.name, // Will be something like "Python (3.8.1)"
        version: r.version,
        monacoId: MONACO_MAP[r.language] || "plaintext"
    })).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get the Monaco Editor language ID for a given language.
 * @param {string} languageName
 * @returns {string}
 */
function getMonacoId(languageName) {
    if (!languageName) return "plaintext";
    return MONACO_MAP[languageName.toLowerCase()] || "plaintext";
}

module.exports = {
    isSupported,
    getSupportedLanguages,
    getMonacoId
};
