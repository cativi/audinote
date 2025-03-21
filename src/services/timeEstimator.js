/**
 * @file timeEstimator.js
 * @description Main module that exports time estimation functionality
 */

// Import utilities from separate modules
const { parseDurationToSeconds, formatTime } = require('../utils/timeFormatter');
const { calculateEstimatedProcessingTime, calculateTimeDifference } = require('./processingTimeEstimator');
const { getAudioDuration } = require('./audioDurationDetector');
const { getVideoDuration } = require('./videoDurationDetector');

// Export all functionality as a unified API
module.exports = {
    // Time formatting utilities
    parseDurationToSeconds,
    formatTime,

    // Processing time estimation
    calculateEstimatedProcessingTime,
    calculateTimeDifference,

    // Media duration detection
    getAudioDuration,
    getVideoDuration
};