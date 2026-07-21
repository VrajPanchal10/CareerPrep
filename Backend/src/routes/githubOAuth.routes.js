const express = require("express");
const authMiddleware = require("../middlewares/auth.middleware");
const {
    initiateOAuthController,
    oauthCallbackController,
    getGithubStatusController,
    disconnectGithubController,
    listRepositoriesController,
    getRateLimitController
} = require("../controllers/githubOAuth.controller");

const router = express.Router();

/**
 * @route GET /api/github-oauth/connect
 * @description Initiates GitHub OAuth flow — redirects browser to GitHub.
 * @access public (user must have an active session cookie though — validated inside callback)
 */
router.get("/connect", initiateOAuthController);

/**
 * @route GET /api/github-oauth/callback
 * @description GitHub redirects here after user authorizes.
 *   Validates CSRF state, exchanges code for token, stores encrypted token.
 * @access public (no auth middleware — session cookie validated inside controller)
 */
router.get("/callback", oauthCallbackController);

/**
 * @route GET /api/github-oauth/status
 * @description Returns connected GitHub account info.
 * @access private
 */
router.get("/status", authMiddleware.authUser, getGithubStatusController);

/**
 * @route DELETE /api/github-oauth/disconnect
 * @description Revokes GitHub token and clears stored credentials.
 * @access private + CSRF protected
 */
router.delete("/disconnect", authMiddleware.authUser, authMiddleware.csrfProtection, disconnectGithubController);

/**
 * @route GET /api/github-oauth/repositories
 * @description Lists user's GitHub repositories (personal + org) with search and pagination.
 * @access private
 * @query page, perPage, sort, search, visibility
 */
router.get("/repositories", authMiddleware.authUser, listRepositoriesController);

/**
 * @route GET /api/github-oauth/rate-limit
 * @description Returns current GitHub API rate limit status.
 * @access private
 */
router.get("/rate-limit", authMiddleware.authUser, getRateLimitController);

module.exports = router;
