/**
 * @file timeEstimator.test.js
 * @description Integration tests for the main timeEstimator module
 */

// ✅ Only mock what's needed for isolation

jest.mock('../../src/services/audioDurationDetector', () => ({
    getAudioDuration: jest.fn()
}));

jest.mock('../../src/services/videoDurationDetector', () => ({
    getVideoDuration: jest.fn()
}));

// ✅ Partial mock: preserve real implementations except for calculateEstimatedProcessingTime
jest.mock('../../src/services/processingTimeEstimator', () => {
    const actual = jest.requireActual('../../src/services/processingTimeEstimator');
    return {
        ...actual,
        calculateEstimatedProcessingTime: jest.fn()
    };
});

// ✅ Do not mock the timeFormatter so that formatTime is real

// ✅ Import the module under test
const timeEstimator = require('../../src/services/timeEstimator');

// ✅ Import mocked functions
const { getAudioDuration } = require('../../src/services/audioDurationDetector');
const { getVideoDuration } = require('../../src/services/videoDurationDetector');
const { calculateEstimatedProcessingTime } = require('../../src/services/processingTimeEstimator');

// ✅ Import real implementations for utilities and functions we want to test
const { parseDurationToSeconds, formatTime } = require('../../src/utils/timeFormatter');
const { calculateTimeDifference } = require('../../src/services/processingTimeEstimator');

describe('TimeEstimator Service (Integration)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should correctly export all functions from their respective modules', () => {
        expect(timeEstimator.parseDurationToSeconds).toBe(parseDurationToSeconds);
        expect(timeEstimator.formatTime).toBe(formatTime);
        expect(timeEstimator.calculateEstimatedProcessingTime).toBe(calculateEstimatedProcessingTime);
        expect(timeEstimator.calculateTimeDifference).toBe(calculateTimeDifference);
        expect(timeEstimator.getAudioDuration).toBe(getAudioDuration);
        expect(timeEstimator.getVideoDuration).toBe(getVideoDuration);
    });

    it('should pass through function calls to the appropriate modules', async () => {
        // Setup return values for mocked functions
        getAudioDuration.mockResolvedValue(180);
        getVideoDuration.mockResolvedValue(300);
        calculateEstimatedProcessingTime.mockReturnValue({ totalSeconds: 64 });

        expect(timeEstimator.parseDurationToSeconds('2:00')).toBe(120);
        expect(timeEstimator.formatTime(120)).toEqual({
            hours: 0,
            minutes: 2,
            seconds: 0,
            totalSeconds: 120
        });
        expect(timeEstimator.calculateEstimatedProcessingTime(180)).toEqual({ totalSeconds: 64 });

        // We use the real calculateTimeDifference here
        expect(timeEstimator.calculateTimeDifference(60, 120)).toEqual({
            timeObject: {
                hours: 0,
                minutes: 1,
                seconds: 0,
                totalSeconds: 60
            },
            isFaster: true,
            differenceText: '1m 0s faster than estimated',
            differenceSeconds: 60
        });

        const audioDuration = await timeEstimator.getAudioDuration('file.mp3');
        expect(audioDuration).toBe(180);
        expect(getAudioDuration).toHaveBeenCalledWith('file.mp3');

        const videoDuration = await timeEstimator.getVideoDuration('https://youtube.com/watch?v=12345');
        expect(videoDuration).toBe(300);
        expect(getVideoDuration).toHaveBeenCalledWith('https://youtube.com/watch?v=12345');
    });

    it('should format output with hours difference when actual is slower than estimated', () => {
        const result = calculateTimeDifference(8000, 800); // diff = 7200s => 2h
        expect(result.isFaster).toBe(false);
        expect(result.differenceText).toBe('2h 0m 0s slower than estimated');
    });

    it('should format output with minutes difference when actual is slower than estimated', () => {
        const result = calculateTimeDifference(280, 100); // diff = 180s => 3m
        expect(result.isFaster).toBe(false);
        expect(result.differenceText).toBe('3m 0s slower than estimated');
    });

    it('should format output with seconds difference when actual is faster than estimated', () => {
        const result = calculateTimeDifference(95, 100); // diff = 5s
        expect(result.isFaster).toBe(true);
        expect(result.differenceText).toBe('5s faster than estimated');
    });
});
