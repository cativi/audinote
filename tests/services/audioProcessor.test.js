/**
 * @file audioProcessor.test.js
 * @description Unit tests for the audioProcessor service's processAudio function
 */

jest.mock('fs');
jest.mock('child_process');
jest.mock('../../src/utils/fileUtils.js');
jest.mock('../../src/utils/errorHandler', () => ({
    AppError: class AppError extends Error {
        constructor(message, statusCode, resource) {
            super(message);
            this.statusCode = statusCode;
            this.resource = resource;
            this.name = 'AppError';
        }
    }
}));
jest.mock('../../src/config', () => ({
    ffmpegOptions: {
        sampleRate: '16000',
        channels: '1',
        codec: 'pcm_s16le'
    },
    audioFormat: 'wav',
    ffmpegPath: '/usr/bin/ffmpeg',
    errorMessages: {
        fileNotFound: 'Audio file not found',
        ffmpegFailed: 'FFmpeg conversion failed',
        wavNotCreated: 'WAV file was not created'
    }
}));

const fs = require('fs');
const { spawn } = require('child_process');
const { deleteFile } = require('../../src/utils/fileUtils.js');
const { AppError } = require('../../src/utils/errorHandler.js');
const { processAudio } = require('../../src/services/audioProcessor');
const logger = require('../../src/utils/logger');

beforeEach(() => {
    jest.spyOn(logger, 'info').mockImplementation(() => { });
});

afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
});

describe('Audio Processor Service', () => {
    describe('processAudio', () => {
        const testFilePath = '/path/to/test-file.mp3';
        const expectedWavPath = `${testFilePath}.wav`;

        it('should log conversion start and completion', async () => {
            fs.existsSync.mockImplementation((path) => path === testFilePath || path === expectedWavPath);

            const mockProcess = {
                stderr: { on: jest.fn() },
                on: jest.fn().mockImplementation((event, callback) => {
                    if (event === 'close') {
                        setTimeout(() => callback(0), 10);
                    }
                })
            };

            spawn.mockReturnValue(mockProcess);

            await processAudio(testFilePath);

            expect(logger.info).toHaveBeenCalledWith('🔄 Converting MP3 to WAV...');
            expect(logger.info).toHaveBeenCalledWith('✅ Conversion complete.');
        });

        /**
     * 1) Test both 'error' AND 'close' events to ensure doCleanup()
     *    is called only once and subsequent calls do nothing.
     */
        it('should handle both FFmpeg "error" and "close" events in one run', async () => {
            // Mock file existence
            fs.existsSync.mockReturnValue(true);

            // Create a mocked FFmpeg process that first emits 'error', then 'close'
            const mockProcess = {
                stderr: { on: jest.fn() },
                on: jest.fn().mockImplementation((event, callback) => {
                    if (event === 'error') {
                        // Emit error first
                        setTimeout(() => callback(new Error('Simulated FFmpeg error')), 10);
                    }
                    if (event === 'close') {
                        // Then emit close after another delay
                        setTimeout(() => callback(1), 20); // Non-zero exit code
                    }
                })
            };

            spawn.mockReturnValue(mockProcess);

            // Expect the promise to reject because FFmpeg fails
            await expect(processAudio(testFilePath)).rejects.toMatchObject({
                name: 'AppError',
                message: expect.stringContaining('FFmpeg conversion failed'),
                statusCode: 500
            });

            // The important part: doCleanup should only run once, even though both events fired
            // So check that "deleteFile" was called exactly once
            expect(deleteFile).toHaveBeenCalledTimes(1);
            expect(deleteFile).toHaveBeenCalledWith(testFilePath);
        });

        /**
         * 2) Test scenario where FFmpeg writes to stderr but exits with code=0
         *    (ffmpegError is non-empty, but still success).
         *    Covers the path where we skip rejecting if code===0, even if there's stderr.
         */
        it('should succeed even if FFmpeg writes to stderr when exit code is 0', async () => {
            // Mock file existence checks
            fs.existsSync.mockImplementation(path => {
                if (path === testFilePath) return true;
                if (path === expectedWavPath) return true; // WAV does exist
                return false;
            });

            // Mock spawn that emits data on stderr but still closes with code=0
            const mockStderr = {
                on: jest.fn().mockImplementation((event, callback) => {
                    if (event === 'data') {
                        // Pretend FFmpeg wrote a warning to stderr
                        callback(Buffer.from('Minor FFmpeg warning'));
                    }
                })
            };

            const mockProcess = {
                stderr: mockStderr,
                on: jest.fn().mockImplementation((event, callback) => {
                    if (event === 'close') {
                        setTimeout(() => callback(0), 10); // code=0 => success
                    }
                })
            };

            spawn.mockReturnValue(mockProcess);

            // Expect success
            const result = await processAudio(testFilePath);
            expect(result).toBe(expectedWavPath);

            // Confirm file cleanup (deleteFile) was called once
            expect(deleteFile).toHaveBeenCalledTimes(1);
            expect(deleteFile).toHaveBeenCalledWith(testFilePath);
        });

        /**
         * Test case to ensure that if FFmpeg emits an "error" event,
         * the function cleans up (deletes the file) and rejects with AppError.
         */
        it('should handle FFmpeg process errors, delete the file, and reject with AppError', async () => {
            // Mock file existence check
            fs.existsSync.mockReturnValue(true);

            // Mock FFmpeg process that triggers an "error" event
            const mockProcess = {
                stderr: { on: jest.fn() },
                on: jest.fn().mockImplementation((event, callback) => {
                    if (event === 'error') {
                        // Simulate asynchronous FFmpeg error
                        setTimeout(() => callback(new Error('FFmpeg execution failed')), 10);
                    }
                })
            };

            spawn.mockReturnValue(mockProcess);

            // Make a single call to processAudio and capture the rejection
            await expect(processAudio(testFilePath)).rejects.toMatchObject({
                name: 'AppError',
                message: expect.stringContaining('FFmpeg conversion failed: FFmpeg execution failed'),
                statusCode: 500
            });

            // Ensure deleteFile was executed exactly once
            expect(deleteFile).toHaveBeenCalledWith(testFilePath);
            expect(deleteFile).toHaveBeenCalledTimes(1);

            // Ensure error event was properly attached
            expect(mockProcess.on).toHaveBeenCalledWith('error', expect.any(Function));
        });

        // Create a mock for the spawn function to simulate an FFmpeg process
        const createMockSpawn = (exitCode = 0) => {
            // Create mock event emitters for the process
            const mockStderr = {
                on: jest.fn().mockImplementation((event, callback) => {
                    if (event === 'data' && exitCode !== 0) {
                        callback(Buffer.from('FFmpeg error output'));
                    }
                })
            };

            const mockProcess = {
                stderr: mockStderr,
                on: jest.fn().mockImplementation((event, callback) => {
                    // Simulate process close after a small delay to ensure promise resolution
                    if (event === 'close') {
                        setTimeout(() => callback(exitCode), 10);
                    }
                })
            };

            return jest.fn().mockReturnValue(mockProcess);
        };

        it('should successfully convert an audio file to WAV format', async () => {
            // Mock file existence checks
            fs.existsSync.mockImplementation(path => {
                if (path === testFilePath) return true;
                if (path === expectedWavPath) return true;
                return false;
            });

            // Mock successful spawn process
            spawn.mockImplementation(createMockSpawn(0));

            // Call the function
            const result = await processAudio(testFilePath);

            // Assertions
            expect(fs.existsSync).toHaveBeenCalledWith(testFilePath);
            expect(spawn).toHaveBeenCalledWith('/usr/bin/ffmpeg', [
                '-i', testFilePath,
                '-ar', '16000',
                '-ac', '1',
                '-c:a', 'pcm_s16le',
                expectedWavPath
            ]);
            expect(deleteFile).toHaveBeenCalledWith(testFilePath);
            expect(fs.existsSync).toHaveBeenCalledWith(expectedWavPath);
            expect(result).toBe(expectedWavPath);
        });

        it('should reject with AppError when file does not exist', async () => {
            // Mock file not existing
            fs.existsSync.mockReturnValue(false);

            // Expect the promise to be rejected
            await expect(processAudio(testFilePath)).rejects.toThrow(AppError);
            await expect(processAudio(testFilePath)).rejects.toMatchObject({
                message: 'Audio file not found',
                statusCode: 500,
                resource: testFilePath
            });

            // Assertions
            expect(fs.existsSync).toHaveBeenCalledWith(testFilePath);
            expect(spawn).not.toHaveBeenCalled();
            expect(deleteFile).not.toHaveBeenCalled();
        });

        it('should reject with AppError when FFmpeg fails with non-zero code', async () => {
            // Mock file existence check
            fs.existsSync.mockImplementation(path => {
                if (path === testFilePath) return true;
                return false;
            });

            // Mock failing spawn process (exit code 1)
            spawn.mockImplementation(createMockSpawn(1));

            // Call the function and expect it to reject
            await expect(processAudio(testFilePath)).rejects.toThrow(AppError);
            await expect(processAudio(testFilePath)).rejects.toMatchObject({
                message: expect.stringContaining('FFmpeg conversion failed with code 1'),
                statusCode: 500
            });

            // Assertions
            expect(deleteFile).toHaveBeenCalledWith(testFilePath);
        });

        it('should reject with AppError when FFmpeg spawn fails', async () => {
            // Mock file existence check
            fs.existsSync.mockReturnValue(true);

            // Mock process error
            const mockProcess = {
                stderr: { on: jest.fn() },
                on: jest.fn().mockImplementation((event, callback) => {
                    if (event === 'error') {
                        callback(new Error('FFmpeg process error'));
                    }
                })
            };

            spawn.mockReturnValue(mockProcess);

            // Call the function and expect it to reject
            await expect(processAudio(testFilePath)).rejects.toThrow(AppError);
            await expect(processAudio(testFilePath)).rejects.toMatchObject({
                message: expect.stringContaining('FFmpeg process error'),
                statusCode: 500
            });

            // Assertions
            expect(deleteFile).toHaveBeenCalledWith(testFilePath);
        });

        it('should reject with AppError when WAV file is not created', async () => {
            // Mock file existence checks
            fs.existsSync.mockImplementation(path => {
                if (path === testFilePath) return true;
                if (path === expectedWavPath) return false; // WAV not created
                return false;
            });

            // Mock successful process execution but no WAV file is actually created
            spawn.mockImplementation(createMockSpawn(0));

            // Call the function and expect rejection
            await expect(processAudio(testFilePath)).rejects.toThrow(AppError);
            await expect(processAudio(testFilePath)).rejects.toMatchObject({
                message: 'WAV file was not created',
                statusCode: 500
            });

            // Assertions
            expect(deleteFile).toHaveBeenCalledWith(testFilePath);
            expect(fs.existsSync).toHaveBeenCalledWith(expectedWavPath);
        });

        it('should verify cleanup by deleting the original file after successful conversion', async () => {
            // Mock file existence checks
            fs.existsSync.mockImplementation(path => {
                if (path === testFilePath) return true;
                if (path === expectedWavPath) return true;
                return false;
            });

            // Mock successful spawn process
            spawn.mockImplementation(createMockSpawn(0));

            // Call the function
            await processAudio(testFilePath);

            // Verify the original file was deleted
            expect(deleteFile).toHaveBeenCalledWith(testFilePath);
            expect(deleteFile).toHaveBeenCalledTimes(1);
        });
    });
});
