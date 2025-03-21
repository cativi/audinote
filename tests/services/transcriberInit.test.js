/**
 * @file transcriberInit.test.js
 * @description Test for the initialization behavior of the transcriber module
 */

describe('Transcriber Module Initialization', () => {
    let fsSync;
    let TRANSCRIPTIONS_DIR;

    beforeEach(() => {
        // Reset module registry before each test
        jest.resetModules();

        // Setup mocks before requiring the module
        jest.mock('child_process');
        jest.mock('fs/promises');

        // Important: Mock fs module with controlled behavior
        jest.mock('fs', () => {
            // Create mock functions that we can control in tests
            const existsSyncMock = jest.fn();
            const mkdirSyncMock = jest.fn();

            return {
                existsSync: existsSyncMock,
                mkdirSync: mkdirSyncMock
            };
        });

        // Mock config module
        jest.mock('../../src/config', () => ({
            modelPaths: {
                en: '/path/to/models/vosk-model-en-us-0.22',
                es: '/path/to/models/vosk-model-es-0.42'
            }
        }));

        // Get references to the mocked modules
        fsSync = require('fs');
        const path = require('path');

        // Get the transcriptions directory path
        TRANSCRIPTIONS_DIR = path.join(__dirname, '../../transcriptions');
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should create transcriptions directory if it does not exist', () => {
        // Configure fs.existsSync to return false (directory doesn't exist)
        fsSync.existsSync.mockReturnValueOnce(false);

        // This import triggers the directory check/creation
        require('../../src/services/transcriber');

        // Verify directory existence was checked
        expect(fsSync.existsSync).toHaveBeenCalledWith(TRANSCRIPTIONS_DIR);

        // Verify directory creation was attempted
        expect(fsSync.mkdirSync).toHaveBeenCalledWith(
            TRANSCRIPTIONS_DIR,
            { recursive: true }
        );
    });

    it('should not create transcriptions directory if it already exists', () => {
        // Configure fs.existsSync to return true (directory exists)
        fsSync.existsSync.mockReturnValueOnce(true);

        // This import triggers the directory check
        require('../../src/services/transcriber');

        // Verify directory existence was checked
        expect(fsSync.existsSync).toHaveBeenCalledWith(TRANSCRIPTIONS_DIR);

        // Verify directory creation was NOT attempted
        expect(fsSync.mkdirSync).not.toHaveBeenCalled();
    });
});