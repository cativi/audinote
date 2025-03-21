/**
 * @file videoDurationDetector.js
 * @description Service for detecting YouTube video duration
 */

const { spawn } = require("child_process");
const { parseDurationToSeconds } = require('../utils/timeFormatter');
const logger = require('../utils/logger');

/**
 * Gets the duration of a YouTube video using yt-dlp with enhanced error handling.
 * @param {string} url - The YouTube video URL.
 * @returns {Promise<number>} - The duration in seconds.
 */
const getVideoDuration = (url) => {
    return new Promise((resolve, reject) => {
        const ytDlp = spawn("yt-dlp", ["--print", "duration_string", url]);
        let durationData = "";
        let errorOutput = "";

        ytDlp.stdout.on("data", (data) => {
            durationData += data.toString();
        });

        ytDlp.stderr.on("data", (data) => {
            const errMsg = data.toString();
            errorOutput += errMsg;
            logger.error(`yt-dlp (duration) error: ${errMsg}`);
        });

        ytDlp.on("close", (code) => {
            if (code === 0 && durationData.trim()) {
                logger.debug(`Raw duration from yt-dlp: "${durationData.trim()}"`);

                const seconds = parseDurationToSeconds(durationData.trim());
                if (seconds > 0) {
                    logger.info(`✅ Video duration detected: ${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s (${seconds}s)`);
                    resolve(seconds);
                } else {
                    logger.error(`❌ Failed to parse duration: "${durationData.trim()}"`);
                    fallbackGetDuration(url, resolve, reject);
                }
            } else {
                logger.error(`❌ yt-dlp failed with code ${code}: ${errorOutput}`);
                fallbackGetDuration(url, resolve, reject);
            }
        });
    });
};

/**
 * Fallback method to get video duration using different yt-dlp flags
 * @param {string} url - The YouTube video URL
 * @param {Function} resolve - The promise resolver
 * @param {Function} reject - The promise rejector
 */
const fallbackGetDuration = (url, resolve, reject) => {
    logger.warn("⚠️ Attempting fallback YouTube duration detection...");

    const ytDlpFallback = spawn("yt-dlp", ["--get-duration", url]);
    let durationData = "";

    ytDlpFallback.stdout.on("data", (data) => {
        durationData += data.toString();
    });

    ytDlpFallback.stderr.on("data", (data) => {
        logger.error(`Fallback yt-dlp error: ${data}`);
    });

    ytDlpFallback.on("close", (code) => {
        if (code === 0 && durationData.trim()) {
            logger.debug(`Fallback raw duration: "${durationData.trim()}"`);
            const seconds = parseDurationToSeconds(durationData.trim());
            if (seconds > 0) {
                logger.info(`✅ Fallback video duration: ${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`);
                resolve(seconds);
            } else {
                logger.error("❌ Failed to parse fallback duration");
                logger.warn("⚠️ Using default 10-minute duration estimate");
                resolve(600);
            }
        } else {
            logger.error("❌ Fallback duration detection failed");
            logger.warn("⚠️ Using default 10-minute duration estimate");
            resolve(600);
        }
    });
};

module.exports = {
    getVideoDuration
};
