const express = require("express");
const multer = require("multer");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();
const port = 3000;

// Ensure transcriptions directory exists
const TRANSCRIPTIONS_DIR = "transcriptions";
if (!fs.existsSync(TRANSCRIPTIONS_DIR)) {
    fs.mkdirSync(TRANSCRIPTIONS_DIR, { recursive: true });
}

// Set up file upload
const upload = multer({ dest: "uploads/" });

// Function to determine which model to use
const getModelPath = (lang) => {
    const models = {
        es: "models/vosk-model-es-0.42",
        en: "models/vosk-model-en-us-0.22"
    };
    console.log(`🗣 Using Vosk model: ${models[lang] || models.en}`);
    return models[lang] || models.en; // Default to English if language not found
};


// Transcription route
app.post("/transcribe", upload.single("audio"), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No audio file provided." });
    }

    const filePath = req.file.path;
    const wavFile = `${filePath}.wav`;
    const language = req.body.language || "en"; // Default to English

    console.log(`📥 Received file: ${req.file.originalname}`);
    console.log("🔄 Converting MP3 to WAV...");

    // Convert MP3 to WAV using FFmpeg
    const ffmpeg = spawn("ffmpeg", ["-i", filePath, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wavFile]);

    ffmpeg.on("close", (code) => {
        if (code !== 0) {
            console.error("❌ FFmpeg conversion failed.");
            return res.status(500).json({ error: "Failed to convert audio." });
        }

        console.log(`✅ Conversion complete. Using model for language: ${language}`);

        // Run Vosk transcription with the correct model
        const pythonProcess = spawn("./venv/bin/python3", ["transcribe.py", wavFile, getModelPath(language)]);

        pythonProcess.stderr.on("data", (data) => {
            console.error(`❌ Python error: ${data}`);
        });

        let transcription = "";
        pythonProcess.stdout.on("data", (data) => {
            transcription += data.toString();
        });

        pythonProcess.on("close", (code) => {
            if (code !== 0) {
                console.error("❌ Transcription process failed.");
                return res.status(500).json({ error: "Failed to transcribe audio." });
            }

            console.log("✅ Transcription complete.");

            // Save transcription to file
            const transcriptFile = path.join(TRANSCRIPTIONS_DIR, `${req.file.originalname}.txt`);
            fs.writeFileSync(transcriptFile, transcription.trim());
            console.log(`📄 Transcription saved: ${transcriptFile}`);

            // Cleanup temporary files
            fs.unlinkSync(filePath);
            fs.unlinkSync(wavFile);

            res.json({ text: transcription.trim(), transcriptFile });
        });
    });
});

// Start server
app.listen(port, () => console.log(`🚀 Server running on http://localhost:${port}`));
