/**
 * @file audioDurationDetector.test.js
 * @description Unit tests for the audioDurationDetector service
 */

jest.mock('fluent-ffmpeg');
jest.mock('child_process');

const ffmpeg = require('fluent-ffmpeg');
const { spawn } = require('child_process');
const { getAudioDuration } = require('../../src/services/audioDurationDetector');
const logger = require('../../src/utils/logger');

// Silence logger methods
beforeEach(() => {
    jest.spyOn(logger, 'info').mockImplementation(() => { });
    jest.spyOn(logger, 'warn').mockImplementation(() => { });
    jest.spyOn(logger, 'error').mockImplementation(() => { });
});

afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
});

describe('Audio Duration Detector', () => {
    describe('getAudioDuration', () => {
        it('should successfully get duration using ffprobe', async () => {
            ffmpeg.ffprobe = jest.fn().mockImplementation((filePath, callback) => {
                callback(null, { format: { duration: 120.5 } });
            });

            const duration = await getAudioDuration('test-file.mp3');

            expect(duration).toBe(120.5);
            expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Audio duration detected'));
        });

        it('should use fallback method when ffprobe fails', async () => {
            ffmpeg.ffprobe = jest.fn().mockImplementation((filePath, callback) => {
                callback(new Error('ffprobe failed'), null);
            });

            const mockEventEmitter = {
                stderr: { on: jest.fn() },
                on: jest.fn()
            };

            spawn.mockReturnValue(mockEventEmitter);

            mockEventEmitter.stderr.on.mockImplementation((event, callback) => {
                if (event === 'data') {
                    callback(Buffer.from('Duration: 01:02:03.50, start:'));
                }
            });

            mockEventEmitter.on.mockImplementation((event, callback) => {
                if (event === 'close') {
                    callback(0);
                }
            });

            const duration = await getAudioDuration('test-file.mp3');

            expect(duration).toBeCloseTo(3723.5);
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('ffprobe error'));
            expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Fallback duration detected'));
        });

        it('should use default value when all methods fail', async () => {
            ffmpeg.ffprobe = jest.fn().mockImplementation((filePath, callback) => {
                callback(new Error('ffprobe failed'), null);
            });

            const mockEventEmitter = {
                stderr: { on: jest.fn() },
                on: jest.fn()
            };

            spawn.mockReturnValue(mockEventEmitter);

            mockEventEmitter.stderr.on.mockImplementation((event, callback) => {
                if (event === 'data') {
                    callback(Buffer.from('No duration info here'));
                }
            });

            mockEventEmitter.on.mockImplementation((event, callback) => {
                if (event === 'close') {
                    callback(0);
                }
            });

            const duration = await getAudioDuration('test-file.mp3');

            expect(duration).toBe(300);
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('ffprobe error'));
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to extract duration'));
        });

        it('should handle invalid metadata format', async () => {
            ffmpeg.ffprobe = jest.fn().mockImplementation((filePath, callback) => {
                callback(null, { invalid: 'metadata' });
            });

            const duration = await getAudioDuration('test-file.mp3');

            expect(duration).toBe(300);
            expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Invalid metadata format'));
        });
    });
});
