// services/transcriber.js
const { spawn } = require("child_process");
const fs = require("fs/promises");
const path = require("path");

// Import the modelPaths from Config
const { modelPaths } = require("../config");

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
    console.log(`🗣 Using language model: ${lang}`);
    // Use the modelPaths from config
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
        console.log(`📝 Transcribing with model: ${language}`);

        // Spawn a Python process to run the transcription script
        const pythonProcess = spawn(
            "./venv/bin/python3",
            ["transcribe.py", wavFile, getModelPath(language)],
            { stdio: ["pipe", "pipe", "pipe"] } // Capture output from Python process
        );

        let transcription = "";

        // Capture transcription output from stdout
        pythonProcess.stdout.on("data", (data) => {
            transcription += data.toString();
        });

        // Capture and log errors from stderr (excluding non-critical Vosk logs)
        pythonProcess.stderr.on("data", (data) => {
            const errorMsg = data.toString();
            if (!errorMsg.includes("LOG (VoskAPI:")) { // Ignore expected logs
                console.error(`❌ Python error: ${errorMsg}`);
            }
        });

        // Handle process completion
        pythonProcess.on("close", async (code) => {
            try {
                // Asynchronously delete the temporary WAV file after processing
                try {
                    await fs.unlink(wavFile);
                } catch (unlinkError) {
                    console.error(`Failed to delete WAV file: ${unlinkError.message}`);
                }

                // Handle failed transcription process
                if (code !== 0) {
                    return reject(new Error("❌ Transcription process failed."));
                }

                // Save the transcription result to a file
                const transcriptFile = path.join(TRANSCRIPTIONS_DIR, `${path.basename(wavFile)}.txt`);
                await fs.writeFile(transcriptFile, transcription.trim());

                console.log(`📄 Transcription saved: ${transcriptFile}`);

                // Return transcription results
                resolve({ text: transcription.trim(), transcriptFile });
            } catch (err) {
                reject(err);
            }
        });
    });
};

module.exports = { transcribeAudio };