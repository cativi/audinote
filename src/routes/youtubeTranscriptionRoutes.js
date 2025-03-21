// routes/youtubeTranscriptionRoutes.js
const express = require("express");
const { processAudio } = require("../services/audioProcessor");
const { transcribeAudio } = require("../services/transcriber");
const { AppError } = require("../utils/errorHandler");
const { deleteFile } = require("../utils/fileUtils");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const { getVideoDuration, formatTime, calculateEstimatedProcessingTime, calculateTimeDifference } = require("../services/timeEstimator");
const logger = require("../utils/logger"); // ✅ Added logger

const router = express.Router();

// Function to download audio using yt-dlp
const downloadAudioWithYtDlp = (url, outputPath) => {
    return new Promise((resolve, reject) => {
        const ytDlp = spawn("yt-dlp", ["-f", "bestaudio", "-o", outputPath, url]);

        ytDlp.stdout.on("data", (data) => {
            logger.debug(`yt-dlp: ${data}`);
        });

        ytDlp.stderr.on("data", (data) => {
            logger.warn(`yt-dlp error: ${data}`);
        });

        ytDlp.on("close", (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new AppError(`yt-dlp exited with code ${code}`, 500));
            }
        });
    });
};

// Endpoint: POST /youtube
router.post("/", async (req, res, next) => {
    const { url, language } = req.body;
    if (!url) {
        return next(new AppError("YouTube URL is required.", 400));
    }

    const tempFilename = path.join("uploads", `${Date.now()}-youtube.mp3`);

    try {
        logger.info(`📥 Downloading YouTube audio from: ${url}`);
        const startTime = Date.now(); // Start time tracking

        // Get the video duration
        const durationSeconds = await getVideoDuration(url);
        const durationFormatted = formatTime(durationSeconds);
        logger.info(`🎬 YT video lasts ${durationFormatted.minutes} minutes ${durationFormatted.seconds} seconds.`);

        // Estimate processing time
        const estimatedTime = calculateEstimatedProcessingTime(durationSeconds);
        logger.info(`⏳ Estimated processing time: ${estimatedTime.hours}h ${estimatedTime.minutes}m ${estimatedTime.seconds}s`);

        // Download the audio
        await downloadAudioWithYtDlp(url, tempFilename);
        logger.info("✅ YouTube audio download complete.");

        // Convert to WAV
        const wavFile = await processAudio(tempFilename);

        // Transcribe
        const transcriptionLanguage = language || require("../config").defaultLanguage;
        const transcription = await transcribeAudio(wavFile, transcriptionLanguage);

        // Calculate actual processing time
        const endTime = Date.now();
        const actualProcessingTimeSeconds = Math.round((endTime - startTime) / 1000);
        const actualTime = formatTime(actualProcessingTimeSeconds);

        // Time difference
        const difference = calculateTimeDifference(actualProcessingTimeSeconds, estimatedTime);

        logger.info(`🚀 Actual processing time: ${actualTime.hours}h ${actualTime.minutes}m ${actualTime.seconds}s`);
        logger.info(`📉 Difference: ${difference.differenceText}`);

        res.json({
            success: true,
            language: transcriptionLanguage,
            videoDuration: durationFormatted,
            estimatedProcessingTime: estimatedTime,
            actualProcessingTime: actualTime,
            timeDifference: difference.timeObject,
            timeDifferenceText: difference.differenceText,
            ...transcription
        });
    } catch (error) {
        if (fs.existsSync(tempFilename)) {
            deleteFile(tempFilename);
        }
        next(error);
    }
});

router.downloadAudioWithYtDlp = downloadAudioWithYtDlp;
module.exports = router;