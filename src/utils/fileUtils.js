// src/utils/fileUtils.js
const fs = require("fs");
const logger = require("./logger");

const deleteFile = (filePath) => {
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (!err) {
            fs.unlink(filePath, (unlinkErr) => {
                if (unlinkErr) {
                    logger.error(`Error deleting file: ${filePath} - ${unlinkErr.message}`);
                }
            });
        }
    });
};

module.exports = { deleteFile };
