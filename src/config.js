module.exports = {
    // Accepted audio MIME types for uploads
    allowedMimeTypes: [
        "audio/mpeg",
        "audio/mp3",
        "audio/wav",
        "audio/x-wav",
        "audio/x-mp3",
        "audio/mp4",
        "audio/x-m4a",
        "audio/aac",
        "application/octet-stream"
    ],
    // Valid file extensions (used for validation)
    allowedExtensions: ["mp3", "wav", "m4a", "aac"],
    // Supported transcription languages
    allowedLanguages: ["en", "es"],
    defaultLanguage: "en",
    // FFmpeg config
    ffmpegPath: "ffmpeg",
    ffmpegOptions: {
        sampleRate: "16000", // Hz
        channels: "1", // Mono
        codec: "pcm_s16le" // WAV format
    },
    audioFormat: "wav", // Final output format for processing

    // Centralized error messages for service modules
    errorMessages: {
        fileNotFound: "Input file does not exist",
        ffmpegFailed: "FFmpeg conversion failed",
        wavNotCreated: "WAV file was not created during conversion"
    },

    // Time estimation model for UI feedback / logs
    timeEstimation: {
        fixedOverheadSeconds: 60,
        processingSpeedFactor: 30 // Audio is processed 30x faster than real-time
    },

    // Vosk language model paths
    modelPaths: {
        en: "models/vosk-model-en-us-0.22",
        es: "models/vosk-model-es-0.42"
    }
};
