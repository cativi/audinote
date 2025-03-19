// routes/transcriptionRoutes.js
const express = require("express");
const { processAudio } = require("../services/audioProcessor");
const { transcribeAudio } = require("../services/transcriber");
const { AppError } = require("../utils/errorHandler");
const { deleteFile } = require("../utils/fileUtils");
const router = express.Router();

// Validation middleware for request
const validateRequest = (req, res, next) => {
    if (!req.file) {
        return next(new AppError("No audio file provided.", 400));
    }

    // Debug: Log the actual mimetype received
    console.log(`File received with mimetype: ${req.file.mimetype}`);

    // Validate file type with broader mime type acceptance
    // Some systems might report different mime types for the same file
    const allowedMimeTypes = [
        'audio/mpeg',
        'audio/mp3',
        'audio/wav',
        'audio/x-wav',
        'audio/x-mp3',
        'audio/mp4',
        'audio/x-m4a',
        'audio/aac',
        // Handle cases where mimetype might be missing or incorrectly identified
        'application/octet-stream'
    ];

    // Check if the filename ends with an allowed extension as fallback
    const hasAllowedExtension = /\.(mp3|wav|m4a|aac)$/i.test(req.file.originalname);

    if (!allowedMimeTypes.includes(req.file.mimetype) && !hasAllowedExtension) {
        // Clean up the invalid file
        deleteFile(req.file.path);
        return next(new AppError(
            `Invalid file type: ${req.file.mimetype}. Only audio files (MP3, WAV) are allowed.`,
            400
        ));
    }

    // Validate language parameter (if needed)
    const allowedLanguages = ['en', 'es'];
    if (req.body.language && !allowedLanguages.includes(req.body.language)) {
        deleteFile(req.file.path);
        return next(new AppError(`Invalid language. Supported languages: ${allowedLanguages.join(', ')}`, 400));
    }

    next();
};

router.post("/", validateRequest, async (req, res, next) => {
    let wavFile = null;

    try {
        console.log(`📥 Received file: ${req.file.originalname}`);

        // Process the audio file
        wavFile = await processAudio(req.file.path);

        // Transcribe the processed file
        const language = req.body.language || "en";
        const transcription = await transcribeAudio(wavFile, language);

        // Return success response
        res.json({
            success: true,
            language,
            ...transcription
        });

    } catch (error) {
        // If processAudio succeeded but transcribeAudio failed, we need to clean up the wavFile
        if (wavFile) {
            error.cleanup = wavFile;
        }
        next(error);
    }
});

module.exports = router;