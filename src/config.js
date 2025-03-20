module.exports = {
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
    allowedExtensions: ["mp3", "wav", "m4a", "aac"],
    allowedLanguages: ["en", "es"],
    defaultLanguage: "en",
    ffmpegPath: "ffmpeg",
    ffmpegOptions: {
        sampleRate: "16000",
        channels: "1",
        codec: "pcm_s16le"
    },
    audioFormat: "wav",
    errorMessages: {
        fileNotFound: "Input file does not exist",
        ffmpegFailed: "FFmpeg conversion failed",
        wavNotCreated: "WAV file was not created during conversion"
    },
    timeEstimation: {
        fixedOverheadSeconds: 60,
        processingSpeedFactor: 30 // Audio is processed 30x faster than real-time
    }
};
