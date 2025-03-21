// routes/transcriptionRoutes.js
const express = require("express");
const { processAudio } = require("../services/audioProcessor");
const { transcribeAudio } = require("../services/transcriber");
const { AppError } = require("../utils/errorHandler");
const { deleteFile } = require("../utils/fileUtils");
const { allowedMimeTypes, allowedExtensions, allowedLanguages, defaultLanguage } = require("../config");
const { getAudioDuration, formatTime, calculateEstimatedProcessingTime, calculateTimeDifference } = require("../services/timeEstimator");
const logger = require("../utils/logger");

const router = express.Router();

// Validation middleware for request
const validateRequest = (req, res, next) => {
    if (!req.file) {
        return next(new AppError("No audio file provided.", 400));
    }

    logger.debug(`📂 File received: ${req.file.originalname} (MIME: ${req.file.mimetype})`);

    const hasAllowedExtension = new RegExp(`\\.(${allowedExtensions.join('|')})$`, "i").test(req.file.originalname);

    if (!allowedMimeTypes.includes(req.file.mimetype) && !hasAllowedExtension) {
        deleteFile(req.file.path);
        return next(new AppError(
            `Invalid file type: ${req.file.mimetype}. Only audio files (${allowedExtensions.join(', ').toUpperCase()}) are allowed.`,
            400
        ));
    }

    if (req.body.language && !allowedLanguages.includes(req.body.language)) {
        deleteFile(req.file.path);
        return next(new AppError(`Invalid language. Supported languages: ${allowedLanguages.join(', ')}`, 400));
    }

    next();
};

router.post("/", validateRequest, async (req, res, next) => {
    let wavFile = null;
    const startTime = Date.now();

    try {
        logger.info(`📥 Processing file: ${req.file.originalname}`);

        // Convert uploaded file to WAV
        wavFile = await processAudio(req.file.path);

        // Get audio duration using FFmpeg
        const durationSeconds = await getAudioDuration(wavFile);
        const durationFormatted = formatTime(durationSeconds);

        logger.info(`🎵 MP3 duration: ${durationFormatted.minutes} minutes ${durationFormatted.seconds} seconds.`);

        // Calculate estimated processing time
        const estimatedTime = calculateEstimatedProcessingTime(durationSeconds);
        logger.info(`⏳ Estimated processing time: ${estimatedTime.hours}h ${estimatedTime.minutes}m ${estimatedTime.seconds}s`);

        // Transcribe the processed file
        const language = req.body.language || defaultLanguage;
        const transcription = await transcribeAudio(wavFile, language);

        // Compute actual processing time
        const endTime = Date.now();
        const actualProcessingTimeSeconds = Math.round((endTime - startTime) / 1000);
        const actualTime = formatTime(actualProcessingTimeSeconds);

        // Calculate the difference between estimated and actual time
        const difference = calculateTimeDifference(actualProcessingTimeSeconds, estimatedTime);

        logger.info(`🚀 Actual processing time: ${actualTime.hours}h ${actualTime.minutes}m ${actualTime.seconds}s`);
        logger.info(`📉 Difference: ${difference.differenceText}`);

        res.json({
            success: true,
            language,
            audioDuration: durationFormatted,
            estimatedProcessingTime: estimatedTime,
            actualProcessingTime: actualTime,
            timeDifference: difference.timeObject,
            timeDifferenceText: difference.differenceText,
            ...transcription
        });
    } catch (error) {
        if (wavFile) {
            error.cleanup = wavFile;
        }
        next(error);
    }
});

module.exports = router;