const express = require("express")
const cookieParser = require("cookie-parser")
const cors = require("cors")

const app = express()

app.use(express.json())
app.use(cookieParser())
app.use(cors({
    origin: "http://localhost:5173",
    credentials: true
}))

/* require all the routes here */
const authRouter = require("./routes/auth.routes")
const interviewRouter = require("./routes/interview.routes")


/* using all the routes here */
app.use("/api/auth", authRouter)
app.use("/api/interview", interviewRouter)

/* Global Error Handler Middleware */
app.use((err, req, res, next) => {
    console.error("Unhandled Error Caught by Global Middleware:", err);
    res.status(err.status || 500).json({
        success: false,
        message: "An unexpected error occurred on the server.",
        error: {
            code: err.code || "INTERNAL_SERVER_ERROR",
            details: process.env.NODE_ENV === "development" ? err.message : undefined
        }
    });
});

module.exports = app