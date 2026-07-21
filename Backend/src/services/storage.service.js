const localStorage = require("./providers/local.storage");

class StorageService {
    constructor() {
        // By default, we use local disk storage provider.
        // In the future, this can load S3StorageProvider or CloudinaryProvider based on env.
        this.provider = localStorage;
    }

    /**
     * Saves file and returns provider agnostic metadata.
     * @param {Object} file - Multer file
     * @param {String} category - Category subfolder
     * @returns {Object} { storageProvider, relativePath, publicUrl }
     */
    async saveFile(file, category = "resumes") {
        return await this.provider.saveFile(file, category);
    }

    /**
     * Retrieves readable file stream from the saved relative path.
     * @param {String} relativePath - The saved relative path
     * @returns {ReadableStream}
     */
    getFileStream(relativePath) {
        return this.provider.getFileStream(relativePath);
    }

    /**
     * Deletes file from storage.
     * @param {String} relativePath - The saved relative path
     */
    async deleteFile(relativePath) {
        return await this.provider.deleteFile(relativePath);
    }
}

module.exports = new StorageService();
