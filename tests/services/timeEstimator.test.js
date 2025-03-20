const {
    parseDurationToSeconds,
    formatTime,
    calculateEstimatedProcessingTime,
    calculateTimeDifference,
    getAudioDuration,
    getVideoDuration
} = require('../../src/services/timeEstimator');

// Mocking dependencies
jest.mock('fluent-ffmpeg');
jest.mock('child_process');

// Mock the config module
jest.mock('../../src/config', () => ({
    timeEstimation: {
        fixedOverheadSeconds: 60,
        processingSpeedFactor: 30
    }
}));

const ffmpeg = require('fluent-ffmpeg');
const { spawn } = require('child_process');

describe('timeEstimator.js', () => {
    // Reset all mocks before each test
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('parseDurationToSeconds', () => {
        test('Valid HH:MM:SS format', () => {
            expect(parseDurationToSeconds('1:23:45')).toBe(5025);
        });

        test('Valid MM:SS format', () => {
            expect(parseDurationToSeconds('05:30')).toBe(330);
            expect(parseDurationToSeconds('00:30')).toBe(30);
        });

        test('Numeric string input', () => {
            expect(parseDurationToSeconds('60')).toBe(60);
        });

        test('Invalid inputs', () => {
            expect(parseDurationToSeconds(null)).toBe(0);
            expect(parseDurationToSeconds('')).toBe(0);
            expect(parseDurationToSeconds('invalid')).toBe(0);
            expect(parseDurationToSeconds('1:2:invalid')).toBe(3720); // 1h + 2m + 0s
            expect(parseDurationToSeconds(undefined)).toBe(0);
        });

        test('Malformed time formats', () => {
            expect(parseDurationToSeconds('1::30')).toBe(90); // Treats as 1:00:30
            expect(parseDurationToSeconds(':30')).toBe(30); // Treats as 0:30
        });
    });

    describe('formatTime', () => {
        test('Simple case - zero seconds', () => {
            expect(formatTime(0)).toEqual({
                hours: 0,
                minutes: 0,
                seconds: 0,
                totalSeconds: 0
            });
        });

        test('Complex case - hours, minutes, and seconds', () => {
            expect(formatTime(3750)).toEqual({
                hours: 1,
                minutes: 2,
                seconds: 30,
                totalSeconds: 3750
            });
        });

        test('Large number', () => {
            expect(formatTime(10000)).toEqual({
                hours: 2,
                minutes: 46,
                seconds: 40,
                totalSeconds: 10000
            });
        });

        test('Invalid inputs', () => {
            expect(formatTime(null)).toEqual({
                hours: 0,
                minutes: 0,
                seconds: 0,
                totalSeconds: 0
            });
            expect(formatTime(NaN)).toEqual({
                hours: 0,
                minutes: 0,
                seconds: 0,
                totalSeconds: 0
            });
            expect(formatTime(-100)).toEqual({
                hours: 0,
                minutes: 0,
                seconds: 0,
                totalSeconds: 0
            });
        });

        test('Floating point seconds', () => {
            expect(formatTime(65.7)).toEqual({
                hours: 0,
                minutes: 1,
                seconds: 5,
                totalSeconds: 65
            });
        });
    });

    describe('calculateEstimatedProcessingTime', () => {
        test('Normal input', () => {
            const result = calculateEstimatedProcessingTime(120);
            // Should be 60s (overhead) + 120/30 = 4s => 64s
            expect(result).toEqual({
                hours: 0,
                minutes: 1,
                seconds: 4,
                totalSeconds: 64
            });
        });

        test('Zero duration', () => {
            const result = calculateEstimatedProcessingTime(0);
            // Should default to 60s duration, so 60s + 60/30 = 2s => 62s
            expect(result.totalSeconds).toBe(62);
        });

        test('Negative duration', () => {
            const result = calculateEstimatedProcessingTime(-10);
            // Should default to 60s duration, so 60s + 60/30 = 2s => 62s
            expect(result.totalSeconds).toBe(62);
        });

        test('Large duration', () => {
            const result = calculateEstimatedProcessingTime(3600); // 1 hour
            // 60s + 3600/30 = 60s + 120s = 180s
            expect(result.totalSeconds).toBe(180);
        });

        test('NaN input', () => {
            const result = calculateEstimatedProcessingTime(NaN);
            // Should default to 60s
            expect(result.totalSeconds).toBe(62);
        });
    });

    describe('calculateTimeDifference', () => {
        test('Faster scenario - actual less than estimated', () => {
            const actual = 100;
            const estimated = 120;
            const result = calculateTimeDifference(actual, estimated);

            expect(result.isFaster).toBe(true);
            expect(result.differenceSeconds).toBe(20);
            expect(result.differenceText).toBe('20s faster than estimated');
        });

        test('Slower scenario - actual more than estimated', () => {
            const actual = 150;
            const estimated = 120;
            const result = calculateTimeDifference(actual, estimated);

            expect(result.isFaster).toBe(false);
            expect(result.differenceSeconds).toBe(30);
            expect(result.differenceText).toBe('30s slower than estimated');
        });

        test('Exact match - actual equals estimated', () => {
            const actual = 120;
            const estimated = 120;
            const result = calculateTimeDifference(actual, estimated);

            expect(result.isFaster).toBe(true); // By design, equal is considered "faster"
            expect(result.differenceSeconds).toBe(0);
            expect(result.differenceText).toBe('0s faster than estimated');
        });

        test('Handle estimated as a time object', () => {
            const actual = 100;
            const estimated = { totalSeconds: 120, hours: 0, minutes: 2, seconds: 0 };
            const result = calculateTimeDifference(actual, estimated);

            expect(result.isFaster).toBe(true);
            expect(result.differenceSeconds).toBe(20);
        });

        test('Hours and minutes in difference', () => {
            const actual = 100;
            const estimated = 5000;
            const result = calculateTimeDifference(actual, estimated);

            expect(result.isFaster).toBe(true);
            expect(result.differenceText).toBe('1h 21m 40s faster than estimated');
        });

        test('Minutes in difference', () => {
            const actual = 100;
            const estimated = 400;
            const result = calculateTimeDifference(actual, estimated);

            expect(result.differenceText).toBe('5m 0s faster than estimated');
        });
    });

    describe('getAudioDuration', () => {
        test('Successfully gets duration from ffprobe', async () => {
            // Mock successful ffprobe call
            ffmpeg.ffprobe.mockImplementation((filePath, callback) => {
                callback(null, {
                    format: {
                        duration: 120.5
                    }
                });
            });

            const duration = await getAudioDuration('test.mp3');
            expect(duration).toBe(120.5);
            expect(ffmpeg.ffprobe).toHaveBeenCalledWith('test.mp3', expect.any(Function));
        });

        test('Falls back when ffprobe fails', async () => {
            // Mock ffprobe failure
            ffmpeg.ffprobe.mockImplementation((filePath, callback) => {
                callback(new Error('ffprobe failed'), null);
            });

            // Mock the fallback child process
            const mockStderr = {
                on: jest.fn()
            };
            const mockProcess = {
                stderr: mockStderr,
                on: jest.fn()
            };
            spawn.mockReturnValue(mockProcess);

            // Simulate the stderr data event with a duration string
            const stderrCallback = {};
            mockStderr.on.mockImplementation((event, callback) => {
                stderrCallback[event] = callback;
                return mockStderr;
            });

            // Simulate the close event
            mockProcess.on.mockImplementation((event, callback) => {
                if (event === 'close') {
                    setTimeout(() => {
                        // Trigger the stderr data event with a duration pattern
                        stderrCallback['data']('Duration: 01:02:03.500, bitrate: 128 kb/s');
                        // Then trigger the close event
                        callback(0);
                    }, 10);
                }
                return mockProcess;
            });

            const duration = await getAudioDuration('test.mp3');

            // Should be 1h 2m 3.5s = 3723.5s
            expect(duration).toBe(3723.5);
            expect(spawn).toHaveBeenCalledWith('ffmpeg', ['-i', 'test.mp3']);
        });

        test('Handles completely failed duration detection', async () => {
            // Mock ffprobe failure
            ffmpeg.ffprobe.mockImplementation((filePath, callback) => {
                callback(new Error('ffprobe failed'), null);
            });

            // Mock the fallback child process without duration information
            const mockStderr = {
                on: jest.fn()
            };
            const mockProcess = {
                stderr: mockStderr,
                on: jest.fn()
            };
            spawn.mockReturnValue(mockProcess);

            // Set up mocks to simulate no duration found
            mockStderr.on.mockImplementation((event, callback) => {
                stderrCallback[event] = callback;
                return mockStderr;
            });

            const stderrCallback = {};
            mockProcess.on.mockImplementation((event, callback) => {
                if (event === 'close') {
                    setTimeout(() => {
                        // Trigger with data that doesn't contain duration
                        stderrCallback['data']('No duration info here');
                        // Then trigger close
                        callback(0);
                    }, 10);
                }
                return mockProcess;
            });

            const duration = await getAudioDuration('test.mp3');

            // Should fall back to default 5 minutes (300s)
            expect(duration).toBe(300);
        });

        test('Handles invalid metadata format', async () => {
            // Mock ffprobe returning invalid metadata
            ffmpeg.ffprobe.mockImplementation((filePath, callback) => {
                callback(null, { invalid: 'metadata' });
            });

            const duration = await getAudioDuration('test.mp3');

            // Should default to 5 minutes (300s)
            expect(duration).toBe(300);
        });
    });

    describe('getVideoDuration', () => {
        test('Successfully gets duration from yt-dlp', async () => {
            // Mock successful yt-dlp spawn
            const mockStdout = {
                on: jest.fn()
            };
            const mockStderr = {
                on: jest.fn()
            };
            const mockProcess = {
                stdout: mockStdout,
                stderr: mockStderr,
                on: jest.fn()
            };
            spawn.mockReturnValue(mockProcess);

            // Set up callbacks
            const stdoutCallback = {};
            const stderrCallback = {};
            mockStdout.on.mockImplementation((event, callback) => {
                stdoutCallback[event] = callback;
                return mockStdout;
            });
            mockStderr.on.mockImplementation((event, callback) => {
                stderrCallback[event] = callback;
                return mockStderr;
            });

            // Mock the close event to return a valid duration
            mockProcess.on.mockImplementation((event, callback) => {
                if (event === 'close') {
                    setTimeout(() => {
                        // Simulate successful stdout output
                        stdoutCallback['data']('10:30');
                        // Then close with success code
                        callback(0);
                    }, 10);
                }
                return mockProcess;
            });

            const duration = await getVideoDuration('https://example.com/video');

            // Should be 10m 30s = 630s
            expect(duration).toBe(630);
            expect(spawn).toHaveBeenCalledWith('yt-dlp', ['--print', 'duration_string', 'https://example.com/video']);
        });

        test('Falls back when primary method fails', async () => {
            // Set up primary method failure
            const mockStdout1 = { on: jest.fn() };
            const mockStderr1 = { on: jest.fn() };
            const mockProcess1 = {
                stdout: mockStdout1,
                stderr: mockStderr1,
                on: jest.fn()
            };

            // Set up fallback method success
            const mockStdout2 = { on: jest.fn() };
            const mockStderr2 = { on: jest.fn() };
            const mockProcess2 = {
                stdout: mockStdout2,
                stderr: mockStderr2,
                on: jest.fn()
            };

            // Return different mock processes on consecutive calls
            spawn.mockReturnValueOnce(mockProcess1).mockReturnValueOnce(mockProcess2);

            // Set up primary method callbacks
            const stdoutCallback1 = {};
            mockStdout1.on.mockImplementation((event, callback) => {
                stdoutCallback1[event] = callback;
                return mockStdout1;
            });
            mockStderr1.on.mockImplementation((event, callback) => {
                return mockStderr1;
            });

            // Set up fallback method callbacks
            const stdoutCallback2 = {};
            mockStdout2.on.mockImplementation((event, callback) => {
                stdoutCallback2[event] = callback;
                return mockStdout2;
            });
            mockStderr2.on.mockImplementation((event, callback) => {
                return mockStderr2;
            });

            // Primary method fails
            mockProcess1.on.mockImplementation((event, callback) => {
                if (event === 'close') {
                    setTimeout(() => {
                        // Empty data or error
                        callback(1);
                    }, 10);
                }
                return mockProcess1;
            });

            // Fallback method succeeds
            mockProcess2.on.mockImplementation((event, callback) => {
                if (event === 'close') {
                    setTimeout(() => {
                        // Simulate successful stdout output for fallback
                        stdoutCallback2['data']('5:45');
                        // Then close with success code
                        callback(0);
                    }, 20);
                }
                return mockProcess2;
            });

            const duration = await getVideoDuration('https://example.com/video');

            // Should be 5m 45s = 345s
            expect(duration).toBe(345);
            // Check that both methods were attempted
            expect(spawn).toHaveBeenCalledWith('yt-dlp', ['--print', 'duration_string', 'https://example.com/video']);
            expect(spawn).toHaveBeenCalledWith('yt-dlp', ['--get-duration', 'https://example.com/video']);
        });

        test('Uses default duration when all methods fail', async () => {
            // First spawn (primary method)
            const mockStdout1 = { on: jest.fn() };
            const mockStderr1 = { on: jest.fn() };
            const mockProcess1 = {
                stdout: mockStdout1,
                stderr: mockStderr1,
                on: jest.fn()
            };

            // Second spawn (fallback method)
            const mockStdout2 = { on: jest.fn() };
            const mockStderr2 = { on: jest.fn() };
            const mockProcess2 = {
                stdout: mockStdout2,
                stderr: mockStderr2,
                on: jest.fn()
            };

            // Return different processes for each spawn call
            spawn.mockReturnValueOnce(mockProcess1).mockReturnValueOnce(mockProcess2);

            // Set up callbacks for first process
            mockStdout1.on.mockImplementation(() => mockStdout1);
            mockStderr1.on.mockImplementation(() => mockStderr1);
            mockProcess1.on.mockImplementation((event, callback) => {
                if (event === 'close') {
                    setTimeout(() => {
                        // Fail with non-zero code
                        callback(1);
                    }, 10);
                }
                return mockProcess1;
            });

            // Set up callbacks for second process
            mockStdout2.on.mockImplementation(() => mockStdout2);
            mockStderr2.on.mockImplementation(() => mockStderr2);
            mockProcess2.on.mockImplementation((event, callback) => {
                if (event === 'close') {
                    setTimeout(() => {
                        // Fail with non-zero code or empty output
                        callback(1);
                    }, 20);
                }
                return mockProcess2;
            });

            const duration = await getVideoDuration('https://example.com/video');

            // Should use the default 10 minutes (600s)
            expect(duration).toBe(600);
        });
    });
});