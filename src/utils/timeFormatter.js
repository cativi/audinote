// src/utils/timeFormatter.js
/**
 * @file timeFormatter.js
 * @description Utilities for time format conversion and formatting
 */

const logger = require('./logger');

/**
 * Converts a duration string (e.g., "1:23:45" or "05:30") to seconds.
 * @param {string} durationStr - The duration string.
 * @returns {number} The duration in seconds.
 */
const parseDurationToSeconds = (durationStr) => {
    if (!durationStr || typeof durationStr !== 'string') {
        logger.error(`Invalid duration string: ${durationStr}`);
        return 0;
    }

    durationStr = durationStr.trim();

    if (durationStr.includes(":")) {
        const normalizedStr = durationStr.replace(/:+/g, ':');
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
};

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

module.exports = {
    parseDurationToSeconds,
    formatTime
};
