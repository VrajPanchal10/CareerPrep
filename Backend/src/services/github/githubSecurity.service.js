/**
 * @module githubSecurity.service
 * @description Security validation layer for GitHub repository access.
 *
 * Responsibilities:
 *  - Validate that the authenticated GitHub user can access a specific repository
 *  - Check that OAuth scopes are sufficient for the requested operation
 *  - Sanitize repository metadata before sending to clients (strip sensitive fields)
 */

const { getAuthenticatedUser, getRepositoryMetadata, GitHubApiError, GITHUB_ERROR_CODES } = require("./githubApi.service");

// Sensitive fields that should never be exposed to the frontend
const METADATA_SENSITIVE_FIELDS = [
    "permissions",
    "allow_squash_merge",
    "allow_merge_commit",
    "allow_rebase_merge",
    "delete_branch_on_merge",
    "network_count",
    "subscribers_count",
    "source",
    "parent",
    "template_repository",
    "hooks_url",
    "keys_url",
    "collaborators_url",
    "teams_url"
];

/**
 * Validates that the OAuth token grants access to the specified repository.
 * This is the primary ownership/authorization guard — it runs before every analysis.
 *
 * @param {string} token - Decrypted access token
 * @param {string} owner
 * @param {string} repo
 * @returns {Promise<object>} Repository metadata if access is confirmed
 * @throws {GitHubApiError} if access is denied or repo is not found
 */
async function validateRepositoryAccess(token, source, owner, repo) {
    // Fetch the repo as the authenticated user — GitHub will 404 or 403 if no access
    const metadata = await getRepositoryMetadata(owner, repo, token);

    // If it is a private repo, we only allow access if we are using user OAuth credentials
    if (metadata.private && source !== "user") {
        throw new GitHubApiError(
            GITHUB_ERROR_CODES.FORBIDDEN,
            "This is a private repository. Please connect your GitHub account to analyze private repositories.",
            403
        );
    }

    return metadata;
}

/**
 * Checks that the user's OAuth scopes cover the required operations.
 *
 * @param {string[]} grantedScopes - Scopes stored on the User document
 * @param {string[]} requiredScopes - Scopes needed for this operation
 * @returns {{ adequate: boolean, missing: string[] }}
 */
function checkScopeAdequacy(grantedScopes, requiredScopes) {
    const granted = new Set(grantedScopes);
    const missing = requiredScopes.filter(s => !granted.has(s));
    return { adequate: missing.length === 0, missing };
}

/**
 * Strips internal/sensitive fields from GitHub repository metadata
 * before the data is returned to the frontend.
 *
 * @param {object} metadata - Raw GitHub API response
 * @returns {object} Sanitized metadata
 */
function sanitizeRepoMetadata(metadata) {
    const sanitized = { ...metadata };
    for (const field of METADATA_SENSITIVE_FIELDS) {
        delete sanitized[field];
    }
    return sanitized;
}

/**
 * Produces a safe public-facing repo summary object for the repository picker.
 *
 * @param {object} metadata - Raw or sanitized GitHub metadata
 * @returns {object}
 */
function buildRepoPickerEntry(metadata) {
    return {
        id: metadata.id,
        name: metadata.name,
        fullName: metadata.full_name,
        owner: metadata.owner?.login,
        description: metadata.description || null,
        isPrivate: metadata.private,
        language: metadata.language || null,
        defaultBranch: metadata.default_branch || "main",
        sizeKb: metadata.size || 0,
        stargazersCount: metadata.stargazers_count || 0,
        updatedAt: metadata.updated_at,
        htmlUrl: metadata.html_url,
        visibility: metadata.visibility || (metadata.private ? "private" : "public")
    };
}

module.exports = {
    validateRepositoryAccess,
    checkScopeAdequacy,
    sanitizeRepoMetadata,
    buildRepoPickerEntry
};
