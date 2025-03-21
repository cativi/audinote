/**
 * @file videoDurationDetector.test.js
 * @description Improved unit tests for the videoDurationDetector service
 */

// Mock dependencies
jest.mock('child_process');
jest.mock('../../src/utils/timeFormatter', () => ({
    parseDurationToSeconds: jest.fn(str => {
        if (str === '10:30') return 630;
        if (str === '5:45') return 345;
        if (str === 'invalid') return 0;
        return 0;
    })
}));

// Mock logger
jest.mock('../../src/utils/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
}));

const { spawn } = require('child_process');
const { parseDurationToSeconds } = require('../../src/utils/timeFormatter');
const { getVideoDuration } = require('../../src/services/videoDurationDetector');
const logger = require('../../src/utils/logger');

beforeEach(() => {
    jest.clearAllMocks();
});

describe('Video Duration Detector', () => {
    const createMockYtDlpProcess = (stdoutData, stderrData, exitCode = 0) => {
        return {
            stdout: {
                on: jest.fn((event, cb) => event === 'data' && stdoutData && cb(Buffer.from(stdoutData)))
            },
            stderr: {
                on: jest.fn((event, cb) => event === 'data' && stderrData && cb(Buffer.from(stderrData)))
            },
            on: jest.fn((event, cb) => event === 'close' && cb(exitCode))
        };
    };

    it('should get duration using yt-dlp successfully', async () => {
        const mockProcess = createMockYtDlpProcess('10:30', '', 0);
        spawn.mockReturnValue(mockProcess);

        const duration = await getVideoDuration('https://youtube.com/watch?v=12345');

        expect(duration).toBe(630);
        expect(parseDurationToSeconds).toHaveBeenCalledWith('10:30');
        expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Video duration detected'));
    });

    it('should fallback when yt-dlp fails', async () => {
        const mockFail = createMockYtDlpProcess('', '', 1);
        const mockFallback = createMockYtDlpProcess('5:45', '', 0);
        spawn.mockReturnValueOnce(mockFail).mockReturnValueOnce(mockFallback);

        const duration = await getVideoDuration('https://youtube.com/watch?v=12345');

        expect(duration).toBe(345);
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('fallback'));
    });

    it('should use default when fallback fails', async () => {
        const mockFail1 = createMockYtDlpProcess('', '', 1);
        const mockFail2 = createMockYtDlpProcess('', '', 1);
        spawn.mockReturnValueOnce(mockFail1).mockReturnValueOnce(mockFail2);

        const duration = await getVideoDuration('https://youtube.com/watch?v=12345');

        expect(duration).toBe(600);
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('default 10-minute duration estimate'));
    });

    it('should log stderr from primary method', async () => {
        const mockProcess = createMockYtDlpProcess('10:30', 'Some yt-dlp error', 0);
        spawn.mockReturnValue(mockProcess);

        const duration = await getVideoDuration('https://youtube.com/watch?v=12345');

        expect(duration).toBe(630);
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Some yt-dlp error'));
    });

    it('should fallback when parseDurationToSeconds returns 0', async () => {
        const mockProcess = createMockYtDlpProcess('invalid', '', 0);
        const mockFallback = createMockYtDlpProcess('5:45', '', 0);
        spawn.mockReturnValueOnce(mockProcess).mockReturnValueOnce(mockFallback);

        const duration = await getVideoDuration('https://youtube.com/watch?v=12345');

        expect(duration).toBe(345);
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to parse duration'));
    });

    it('should handle stderr output in fallback', async () => {
        const mockFail = createMockYtDlpProcess('', '', 1);
        const mockFallback = createMockYtDlpProcess('5:45', 'Fallback error', 0);
        spawn.mockReturnValueOnce(mockFail).mockReturnValueOnce(mockFallback);

        const duration = await getVideoDuration('https://youtube.com/watch?v=12345');

        expect(duration).toBe(345);
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Fallback error'));
    });

    it('should use default when fallback duration parsing fails', async () => {
        const mockFail = createMockYtDlpProcess('', '', 1);
        const mockFallback = createMockYtDlpProcess('invalid', '', 0);
        spawn.mockReturnValueOnce(mockFail).mockReturnValueOnce(mockFallback);

        const duration = await getVideoDuration('https://youtube.com/watch?v=12345');

        expect(duration).toBe(600);
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to parse fallback duration'));
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('default 10-minute duration estimate'));
    });
});
