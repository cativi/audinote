// transcriptionRoutes.test.js
const request = require('supertest');
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Mocking dependencies
jest.mock('../../src/services/audioProcessor', () => ({
    processAudio: jest.fn()
}));

jest.mock('../../src/services/transcriber', () => ({
    transcribeAudio: jest.fn()
}));

jest.mock('../../src/services/timeEstimator', () => ({
    getAudioDuration: jest.fn(),
    formatTime: jest.fn(),
    calculateEstimatedProcessingTime: jest.fn(),
    calculateTimeDifference: jest.fn()
}));

jest.mock('../../src/utils/fileUtils', () => ({
    deleteFile: jest.fn()
}));

// Import mocked modules
const { processAudio } = require('../../src/services/audioProcessor');
const { transcribeAudio } = require('../../src/services/transcriber');
const { getAudioDuration, formatTime, calculateEstimatedProcessingTime, calculateTimeDifference } = require('../../src/services/timeEstimator');
const { deleteFile } = require('../../src/utils/fileUtils');
const { AppError } = require('../../src/utils/errorHandler');

// Configure express app for testing
const app = express();
const upload = multer({ dest: 'test/uploads/' });

// Mock config values
jest.mock('../../src/config', () => ({
    allowedMimeTypes: ['audio/mpeg', 'audio/mp3', 'audio/wav'],
    allowedExtensions: ['mp3', 'wav', 'mpeg'],
    allowedLanguages: ['en', 'es'],
    defaultLanguage: 'en'
}));

// Import routes after all mocks are set up
const transcriptionRoutes = require('../../src/routes/transcriptionRoutes');

// Configure app with routes
app.use('/transcribe', upload.single('audio'), transcriptionRoutes);

// Error handler middleware to match your app's error handling
app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        success: false,
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

// Helper to create a test file
function createTestFile(filename, content = 'test content') {
    const dir = 'test/uploads/';
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, content);
    return filePath;
}

// Clean up all test files
function cleanupTestFiles() {
    const dir = 'test/uploads/';
    if (fs.existsSync(dir)) {
        fs.readdirSync(dir).forEach(file => {
            fs.unlinkSync(path.join(dir, file));
        });
    }
}

describe('Transcription Routes', () => {
    // Setup before each test
    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Set up default mock implementations
        processAudio.mockResolvedValue('processed-file.wav');
        getAudioDuration.mockResolvedValue(60); // 1 minute
        formatTime.mockImplementation((seconds) => {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const remainingSeconds = seconds % 60;
            return { hours, minutes, seconds: remainingSeconds };
        });
        calculateEstimatedProcessingTime.mockReturnValue({ hours: 0, minutes: 2, seconds: 0 });
        calculateTimeDifference.mockReturnValue({
            timeObject: { hours: 0, minutes: 0, seconds: 5 },
            differenceText: 'Processing was 5 seconds faster than estimated'
        });
        transcribeAudio.mockResolvedValue({
            text: 'Sample transcription',
            confidence: 0.95
        });
    });

    // Clean up after tests
    afterAll(() => {
        cleanupTestFiles();
    });

    describe('POST /transcribe', () => {
        test('should successfully transcribe a valid audio file', async () => {
            // Create a test audio file
            const testFile = createTestFile('test-audio.mp3');

            const response = await request(app)
                .post('/transcribe')
                .attach('audio', testFile)
                .field('language', 'en');

            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                success: true,
                language: 'en',
                audioDuration: { hours: 0, minutes: 1, seconds: 0 },
                estimatedProcessingTime: { hours: 0, minutes: 2, seconds: 0 },
                actualProcessingTime: { hours: 0, minutes: 0, seconds: 0 }, // This will be 0 in test since we're mocking
                timeDifference: { hours: 0, minutes: 0, seconds: 5 },
                timeDifferenceText: 'Processing was 5 seconds faster than estimated',
                text: 'Sample transcription',
                confidence: 0.95
            });

            // Verify service calls
            expect(processAudio).toHaveBeenCalledWith(expect.any(String));
            expect(getAudioDuration).toHaveBeenCalledWith('processed-file.wav');
            expect(transcribeAudio).toHaveBeenCalledWith('processed-file.wav', 'en');
        });

        test('should return 400 when no file is provided', async () => {
            const response = await request(app)
                .post('/transcribe')
                .field('language', 'en');

            expect(response.status).toBe(400);
            expect(response.body).toEqual({
                success: false,
                message: 'No audio file provided.',
                stack: undefined
            });

            // Verify no services were called
            expect(processAudio).not.toHaveBeenCalled();
        });

        test('should return 400 when an invalid file type is provided', async () => {
            // Create a test text file
            const testFile = createTestFile('test-document.txt');

            const response = await request(app)
                .post('/transcribe')
                .attach('audio', testFile)
                .field('language', 'en');

            expect(response.status).toBe(400);
            expect(response.body.message).toContain('Invalid file type');
            expect(deleteFile).toHaveBeenCalled();
        });

        test('should return 400 when an unsupported language is provided', async () => {
            // Create a test audio file
            const testFile = createTestFile('test-audio.mp3');

            const response = await request(app)
                .post('/transcribe')
                .attach('audio', testFile)
                .field('language', 'fr'); // French is not in the allowed languages

            expect(response.status).toBe(400);
            expect(response.body.message).toContain('Invalid language');
            expect(deleteFile).toHaveBeenCalled();
        });

        test('should use default language when no language is specified', async () => {
            // Create a test audio file
            const testFile = createTestFile('test-audio.mp3');

            const response = await request(app)
                .post('/transcribe')
                .attach('audio', testFile);

            expect(response.status).toBe(200);
            expect(response.body.language).toBe('en'); // Default language
            expect(transcribeAudio).toHaveBeenCalledWith('processed-file.wav', 'en');
        });

        test('should handle an internal error from processAudio', async () => {
            // Create a test audio file
            const testFile = createTestFile('test-audio.mp3');

            // Simulate an error in the processAudio service
            processAudio.mockRejectedValue(new Error('Failed to process audio'));

            const response = await request(app)
                .post('/transcribe')
                .attach('audio', testFile)
                .field('language', 'en');

            expect(response.status).toBe(500);
            expect(response.body).toEqual({
                success: false,
                message: 'Failed to process audio',
                stack: undefined
            });
        });

        test('should handle an internal error from transcribeAudio', async () => {
            // Create a test audio file
            const testFile = createTestFile('test-audio.mp3');

            // Simulate an error in the transcribeAudio service
            transcribeAudio.mockRejectedValue(new Error('Transcription service unavailable'));

            const response = await request(app)
                .post('/transcribe')
                .attach('audio', testFile)
                .field('language', 'en');

            expect(response.status).toBe(500);
            expect(response.body).toEqual({
                success: false,
                message: 'Transcription service unavailable',
                stack: undefined
            });
        });
    });
});