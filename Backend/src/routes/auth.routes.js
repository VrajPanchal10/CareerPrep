const { Router } = require('express')
const authController = require("../controllers/auth.controller")
const authMiddleware = require("../middlewares/auth.middleware")

const { authLimiter, forgotPasswordLimiter } = require("../middlewares/auth.middleware")

const authRouter = Router()

/**
 * @route POST /api/auth/register
 * @description Register a new user
 * @access Public
 */
authRouter.post("/register", authLimiter, authController.registerUserController)


/**
 * @route POST /api/auth/login
 * @description login user with email and password
 * @access Public
 */
authRouter.post("/login", authLimiter, authController.loginUserController)


/**
 * @route GET /api/auth/logout
 * @description clear token from user cookie and add the token in blacklist
 * @access public
 */
authRouter.get("/logout", authController.logoutUserController)


/**
 * @route GET /api/auth/get-me
 * @description get the current logged in user details
 * @access private
 */
authRouter.get("/get-me", authMiddleware.authUser, authController.getMeController)


/**
 * @route POST /api/auth/refresh
 * @description refresh current user session token
 * @access Public
 */
authRouter.post("/refresh", authController.refreshTokenController)


/**
 * @route POST /api/auth/forgot-password
 * @description Inbound password reset request
 */
authRouter.post("/forgot-password", forgotPasswordLimiter, authController.forgotPasswordController)

/**
 * @route GET /api/auth/reset-password/validate/:token
 * @description Validate password recovery token status before showing password form
 */
authRouter.get("/reset-password/validate/:token", authLimiter, authController.validateResetTokenController)

/**
 * @route POST /api/auth/reset-password
 * @description Submit new password using recovery token
 */
authRouter.post("/reset-password", authLimiter, authController.resetPasswordController)

/**
 * @route POST /api/auth/mfa/enable
 * @description Initialize authenticator setup and retrieve QR Code
 */
authRouter.post("/mfa/enable", authMiddleware.authUser, authController.enableMfaController)

/**
 * @route POST /api/auth/mfa/confirm
 * @description Verify first code input and fully activate MFA
 */
authRouter.post("/mfa/confirm", authMiddleware.authUser, authController.confirmMfaController)

/**
 * @route POST /api/auth/mfa/disable
 * @description Turn off MFA security
 */
authRouter.post("/mfa/disable", authMiddleware.authUser, authController.disableMfaController)

/**
 * @route POST /api/auth/mfa/verify
 * @description Verify 2-step verification code to finish login
 */
authRouter.post("/mfa/verify", authLimiter, authController.verifyMfaController)


module.exports = authRouter