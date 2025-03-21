// utils/errorHandler.js
const { deleteFile } = require('./fileUtils');
const logger = require('./logger');

// Custom error class for application-specific errors
class AppError extends Error {
    constructor(message, statusCode = 500, cleanup = null) {
        super(message);
        this.statusCode = statusCode;
        this.cleanup = cleanup;
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}

// Centralized error handler middleware
const errorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;

    // Log main error message
    logger.error(`❌ Error [${statusCode}]: ${err.message}`);

    // Log stack trace only in development
    if (process.env.NODE_ENV !== 'production') {
        logger.debug(err.stack);
    }

    // Clean up any resources attached to the error
    if (err.cleanup) {
        try {
            const files = Array.isArray(err.cleanup) ? err.cleanup : [err.cleanup];
            files.forEach(file => deleteFile(file));
        } catch (cleanupError) {
            logger.warn(`⚠️ Failed to clean up files: ${cleanupError.message}`);
        }
    }

    // Clean up uploaded file from req (fallback)
    if (req.file && req.file.path) {
        deleteFile(req.file.path);
    }

    res.status(statusCode).json({
        success: false,
        message: err.message,
        error: process.env.NODE_ENV === 'production' ? 'An error occurred' : err.stack
    });
};

module.exports = { errorHandler, AppError };
