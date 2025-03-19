// utils/errorHandler.js
const { deleteFile } = require('./fileUtils');

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
    // Get status code from error if available, default to 500
    const statusCode = err.statusCode || 500;

    // Log error details (consider different log levels based on status code)
    console.error(`❌ Error [${statusCode}]:`, err.message);
    if (process.env.NODE_ENV !== 'production') {
        console.error(err.stack);
    }

    // If there are files to clean up, do it
    if (err.cleanup) {
        try {
            if (Array.isArray(err.cleanup)) {
                err.cleanup.forEach(file => deleteFile(file));
            } else {
                deleteFile(err.cleanup);
            }
        } catch (cleanupError) {
            console.error('Failed to clean up files:', cleanupError);
        }
    }

    // Clean up any uploaded file that might still be there in case of error
    if (req.file && req.file.path) {
        deleteFile(req.file.path);
    }

    // Send appropriate response based on the error
    res.status(statusCode).json({
        success: false,
        message: err.message,
        error: process.env.NODE_ENV === 'production' ? 'An error occurred' : err.stack
    });
};

module.exports = { errorHandler, AppError };