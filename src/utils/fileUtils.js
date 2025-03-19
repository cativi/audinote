// utils/fileUtils.js
const fs = require("fs");

const deleteFile = (filePath) => {
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (!err) {
            fs.unlink(filePath, (unlinkErr) => {
                if (unlinkErr) {
                    console.error("Error deleting file:", filePath, unlinkErr);
                }
            });
        }
    });
};

module.exports = { deleteFile };
