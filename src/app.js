// src/app.js
const express = require("express");
const multer = require("multer");
const transcriptionRoutes = require("./routes/transcriptionRoutes");
const { errorHandler } = require("./utils/errorHandler");

const app = express();

// Middleware for file uploads
const upload = multer({ dest: "uploads/" });
app.use(upload.single("audio"));

// Use Transcription Routes
app.use("/transcribe", transcriptionRoutes);

// Error handling middleware
app.use(errorHandler);

module.exports = app;