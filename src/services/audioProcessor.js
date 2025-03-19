// services/audioProcessor.js
const { spawn } = require("child_process");
const fs = require("fs");
const { AppError } = require("../utils/errorHandler");
const { deleteFile } = require("../utils/fileUtils");

const processAudio = (filePath) => {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(filePath)) {
            return reject(new AppError("Input file does not exist", 500, filePath));
        }

        const wavFile = `${filePath}.wav`;
        console.log("🔄 Converting MP3 to WAV...");

        const ffmpeg = spawn("ffmpeg", ["-i", filePath, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wavFile]);

        let ffmpegError = '';

        ffmpeg.stderr.on('data', (data) => {
            ffmpegError += data.toString();
        });

        ffmpeg.on("error", (err) => {
            deleteFile(filePath);
            reject(new AppError("FFmpeg process error: " + err.message, 500, filePath));
        });

        ffmpeg.on("close", (code) => {
            // Asynchronously delete the original file
            deleteFile(filePath);

            if (code !== 0) {
                return reject(new AppError(
                    "FFmpeg conversion failed with code " + code + (ffmpegError ? ": " + ffmpegError : ""),
                    500,
                    wavFile
                ));
            }

            if (!fs.existsSync(wavFile)) {
                return reject(new AppError("WAV file was not created during conversion", 500));
            }

            console.log("✅ Conversion complete.");
            resolve(wavFile);
        });
    });
};

module.exports = { processAudio };
