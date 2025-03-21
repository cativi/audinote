/**
 * @file processingTimeEstimator.js
 * @description Utilities for estimating media processing times
 */

const { timeEstimation } = require('../config');
const { formatTime } = require('../utils/timeFormatter');
const logger = require('../utils/logger');

/**
 * Calculates estimated processing time for audio/video based on duration.
 * @param {number} durationSeconds - Duration of the audio/video in seconds.
 * @returns {Object} Formatted time object with the estimate.
 */
const calculateEstimatedProcessingTime = (durationSeconds) => {
    if (!durationSeconds || durationSeconds <= 0 || isNaN(durationSeconds)) {
        logger.warn(`Invalid duration detected: ${durationSeconds}s, using fallback estimate`);
        durationSeconds = 60; // Fallback to 1 minute if invalid duration
    }

    logger.info(`⚠️ Actual audio duration detected: ${Math.floor(durationSeconds / 60)} minutes ${Math.floor(durationSeconds % 60)} seconds`);

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
    const estimatedTotal = typeof estimatedSeconds === 'object' ?
        estimatedSeconds.totalSeconds : estimatedSeconds;

    const differenceSeconds = Math.abs(actualSeconds - estimatedTotal);
    const difference = formatTime(differenceSeconds);
    const isFaster = actualSeconds <= estimatedTotal;

    let differenceText;
    if (difference.hours > 0) {
        differenceText = `${difference.hours}h ${difference.minutes}m ${difference.seconds}s ${isFaster ? 'faster' : 'slower'} than estimated`;
    } else if (difference.minutes > 0) {
        differenceText = `${difference.minutes}m ${difference.seconds}s ${isFaster ? 'faster' : 'slower'} than estimated`;
    } else {
        differenceText = `${difference.seconds}s ${isFaster ? 'faster' : 'slower'} than estimated`;
    }

    const logLevel = isFaster ? 'info' : 'warn';
    logger[logLevel](`📉 Difference: Processing was ${differenceText}`);

    return {
        timeObject: difference,
        isFaster,
        differenceText,
        differenceSeconds
    };
};

module.exports = {
    calculateEstimatedProcessingTime,
    calculateTimeDifference
};
