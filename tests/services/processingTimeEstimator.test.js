/**
 * @file processingTimeEstimator.test.js
 * @description Unit tests for the processingTimeEstimator service
 */

jest.mock('../../src/config', () => ({
    timeEstimation: {
        fixedOverheadSeconds: 60,
        processingSpeedFactor: 30
    }
}));

jest.mock('../../src/utils/timeFormatter', () => ({
    formatTime: jest.fn(seconds => ({
        hours: Math.floor(seconds / 3600),
        minutes: Math.floor((seconds % 3600) / 60),
        seconds: Math.floor(seconds % 60),
        totalSeconds: Math.floor(seconds)
    }))
}));

jest.mock('../../src/utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn()
}));

const { calculateEstimatedProcessingTime, calculateTimeDifference } = require('../../src/services/processingTimeEstimator');
const { formatTime } = require('../../src/utils/timeFormatter');
const logger = require('../../src/utils/logger');

describe('Processing Time Estimator', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('calculateEstimatedProcessingTime', () => {
        it('should calculate processing time based on input duration', () => {
            const result = calculateEstimatedProcessingTime(300);
            expect(result.totalSeconds).toBe(70);
            expect(formatTime).toHaveBeenCalledWith(70);
            expect(logger.info).toHaveBeenCalledWith('⚠️ Actual audio duration detected: 5 minutes 0 seconds');
        });

        it('should use fallback for invalid durations', () => {
            const result1 = calculateEstimatedProcessingTime(0);
            expect(result1.totalSeconds).toBe(62);
            expect(logger.warn).toHaveBeenCalledWith('Invalid duration detected: 0s, using fallback estimate');

            const result2 = calculateEstimatedProcessingTime(-10);
            expect(result2.totalSeconds).toBe(62);
            expect(logger.warn).toHaveBeenCalledWith('Invalid duration detected: -10s, using fallback estimate');

            const result3 = calculateEstimatedProcessingTime(NaN);
            expect(result3.totalSeconds).toBe(62);
            expect(logger.warn).toHaveBeenCalledWith('Invalid duration detected: NaNs, using fallback estimate');
        });
    });

    describe('calculateTimeDifference', () => {
        it('should correctly calculate time difference when actual is less than estimated', () => {
            const result = calculateTimeDifference(50, 100);
            expect(result.isFaster).toBe(true);
            expect(result.differenceSeconds).toBe(50);
            expect(result.differenceText).toBe('50s faster than estimated');
        });

        it('should correctly calculate time difference when actual is more than estimated', () => {
            const result = calculateTimeDifference(100, 50);
            expect(result.isFaster).toBe(false);
            expect(result.differenceSeconds).toBe(50);
            expect(result.differenceText).toBe('50s slower than estimated');
        });

        it('should accept time object for estimated time', () => {
            const timeObj = {
                hours: 0,
                minutes: 1,
                seconds: 40,
                totalSeconds: 100
            };

            const result = calculateTimeDifference(50, timeObj);
            expect(result.isFaster).toBe(true);
            expect(result.differenceSeconds).toBe(50);
        });

        it('should format output based on duration difference', () => {
            formatTime.mockImplementationOnce(() => ({
                hours: 2,
                minutes: 0,
                seconds: 0,
                totalSeconds: 7200
            }));
            let result = calculateTimeDifference(0, 7200);
            expect(result.differenceText).toBe('2h 0m 0s faster than estimated');

            formatTime.mockImplementationOnce(() => ({
                hours: 0,
                minutes: 3,
                seconds: 0,
                totalSeconds: 180
            }));
            result = calculateTimeDifference(0, 180);
            expect(result.differenceText).toBe('3m 0s faster than estimated');

            formatTime.mockImplementationOnce(() => ({
                hours: 0,
                minutes: 0,
                seconds: 30,
                totalSeconds: 30
            }));
            result = calculateTimeDifference(0, 30);
            expect(result.differenceText).toBe('30s faster than estimated');
        });
    });
});