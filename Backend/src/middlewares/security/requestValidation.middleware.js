const { z } = require("zod");

/**
 * Reusable request validation middleware wrapper.
 * Validates request payload structures against Zod schemas.
 */
function validateRequest(schema) {
    return (req, res, next) => {
        try {
            schema.parse({
                body: req.body,
                query: req.query,
                params: req.params
            });
            next();
        } catch (err) {
            return res.status(400).json({
                success: false,
                message: "Payload validation constraint failed.",
                errors: err.errors || err.message
            });
        }
    };
}

module.exports = {
    validateRequest
};
