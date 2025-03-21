/**
 * @file audioProcessor.js
 * @description Processes an audio file by converting it to WAV format using FFmpeg.
 */

const { spawn } = require("child_process");
const fs = require("fs");
const { AppError } = require("../utils/errorHandler");
const { deleteFile } = require("../utils/fileUtils");
const { ffmpegOptions, audioFormat, ffmpegPath, errorMessages } = require("../config");
const logger = require("../utils/logger");

/**
 * Processes an audio file by converting it to WAV format using FFmpeg.
 * @param {string} filePath - The path to the input audio file.
 * @returns {Promise<string>} - Resolves with the path to the converted WAV file.
 */
const processAudio = (filePath) => {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(filePath)) {
            return reject(new AppError(errorMessages.fileNotFound, 500, filePath));
        }

        const wavFile = `${filePath}.${audioFormat}`;
        logger.info("🔄 Converting MP3 to WAV...");

        let cleanupDone = false;

        const doCleanup = (pathToDelete) => {
            if (!cleanupDone) {
                cleanupDone = true;
                deleteFile(pathToDelete);
            }
        };

        const ffmpeg = spawn(ffmpegPath, [
            "-i", filePath,
            "-ar", ffmpegOptions.sampleRate,
            "-ac", ffmpegOptions.channels,
            "-c:a", ffmpegOptions.codec,
            wavFile
        ]);

        let ffmpegError = '';

        ffmpeg.stderr.on("data", (data) => {
            ffmpegError += data.toString();
        });

        ffmpeg.on("error", (err) => {
            doCleanup(filePath);
            reject(new AppError(`${errorMessages.ffmpegFailed}: ${err.message}`, 500, filePath));
        });

        ffmpeg.on("close", (code) => {
            doCleanup(filePath);

            if (code !== 0) {
                return reject(new AppError(
                    `${errorMessages.ffmpegFailed} with code ${code}${ffmpegError ? `: ${ffmpegError}` : ''}`,
                    500,
                    wavFile
                ));
            }

            if (!fs.existsSync(wavFile)) {
                return reject(new AppError(errorMessages.wavNotCreated, 500));
            }

            logger.info("✅ Conversion complete.");
            resolve(wavFile);
        });
    });
};

module.exports = { processAudio };
