/**
 * atsDeterministic.service.js
 * 
 * 0-dependency deterministic ATS engine.
 * Parses text, filters stopwords, extracts keywords, and calculates overlap.
 */

const STOP_WORDS = new Set([
    "a","about","above","after","again","against","all","am","an","and","any","are","aren't","as","at","be","because","been","before","being","below","between","both","but","by","can't","cannot","could","couldn't","did","didn't","do","does","doesn't","doing","don't","down","during","each","few","for","from","further","had","hadn't","has","hasn't","have","haven't","having","he","he'd","he'll","he's","her","here","here's","hers","herself","him","himself","his","how","how's","i","i'd","i'll","i'm","i've","if","in","into","is","isn't","it","it's","its","itself","let's","me","more","most","mustn't","my","myself","no","nor","not","of","off","on","once","only","or","other","ought","our","ours","ourselves","out","over","own","same","shan't","she","she'd","she'll","she's","should","shouldn't","so","some","such","than","that","that's","the","their","theirs","them","themselves","then","there","there's","these","they","they'd","they'll","they're","they've","this","those","through","to","too","under","until","up","very","was","wasn't","we","we'd","we'll","we're","we've","were","weren't","what","what's","when","when's","where","where's","which","while","who","who's","whom","why","why's","with","won't","would","wouldn't","you","you'd","you'll","you're","you've","your","yours","yourself","yourselves",
    // Also ignore common non-technical resume words
    "experience", "years", "work", "job", "description", "requirements", "skills", "ability", "strong", "understanding", "knowledge", "working", "using", "including", "required", "preferred", "role", "team", "development", "developer", "engineer", "engineering", "software", "building", "design", "good", "excellent", "proven", "track", "record", "looking", "candidate", "responsibilities", "responsible", "business", "application", "applications", "system", "systems", "support", "environment", "solutions", "project", "projects", "company", "join", "help", "new", "ensure", "best", "practices", "opportunity", "opportunities", "fast", "paced", "high", "quality", "end", "user", "users", "technical", "technology", "technologies"
]);

/**
 * Tokenize and normalize text
 */
function tokenize(text) {
    if (!text) return [];
    // Convert to lowercase, replace punctuation/newlines with space, and split
    const normalized = text.toLowerCase()
        // preserve some tech keywords with dots/pluses like node.js, c++, c#
        .replace(/(?<![a-zA-Z])c\+\+(?![a-zA-Z])/g, 'cplusplus')
        .replace(/(?<![a-zA-Z])c#(?![a-zA-Z])/g, 'csharp')
        .replace(/(?<![a-zA-Z])\.net(?![a-zA-Z])/g, 'dotnet')
        .replace(/node\.js/g, 'nodejs')
        .replace(/react\.js/g, 'reactjs')
        .replace(/vue\.js/g, 'vuejs')
        .replace(/[^\w\s-]/g, ' ') // remove special chars except hyphen
        .split(/\s+/)
        .filter(word => word.length > 1) // remove single letters
        .map(word => word.replace(/-+$/, '').replace(/^-+/, '')); // trim hyphens
        
    return normalized.filter(word => word.length > 1 && !STOP_WORDS.has(word));
}

/**
 * Extract frequent terms from a text array to act as keywords.
 * For JD, words appearing multiple times or unique tech words.
 */
function extractKeywords(tokens, maxKeywords = 30) {
    const frequency = {};
    for (const token of tokens) {
        frequency[token] = (frequency[token] || 0) + 1;
    }

    // Sort by frequency descending
    const sorted = Object.entries(frequency).sort((a, b) => b[1] - a[1]);
    
    // Return top N keywords
    return sorted.slice(0, maxKeywords).map(entry => entry[0]);
}

/**
 * Deterministically evaluate resume against JD
 */
function evaluate(resume, jobDescription) {
    const jdTokens = tokenize(jobDescription);
    const resumeTokens = tokenize(resume);
    const resumeTokenSet = new Set(resumeTokens);
    
    // 1. Identify JD Keywords (Top 25)
    const jdKeywords = extractKeywords(jdTokens, 25);
    
    // 2. Compute Matches
    const matchedKeywords = [];
    const missingKeywords = [];
    
    for (const kw of jdKeywords) {
        if (resumeTokenSet.has(kw)) {
            matchedKeywords.push(kw);
        } else {
            missingKeywords.push(kw);
        }
    }
    
    // 3. Keyword Match % (Weight: 45%)
    let keywordMatch = 0;
    if (jdKeywords.length > 0) {
        keywordMatch = Math.round((matchedKeywords.length / jdKeywords.length) * 100);
    }
    
    // 4. Heuristics (Experience, Education, Projects)
    const resumeLower = resume.toLowerCase();
    const hasEducation = resumeLower.includes("education") || resumeLower.includes("university") || resumeLower.includes("college") || resumeLower.includes("bachelor") || resumeLower.includes("degree");
    const hasExperience = resumeLower.includes("experience") || resumeLower.includes("employment") || resumeLower.includes("work history");
    const hasProjects = resumeLower.includes("project") || resumeLower.includes("portfolio") || resumeLower.includes("github");
    
    // Education Match (10%)
    let educationMatch = hasEducation ? 100 : 30; // 30 is penalty
    
    // Experience Match (25%)
    let experienceMatch = hasExperience ? 100 : 40;
    
    // Projects Match (20%)
    let projectsMatch = hasProjects ? 100 : 50;

    // Technical Skills format (assuming if they have high keyword match, tech skills is high)
    let technicalSkillsMatch = Math.min(100, Math.round(keywordMatch * 1.1));
    
    // Compute Base ATS Score
    const baseScore = Math.round(
        (keywordMatch * 0.45) + 
        (experienceMatch * 0.25) + 
        (projectsMatch * 0.20) + 
        (educationMatch * 0.10)
    );

    // Format output strings slightly to look better (e.g. cplusplus -> c++)
    const formatWord = (w) => w.replace('cplusplus', 'c++').replace('csharp', 'c#').replace('dotnet', '.net').replace('nodejs', 'node.js').replace('reactjs', 'react.js').replace('vuejs', 'vue.js');
    
    return {
        baseScore,
        breakdown: {
            keywordMatch,
            technicalSkillsMatch,
            experienceMatch,
            educationMatch,
            projectsMatch
        },
        matchedKeywords: matchedKeywords.map(formatWord),
        missingKeywords: missingKeywords.map(formatWord)
    };
}

module.exports = {
    evaluate
};
