const { errorHandler, AppError } = require('../../src/utils/errorHandler');
const { deleteFile } = require('../../src/utils/fileUtils');

// ✅ Mock the logger and file utils
jest.mock('../../src/utils/logger', () => ({
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn()
}));

jest.mock('../../src/utils/fileUtils', () => ({
    deleteFile: jest.fn()
}));

const logger = require('../../src/utils/logger');

// Mock Express response object
const mockResponse = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

describe('AppError class', () => {
    test('should create error with default status code', () => {
        const error = new AppError('Test error');

        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('Test error');
        expect(error.statusCode).toBe(500);
        expect(error.cleanup).toBe(null);
        expect(error.name).toBe('AppError');
        expect(error.stack).toBeDefined();
    });

    test('should create error with custom status code', () => {
        const error = new AppError('Not found', 404);

        expect(error.message).toBe('Not found');
        expect(error.statusCode).toBe(404);
        expect(error.cleanup).toBe(null);
    });

    test('should create error with cleanup path', () => {
        const error = new AppError('Upload failed', 400, '/tmp/upload.jpg');

        expect(error.message).toBe('Upload failed');
        expect(error.statusCode).toBe(400);
        expect(error.cleanup).toBe('/tmp/upload.jpg');
    });

    test('should create error with multiple cleanup paths', () => {
        const cleanupPaths = ['/tmp/file1.jpg', '/tmp/file2.jpg'];
        const error = new AppError('Multiple uploads failed', 400, cleanupPaths);

        expect(error.message).toBe('Multiple uploads failed');
        expect(error.statusCode).toBe(400);
        expect(error.cleanup).toEqual(cleanupPaths);
    });
});

describe('errorHandler middleware', () => {
    let req, res, next;

    beforeEach(() => {
        req = {};
        res = mockResponse();
        next = jest.fn();
        jest.clearAllMocks();
    });

    test('should handle errors with default status code', () => {
        const error = new Error('Server error');

        errorHandler(error, req, res, next);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            message: 'Server error',
            error: error.stack
        });
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('❌ Error [500]'));
        expect(logger.debug).toHaveBeenCalledWith(error.stack);
    });

    test('should handle AppError with custom status code', () => {
        const error = new AppError('Not found', 404);

        errorHandler(error, req, res, next);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            message: 'Not found',
            error: error.stack
        });
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('❌ Error [404]'));
    });

    test('should handle cleanup for a single file', () => {
        const filePath = '/tmp/upload.jpg';
        const error = new AppError('Upload failed', 400, filePath);

        errorHandler(error, req, res, next);

        expect(deleteFile).toHaveBeenCalledWith(filePath);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    test('should handle cleanup for multiple files', () => {
        const filePaths = ['/tmp/file1.jpg', '/tmp/file2.jpg'];
        const error = new AppError('Multiple uploads failed', 400, filePaths);

        errorHandler(error, req, res, next);

        expect(deleteFile).toHaveBeenCalledWith(filePaths[0]);
        expect(deleteFile).toHaveBeenCalledWith(filePaths[1]);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    test('should handle req.file cleanup', () => {
        const error = new Error('Server error');
        const filePath = '/tmp/uploaded.jpg';
        req.file = { path: filePath };

        errorHandler(error, req, res, next);

        expect(deleteFile).toHaveBeenCalledWith(filePath);
    });

    test('should handle cleanup errors gracefully', () => {
        deleteFile.mockImplementation(() => {
            throw new Error('Cleanup error');
        });

        const error = new AppError('Upload error', 400, '/tmp/upload.jpg');

        errorHandler(error, req, res, next);

        expect(logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('⚠️ Failed to clean up files')
        );
        expect(res.status).toHaveBeenCalledWith(400);
    });

    test('should hide stack trace in production environment', () => {
        const originalNodeEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        const error = new Error('Server error');

        errorHandler(error, req, res, next);

        expect(res.json).toHaveBeenCalledWith({
            success: false,
            message: 'Server error',
            error: 'An error occurred'
        });

        process.env.NODE_ENV = originalNodeEnv;
    });
});
