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

const router = express.Router();

// Function to download audio using yt-dlp
const downloadAudioWithYtDlp = (url, outputPath) => {
    return new Promise((resolve, reject) => {
        const ytDlp = spawn("yt-dlp", ["-f", "bestaudio", "-o", outputPath, url]);

        ytDlp.stdout.on("data", (data) => {
            console.log(`yt-dlp: ${data}`);
        });

        ytDlp.stderr.on("data", (data) => {
            console.error(`yt-dlp error: ${data}`);
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
        console.log(`📥 Downloading YouTube audio from: ${url}`);
        const startTime = Date.now(); // Start time tracking

        // Get the video duration using the centralized function
        const durationSeconds = await getVideoDuration(url);

        // Create formatted time object with the utility function
        const durationFormatted = formatTime(durationSeconds);
        console.log(`🎬 YT video lasts ${durationFormatted.minutes} minutes ${durationFormatted.seconds} seconds.`);

        // Calculate estimated processing time
        const estimatedTime = calculateEstimatedProcessingTime(durationSeconds);
        console.log(`⏳ Estimated processing time: ${estimatedTime.hours}h ${estimatedTime.minutes}m ${estimatedTime.seconds}s`);

        // Download the audio using yt-dlp
        await downloadAudioWithYtDlp(url, tempFilename);
        console.log("✅ YouTube audio download complete.");

        // Process the downloaded file (convert to WAV)
        const wavFile = await processAudio(tempFilename);

        // Transcribe the audio
        const transcriptionLanguage = language || require("../config").defaultLanguage;
        const transcription = await transcribeAudio(wavFile, transcriptionLanguage);

        // Compute actual processing time
        const endTime = Date.now();
        const actualProcessingTimeSeconds = Math.round((endTime - startTime) / 1000);
        const actualTime = formatTime(actualProcessingTimeSeconds);

        // Calculate the difference between estimated and actual time
        const difference = calculateTimeDifference(actualProcessingTimeSeconds, estimatedTime);

        console.log(`🚀 Actual processing time: ${actualTime.hours}h ${actualTime.minutes}m ${actualTime.seconds}s`);
        console.log(`📉 Difference: ${difference.differenceText}`);

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

module.exports = router;