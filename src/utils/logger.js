// utils/logger.js
const { createLogger, format, transports } = require("winston");

const logger = createLogger({
    level: process.env.NODE_ENV === "production" ? "info" : "debug",
    format: format.combine(
        format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        format.printf(({ timestamp, level, message }) => {
            return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
        })
    ),
    transports: [
        new transports.Console()
    ],
});

module.exports = logger;
