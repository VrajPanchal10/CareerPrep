const CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "https://careerprep-platform.vercel.app",
    process.env.FRONTEND_URL
].map(o => o && o.replace(/\/$/, "")).filter(Boolean);

const CSP_DIRECTIVES = {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
    fontSrc: ["'self'", "fonts.gstatic.com", "data:"],
    imgSrc: ["'self'", "data:", "blob:"],
    objectSrc: ["'none'"],
};

const TRUSTED_DEVELOPMENT_CLIENTS = {
    headers: {
        "x-trusted-client": "careerprep-dev-tool"
    },
    ips: ["127.0.0.1", "::1", "::ffff:127.0.0.1"]
};

const COOKIE_SETTINGS = {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
};

module.exports = {
    CORS_ALLOWED_ORIGINS,
    CSP_DIRECTIVES,
    TRUSTED_DEVELOPMENT_CLIENTS,
    COOKIE_SETTINGS
};
