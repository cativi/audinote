/**
 * @file transcriber.test.js
 * @description Unit tests for the transcriber service's transcribeAudio function
 */

// Mock dependencies
jest.mock('child_process');
jest.mock('fs/promises');
jest.mock('fs');
jest.mock('../../src/config', () => ({
    modelPaths: {
        en: '/path/to/models/vosk-model-en-us-0.22',
        es: '/path/to/models/vosk-model-es-0.42'
    }
}));

// Import after mocking
const { spawn } = require('child_process');
const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const { transcribeAudio } = require('../../src/services/transcriber');

// Define constants for testing
const TEST_WAV_FILE = '/path/to/test-audio.wav';
const TEST_LANGUAGE = 'en';
const TRANSCRIPTIONS_DIR = path.join(__dirname, '../../transcriptions');
const EXPECTED_TRANSCRIPT_FILE = path.join(TRANSCRIPTIONS_DIR, `${path.basename(TEST_WAV_FILE)}.txt`);
const TEST_TRANSCRIPT_TEXT = 'This is a test transcription result';

// Mock logger
jest.mock('../../src/utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
}));

const logger = require('../../src/utils/logger');

beforeEach(() => {
    fsSync.existsSync.mockReturnValue(true);
    jest.clearAllMocks();
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('Transcriber Service', () => {
    describe('transcribeAudio', () => {
        const createMockProcess = (options = {}) => {
            const {
                stdoutData = TEST_TRANSCRIPT_TEXT,
                stderrData = '',
                exitCode = 0
            } = options;

            const mockStdout = {
                on: jest.fn().mockImplementation((event, callback) => {
                    if (event === 'data') {
                        callback(Buffer.from(stdoutData));
                    }
                })
            };

            const mockStderr = {
                on: jest.fn().mockImplementation((event, callback) => {
                    if (event === 'data' && stderrData) {
                        callback(Buffer.from(stderrData));
                    }
                })
            };

            const mockProcess = {
                stdout: mockStdout,
                stderr: mockStderr,
                on: jest.fn().mockImplementation((event, callback) => {
                    if (event === 'close') {
                        setTimeout(() => callback(exitCode), 10);
                    }
                })
            };

            return mockProcess;
        };

        it('should successfully transcribe audio and save the result', async () => {
            spawn.mockReturnValue(createMockProcess());
            fs.writeFile.mockResolvedValue(undefined);
            fs.unlink.mockResolvedValue(undefined);

            const result = await transcribeAudio(TEST_WAV_FILE, TEST_LANGUAGE);

            expect(spawn).toHaveBeenCalledWith(
                './venv/bin/python3',
                ['transcribe.py', TEST_WAV_FILE, '/path/to/models/vosk-model-en-us-0.22'],
                { stdio: ['pipe', 'pipe', 'pipe'] }
            );

            expect(fs.writeFile).toHaveBeenCalledWith(
                EXPECTED_TRANSCRIPT_FILE,
                TEST_TRANSCRIPT_TEXT
            );

            expect(fs.unlink).toHaveBeenCalledWith(TEST_WAV_FILE);

            expect(result).toEqual({
                text: TEST_TRANSCRIPT_TEXT,
                transcriptFile: EXPECTED_TRANSCRIPT_FILE
            });

            expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Transcribing with model'));
            expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Transcription saved'));
        });

        it('should handle Spanish language transcription correctly', async () => {
            spawn.mockReturnValue(createMockProcess());
            fs.writeFile.mockResolvedValue(undefined);
            await transcribeAudio(TEST_WAV_FILE, 'es');

            expect(spawn).toHaveBeenCalledWith(
                './venv/bin/python3',
                ['transcribe.py', TEST_WAV_FILE, '/path/to/models/vosk-model-es-0.42'],
                { stdio: ['pipe', 'pipe', 'pipe'] }
            );
        });

        it('should fall back to English model if language is not supported', async () => {
            spawn.mockReturnValue(createMockProcess());
            fs.writeFile.mockResolvedValue(undefined);
            await transcribeAudio(TEST_WAV_FILE, 'fr');

            expect(spawn).toHaveBeenCalledWith(
                './venv/bin/python3',
                ['transcribe.py', TEST_WAV_FILE, '/path/to/models/vosk-model-en-us-0.22'],
                { stdio: ['pipe', 'pipe', 'pipe'] }
            );
        });

        it('should reject when Python process exits with non-zero code', async () => {
            spawn.mockReturnValue(createMockProcess({ exitCode: 1 }));
            await expect(transcribeAudio(TEST_WAV_FILE, TEST_LANGUAGE)).rejects.toThrow('Transcription process failed');
            expect(fs.unlink).toHaveBeenCalledWith(TEST_WAV_FILE);
        });

        it('should capture and handle stderr output from Python', async () => {
            spawn.mockReturnValue(createMockProcess({
                stderrData: 'Critical Python error occurred',
                exitCode: 1
            }));

            await expect(transcribeAudio(TEST_WAV_FILE, TEST_LANGUAGE)).rejects.toThrow();
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Critical Python error occurred'));
        });

        it('should ignore Vosk API logs in stderr', async () => {
            spawn.mockReturnValue(createMockProcess({
                stderrData: 'LOG (VoskAPI: some non-critical message)',
                exitCode: 0
            }));

            await transcribeAudio(TEST_WAV_FILE, TEST_LANGUAGE);
            expect(logger.error).not.toHaveBeenCalled();
        });

        it('should handle WAV file deletion failure', async () => {
            spawn.mockReturnValue(createMockProcess());
            fs.unlink.mockRejectedValue(new Error('Unlink failed'));
            fs.writeFile.mockResolvedValue(undefined);

            const result = await transcribeAudio(TEST_WAV_FILE, TEST_LANGUAGE);
            expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to delete WAV file'));
            expect(result).toEqual({
                text: TEST_TRANSCRIPT_TEXT,
                transcriptFile: EXPECTED_TRANSCRIPT_FILE
            });
        });

        it('should handle file writing error', async () => {
            spawn.mockReturnValue(createMockProcess());
            fs.writeFile.mockRejectedValue(new Error('Write failed'));

            await expect(transcribeAudio(TEST_WAV_FILE, TEST_LANGUAGE)).rejects.toThrow('Write failed');
            expect(fs.unlink).toHaveBeenCalledWith(TEST_WAV_FILE);
        });
    });
});
