/**
 * @file audioDurationDetector.js
 * @description Service for detecting audio file duration
 */
const ffmpeg = require("fluent-ffmpeg");
const { spawn } = require("child_process");
const logger = require("../utils/logger");

/**
 * Gets the duration of an audio file using FFmpeg with robust error handling.
 * @param {string} filePath - The path to the audio file.
 * @returns {Promise<number>} - The duration in seconds.
 */
const getAudioDuration = (filePath) => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                logger.error(`ffprobe error: ${err.message}`);
                // Fallback method if ffprobe fails
                return fallbackDurationDetection(filePath, resolve);
            }

            if (!metadata || !metadata.format || typeof metadata.format.duration !== 'number') {
                logger.warn(`Invalid metadata format: ${JSON.stringify(metadata)}`);
                resolve(300); // Default to 5 minutes
                return;
            }

            const duration = metadata.format.duration;
            logger.info(`🎧 Audio duration detected: ${duration} seconds`);
            resolve(duration);
        });
    });
};

/**
 * Fallback method to detect audio duration using direct ffmpeg command.
 * @param {string} filePath - The path to the audio file.
 * @param {Function} resolve - The promise resolver.
 */
const fallbackDurationDetection = (filePath, resolve) => {
    logger.warn("⚠️ Attempting fallback duration detection method...");

    const ffmpeg_process = spawn('ffmpeg', ['-i', filePath]);
    let output = '';

    ffmpeg_process.stderr.on('data', (data) => {
        output += data.toString();
    });

    ffmpeg_process.on('close', (code) => {
        const durationMatch = output.match(/Duration: ([0-9]+):([0-9]+):([0-9]+\.[0-9]+)/);
        if (durationMatch) {
            const hours = parseInt(durationMatch[1]);
            const minutes = parseInt(durationMatch[2]);
            const seconds = parseFloat(durationMatch[3]);
            const totalSeconds = hours * 3600 + minutes * 60 + seconds;
            logger.info(`🎧 Fallback duration detected: ${hours}h ${minutes}m ${seconds}s`);
            resolve(totalSeconds);
        } else {
            logger.error("❌ Failed to extract duration from fallback method");
            resolve(300); // Default to 5 minutes
        }
    });
};

module.exports = {
    getAudioDuration
};
