// services/transcriber.js
const { spawn } = require("child_process");
const fs = require("fs/promises");
const path = require("path");

// Import the modelPaths from Config
const { modelPaths } = require("../config");
const logger = require("../utils/logger");

// Ensure transcriptions directory exists (using synchronous check for directory creation)
const TRANSCRIPTIONS_DIR = path.join(__dirname, "../../transcriptions");
const fsSync = require("fs");
if (!fsSync.existsSync(TRANSCRIPTIONS_DIR)) {
    fsSync.mkdirSync(TRANSCRIPTIONS_DIR, { recursive: true });
}

/**
 * Retrieves the correct Vosk model path based on the selected language.
 * @param {string} lang - The language code (e.g., "en" or "es").
 * @returns {string} - The corresponding model path.
 */
const getModelPath = (lang) => {
    logger.info(`🗣 Using language model: ${lang}`);
    return modelPaths[lang] || modelPaths.en;
};

/**
 * Transcribes an audio file using a Python Vosk-based transcription script.
 * @param {string} wavFile - The path to the WAV file to transcribe.
 * @param {string} language - The language of the transcription.
 * @returns {Promise<Object>} - Resolves with the transcription text and saved file path.
 */
const transcribeAudio = (wavFile, language) => {
    return new Promise((resolve, reject) => {
        logger.info(`📝 Transcribing with model: ${language}`);

        const pythonProcess = spawn(
            "./venv/bin/python3",
            ["transcribe.py", wavFile, getModelPath(language)],
            { stdio: ["pipe", "pipe", "pipe"] }
        );

        let transcription = "";

        pythonProcess.stdout.on("data", (data) => {
            transcription += data.toString();
        });

        pythonProcess.stderr.on("data", (data) => {
            const errorMsg = data.toString();
            if (!errorMsg.includes("LOG (VoskAPI:")) {
                logger.error(`❌ Python error: ${errorMsg}`);
            }
        });

        pythonProcess.on("close", async (code) => {
            try {
                try {
                    await fs.unlink(wavFile);
                } catch (unlinkError) {
                    logger.warn(`Failed to delete WAV file: ${unlinkError.message}`);
                }

                if (code !== 0) {
                    return reject(new Error("❌ Transcription process failed."));
                }

                const transcriptFile = path.join(TRANSCRIPTIONS_DIR, `${path.basename(wavFile)}.txt`);
                await fs.writeFile(transcriptFile, transcription.trim());

                logger.info(`📄 Transcription saved: ${transcriptFile}`);

                resolve({ text: transcription.trim(), transcriptFile });
            } catch (err) {
                reject(err);
            }
        });
    });
};

module.exports = { transcribeAudio };