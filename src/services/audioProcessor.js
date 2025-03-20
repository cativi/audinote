// services/audioProcessor.js
const { spawn } = require("child_process");
const fs = require("fs");
const { AppError } = require("../utils/errorHandler");
const { deleteFile } = require("../utils/fileUtils");
const { ffmpegOptions, audioFormat, ffmpegPath, errorMessages } = require("../config");

/**
 * Processes an audio file by converting it to a WAV format using FFmpeg.
 * @param {string} filePath - The path to the input audio file.
 * @returns {Promise<string>} - Resolves with the path to the converted WAV file.
 */
const processAudio = (filePath) => {
    return new Promise((resolve, reject) => {
        // Ensure the file exists before proceeding
        if (!fs.existsSync(filePath)) {
            return reject(new AppError(errorMessages.fileNotFound, 500, filePath));
        }

        // Define the output WAV file path based on the configured audio format
        const wavFile = `${filePath}.${audioFormat}`;
        console.log("🔄 Converting MP3 to WAV...");

        // Spawn an FFmpeg process to convert the input audio file to WAV
        const ffmpeg = spawn(ffmpegPath, [
            "-i", filePath,                  // Input file
            "-ar", ffmpegOptions.sampleRate, // Set audio sample rate
            "-ac", ffmpegOptions.channels,   // Set number of audio channels (mono/stereo)
            "-c:a", ffmpegOptions.codec,     // Set audio codec
            wavFile                          // Output file
        ]);

        let ffmpegError = '';

        // Capture any error messages from FFmpeg's standard error output
        ffmpeg.stderr.on("data", (data) => {
            ffmpegError += data.toString();
        });

        // Handle process errors (e.g., if FFmpeg is missing or fails to execute)
        ffmpeg.on("error", (err) => {
            deleteFile(filePath);
            reject(new AppError(`${errorMessages.ffmpegFailed}: ${err.message}`, 500, filePath));
        });

        // Handle process completion
        ffmpeg.on("close", (code) => {
            // Delete the original file to save storage
            deleteFile(filePath);

            // If FFmpeg failed, return an error
            if (code !== 0) {
                return reject(new AppError(
                    `${errorMessages.ffmpegFailed} with code ${code} ${ffmpegError ? ": " + ffmpegError : ""}`,
                    500,
                    wavFile
                ));
            }

            // Ensure the WAV file was created successfully
            if (!fs.existsSync(wavFile)) {
                return reject(new AppError(errorMessages.wavNotCreated, 500));
            }

            console.log("✅ Conversion complete.");
            resolve(wavFile);
        });
    });
};

module.exports = { processAudio };
