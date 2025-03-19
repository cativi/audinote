// services/transcriber.js
const { spawn } = require("child_process");
const fs = require("fs/promises");
const path = require("path");

// Ensure transcriptions directory exists (using synchronous check for directory creation)
const TRANSCRIPTIONS_DIR = path.join(__dirname, "../../transcriptions");
const fsSync = require("fs");
if (!fsSync.existsSync(TRANSCRIPTIONS_DIR)) {
    fsSync.mkdirSync(TRANSCRIPTIONS_DIR, { recursive: true });
}

const getModelPath = (lang) => {
    const models = {
        es: "models/vosk-model-es-0.42",
        en: "models/vosk-model-en-us-0.22"
    };
    console.log(`🗣 Using language model: ${lang}`);
    return models[lang] || models.en;
};

const transcribeAudio = (wavFile, language) => {
    return new Promise((resolve, reject) => {
        console.log(`📝 Transcribing with model: ${language}`);

        const pythonProcess = spawn(
            "./venv/bin/python3",
            ["transcribe.py", wavFile, getModelPath(language)],
            { stdio: ['pipe', 'pipe', 'pipe'] }
        );

        let transcription = "";

        pythonProcess.stdout.on("data", (data) => {
            transcription += data.toString();
        });

        pythonProcess.stderr.on("data", (data) => {
            const errorMsg = data.toString();
            if (!errorMsg.includes("LOG (VoskAPI:")) {
                console.error(`❌ Python error: ${errorMsg}`);
            }
        });

        pythonProcess.on("close", async (code) => {
            try {
                // Asynchronously delete the WAV file
                try {
                    await fs.unlink(wavFile);
                } catch (unlinkError) {
                    console.error(`Failed to delete WAV file: ${unlinkError.message}`);
                }

                if (code !== 0) {
                    return reject(new Error("❌ Transcription process failed."));
                }

                const transcriptFile = path.join(TRANSCRIPTIONS_DIR, `${path.basename(wavFile)}.txt`);
                await fs.writeFile(transcriptFile, transcription.trim());
                console.log(`📄 Transcription saved: ${transcriptFile}`);
                resolve({ text: transcription.trim(), transcriptFile });
            } catch (err) {
                reject(err);
            }
        });
    });
};

module.exports = { transcribeAudio };
