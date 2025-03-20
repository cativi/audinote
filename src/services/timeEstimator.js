// services/timeEstimator.js
const ffmpeg = require("fluent-ffmpeg");
const { spawn } = require("child_process");
const { timeEstimation } = require('../config');

/**
 * Converts a duration string (e.g., "1:23:45" or "05:30") to seconds.
 * @param {string} durationStr - The duration string.
 * @returns {number} The duration in seconds.
 */

const parseDurationToSeconds = (durationStr) => {
    if (!durationStr || typeof durationStr !== 'string') {
        console.error(`Invalid duration string: ${durationStr}`);
        return 0;
    }

    durationStr = durationStr.trim();

    if (durationStr.includes(":")) {
        // Handle edge cases with empty parts or double colons
        // Replace multiple consecutive colons with a single one
        const normalizedStr = durationStr.replace(/:+/g, ':');

        // Handle strings starting with colon (e.g., ":30" becomes "0:30")
        const timeStr = normalizedStr.startsWith(':') ? `0${normalizedStr}` : normalizedStr;

        const parts = timeStr.split(":").map(part => {
            const num = parseFloat(part.trim());
            return isNaN(num) ? 0 : num;
        });

        if (parts.length === 3) {
            return parts[0] * 3600 + parts[1] * 60 + parts[2];
        } else if (parts.length === 2) {
            return parts[0] * 60 + parts[1];
        } else if (parts.length === 1 && parts[0] > 0) {
            return parts[0];
        }
    }

    const num = parseFloat(durationStr);
    return isNaN(num) ? 0 : num;
}

/**
 * Formats seconds into a human-readable time object.
 * @param {number} seconds - Total seconds to format.
 * @returns {Object} Object with hours, minutes, seconds, and totalSeconds properties.
 */
const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds) || seconds < 0) {
        seconds = 0;
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    return {
        hours,
        minutes,
        seconds: remainingSeconds,
        totalSeconds: Math.floor(seconds)
    };
};

/**
 * Calculates estimated processing time for audio/video based on duration.
 * @param {number} durationSeconds - Duration of the audio/video in seconds.
 * @returns {Object} Formatted time object with the estimate.
 */
const calculateEstimatedProcessingTime = (durationSeconds) => {
    // Ensure we have a valid duration
    if (!durationSeconds || durationSeconds <= 0 || isNaN(durationSeconds)) {
        console.warn(`Invalid duration detected: ${durationSeconds}s, using fallback estimate`);
        durationSeconds = 60; // Fallback to 1 minute if invalid duration
    }

    // Log actual detected duration for debugging
    console.log(`⚠️ Actual audio duration detected: ${Math.floor(durationSeconds / 60)} minutes ${Math.floor(durationSeconds % 60)} seconds`);

    // Calculate estimated time with 60 second overhead + 1/30 factor
    // This formula is based on real-world observations
    const estimatedSeconds = timeEstimation.fixedOverheadSeconds +
        Math.ceil(durationSeconds / timeEstimation.processingSpeedFactor);

    return formatTime(estimatedSeconds);
};

/**
 * Calculates the difference between estimated and actual processing time.
 * @param {number} actualSeconds - Actual processing time in seconds.
 * @param {number|Object} estimatedSeconds - Estimated processing time in seconds or a time object.
 * @returns {Object} Object containing difference details and formatted text.
 */
const calculateTimeDifference = (actualSeconds, estimatedSeconds) => {
    // Handle both number and object input for estimatedSeconds
    const estimatedTotal = typeof estimatedSeconds === 'object' ?
        estimatedSeconds.totalSeconds : estimatedSeconds;

    // Calculate the absolute difference
    const differenceSeconds = Math.abs(actualSeconds - estimatedTotal);
    const difference = formatTime(differenceSeconds);

    // Determine if processing was faster or slower than estimated
    const isFaster = actualSeconds <= estimatedTotal;

    // Format the difference text
    let differenceText;
    if (difference.hours > 0) {
        differenceText = `${difference.hours}h ${difference.minutes}m ${difference.seconds}s ${isFaster ? 'faster' : 'slower'} than estimated`;
    } else if (difference.minutes > 0) {
        differenceText = `${difference.minutes}m ${difference.seconds}s ${isFaster ? 'faster' : 'slower'} than estimated`;
    } else {
        differenceText = `${difference.seconds}s ${isFaster ? 'faster' : 'slower'} than estimated`;
    }

    return {
        timeObject: difference,
        isFaster,
        differenceText,
        differenceSeconds
    };
};

/**
 * Gets the duration of an audio file using FFmpeg with robust error handling.
 * @param {string} filePath - The path to the audio file.
 * @returns {Promise<number>} - The duration in seconds.
 */
const getAudioDuration = (filePath) => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                console.error(`❌ ffprobe error: ${err.message}`);
                // Fallback method if ffprobe fails
                console.log("⚠️ Attempting fallback duration detection method...");

                const ffmpeg_process = spawn('ffmpeg', ['-i', filePath]);
                let output = '';

                ffmpeg_process.stderr.on('data', (data) => {
                    output += data.toString();
                });

                ffmpeg_process.on('close', (code) => {
                    // Look for duration info in ffmpeg output
                    const durationMatch = output.match(/Duration: ([0-9]+):([0-9]+):([0-9]+\.[0-9]+)/);
                    if (durationMatch) {
                        const hours = parseInt(durationMatch[1]);
                        const minutes = parseInt(durationMatch[2]);
                        const seconds = parseFloat(durationMatch[3]);
                        const totalSeconds = hours * 3600 + minutes * 60 + seconds;
                        console.log(`⚠️ Fallback duration detected: ${hours}h ${minutes}m ${seconds}s`);
                        resolve(totalSeconds);
                    } else {
                        console.error("❌ Failed to extract duration from fallback method");
                        resolve(300); // Default to 5 minutes if all methods fail
                    }
                });

                return;
            }

            if (!metadata || !metadata.format || typeof metadata.format.duration !== 'number') {
                console.error(`❌ Invalid metadata format: ${JSON.stringify(metadata)}`);
                resolve(300); // Default to 5 minutes
                return;
            }

            const duration = metadata.format.duration;
            console.log(`✅ Audio duration detected: ${duration} seconds`);
            resolve(duration);
        });
    });
};

/**
 * Gets the duration of a YouTube video using yt-dlp with enhanced error handling.
 * @param {string} url - The YouTube video URL.
 * @returns {Promise<number>} - The duration in seconds.
 */
const getVideoDuration = (url) => {
    return new Promise((resolve, reject) => {
        // Try using the --print duration_string format which is more reliable
        const ytDlp = spawn("yt-dlp", ["--print", "duration_string", url]);
        let durationData = "";
        let errorOutput = "";

        ytDlp.stdout.on("data", (data) => {
            durationData += data.toString();
        });

        ytDlp.stderr.on("data", (data) => {
            const errMsg = data.toString();
            errorOutput += errMsg;
            console.error(`yt-dlp (duration) error: ${errMsg}`);
        });

        ytDlp.on("close", (code) => {
            if (code === 0 && durationData.trim()) {
                // Log the raw output for debugging
                console.log(`Raw duration from yt-dlp: "${durationData.trim()}"`);

                const seconds = parseDurationToSeconds(durationData.trim());
                if (seconds > 0) {
                    console.log(`✅ Video duration detected: ${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s (${seconds}s)`);
                    resolve(seconds);
                } else {
                    console.error(`❌ Failed to parse duration: "${durationData.trim()}"`);
                    fallbackGetDuration(url, resolve, reject);
                }
            } else {
                console.error(`❌ yt-dlp failed with code ${code}: ${errorOutput}`);
                fallbackGetDuration(url, resolve, reject);
            }
        });
    });
};

/**
 * Fallback method to get video duration using different yt-dlp flags
 */
const fallbackGetDuration = (url, resolve, reject) => {
    console.log("⚠️ Attempting fallback YouTube duration detection...");

    // Try using the info flag approach
    const ytDlpFallback = spawn("yt-dlp", ["--get-duration", url]);
    let durationData = "";

    ytDlpFallback.stdout.on("data", (data) => {
        durationData += data.toString();
    });

    ytDlpFallback.stderr.on("data", (data) => {
        console.error(`Fallback yt-dlp error: ${data}`);
    });

    ytDlpFallback.on("close", (code) => {
        if (code === 0 && durationData.trim()) {
            console.log(`Fallback raw duration: "${durationData.trim()}"`);
            const seconds = parseDurationToSeconds(durationData.trim());
            if (seconds > 0) {
                console.log(`✅ Fallback video duration: ${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`);
                resolve(seconds);
            } else {
                console.error(`❌ Failed to parse fallback duration`);
                // Use a reasonable estimate as last resort
                console.warn("⚠️ Using default 10-minute duration estimate");
                resolve(600);
            }
        } else {
            console.error(`❌ Fallback duration detection failed`);
            // Use a reasonable estimate as last resort
            console.warn("⚠️ Using default 10-minute duration estimate");
            resolve(600);
        }
    });
};

module.exports = {
    parseDurationToSeconds,
    calculateEstimatedProcessingTime,
    getAudioDuration,
    getVideoDuration,
    formatTime,
    calculateTimeDifference
};