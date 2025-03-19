const express = require("express");
const multer = require("multer");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();
const port = 3000;

// Set up file upload
const upload = multer({ dest: "uploads/" });

// Function to determine which model to use
const getModelPath = (lang) => {
    if (lang === "es") {
        return "models/vosk-model-es-0.42";
    }
    return "models/vosk-model-en-us-0.22"; // Default to English
};

// Transcription route
app.post("/transcribe", upload.single("audio"), (req, res) => {
    const filePath = req.file.path;
    const wavFile = filePath + ".wav";
    const language = req.body.language || "en"; // Default to English

    console.log(`Received file: ${req.file.originalname}`);
    console.log(`Converting to WAV...`);

    // Convert MP3 to WAV using ffmpeg
    const ffmpeg = spawn("ffmpeg", ["-i", filePath, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wavFile]);

    ffmpeg.on("close", () => {
        console.log(`Conversion complete. Using model for language: ${language}`);

        // Run Vosk transcription with the correct model
        const pythonProcess = spawn("./venv/bin/python3", ["transcribe.py", wavFile, getModelPath(language)]);

        let transcription = "";
        pythonProcess.stdout.on("data", (data) => {
            transcription += data.toString();
        });

        pythonProcess.on("close", () => {
            console.log(`Transcription complete.`);
            
            // Cleanup files
            fs.unlinkSync(filePath);
            fs.unlinkSync(wavFile);

            res.json({ text: transcription.trim() });
        });
    });
});

// Start server
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));

