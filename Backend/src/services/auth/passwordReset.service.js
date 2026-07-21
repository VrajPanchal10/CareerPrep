/**
 * Helper to validate server-side password complexity policy requirements:
 * - At least 8 characters.
 * - At least 1 uppercase letter.
 * - At least 1 lowercase letter.
 * - At least 1 numerical digit.
 */
function validatePasswordPolicy(password) {
    if (!password || typeof password !== "string") {
        return {
            isValid: false,
            message: "Password must be a valid text string."
        };
    }

    if (password.length < 8) {
        return {
            isValid: false,
            message: "Password must consist of at least 8 characters."
        };
    }

    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasDigit = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (!hasUppercase || !hasLowercase || !hasDigit || !hasSpecialChar) {
        return {
            isValid: false,
            message: "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character."
        };
    }

    return { isValid: true };
}

module.exports = {
    validatePasswordPolicy
};
