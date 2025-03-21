// tests/utils/fileUtils.test.js
const fs = require('fs');
const { deleteFile } = require('../../src/utils/fileUtils');

// Mock the fs module
jest.mock('fs');

// Mock logger
jest.mock('../../src/utils/logger', () => ({
    error: jest.fn()
}));

const logger = require('../../src/utils/logger');

describe('deleteFile function', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should delete file when it exists', () => {
        fs.access.mockImplementation((path, mode, callback) => {
            callback(null);
        });

        fs.unlink.mockImplementation((path, callback) => {
            callback(null);
        });

        const testFilePath = '/path/to/existing/file.jpg';
        deleteFile(testFilePath);

        expect(fs.access).toHaveBeenCalledWith(
            testFilePath,
            fs.constants.F_OK,
            expect.any(Function)
        );

        expect(fs.unlink).toHaveBeenCalledWith(
            testFilePath,
            expect.any(Function)
        );
    });

    test('should not attempt to delete file when it does not exist', () => {
        fs.access.mockImplementation((path, mode, callback) => {
            callback(new Error('File does not exist'));
        });

        const nonExistentFilePath = '/path/to/non-existent/file.jpg';
        deleteFile(nonExistentFilePath);

        expect(fs.access).toHaveBeenCalledWith(
            nonExistentFilePath,
            fs.constants.F_OK,
            expect.any(Function)
        );

        expect(fs.unlink).not.toHaveBeenCalled();
    });

    test('should log error when unlink fails', () => {
        const unlinkError = new Error('Permission denied');

        fs.access.mockImplementation((path, mode, callback) => {
            callback(null);
        });

        fs.unlink.mockImplementation((path, callback) => {
            callback(unlinkError);
        });

        const testFilePath = '/path/to/protected/file.jpg';
        deleteFile(testFilePath);

        expect(fs.access).toHaveBeenCalled();
        expect(fs.unlink).toHaveBeenCalled();
        expect(logger.error).toHaveBeenCalledWith(
            expect.stringContaining(`Error deleting file: ${testFilePath}`)
        );
    });
});
