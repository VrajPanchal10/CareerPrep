/**
 * Transcript Services for normalizing and analyzing transcript text.
 */

/**
 * Standardize text normalization (trim, remove double whitespaces, clean punctuation).
 */
function normalizeTranscript(text) {
    if (!text) return "";
    return text.trim().replace(/\s+/g, " ");
}

/**
 * Checks for language script matches. Returns warning string if script doesn't match selected language code.
 */
function checkLanguageMismatch(text, selectedLanguageCode) {
    if (!text) return null;

    const hasHindi = /[\u0900-\u097F]/.test(text);
    const hasGujarati = /[\u0A80-\u0AFF]/.test(text);

    if (selectedLanguageCode === "hi-IN" && !hasHindi) {
        // If Hindi selected but no Devanagari script is found (mostly Latin characters)
        return "Mismatch: You spoke/typed in English but the interview is currently set to Hindi (IN).";
    }

    if (selectedLanguageCode === "gu-IN" && !hasGujarati) {
        // If Gujarati selected but no Gujarati script is found
        return "Mismatch: You spoke/typed in English but the interview is currently set to Gujarati (IN).";
    }

    return null;
}

module.exports = {
    normalizeTranscript,
    checkLanguageMismatch
};
