const fs = require("fs");
const path = require("path");
const { promisify } = require("util");

const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

const UPLOAD_ROOT = path.join(__dirname, "..", "..", "..", "uploads");

/**
 * Ensures the destination directory exists.
 */
async function ensureDir(dirPath) {
    try {
        await mkdir(dirPath, { recursive: true });
    } catch (err) {
        if (err.code !== "EEXIST") throw err;
    }
}

/**
 * Local File Storage Provider.
 */
class LocalStorageProvider {
    constructor() {
        this.name = "local";
    }

    /**
     * Saves a multer file to local disk under the category folder.
     * @param {Object} file - Multer file object
     * @param {String} category - Folder category (e.g., 'resumes', 'avatars')
     * @returns {Object} File storage metadata
     */
    async saveFile(file, category = "resumes") {
        if (!file || !file.buffer) {
            throw new Error("File buffer is required to save.");
        }

        const categoryDir = path.join(UPLOAD_ROOT, category);
        await ensureDir(categoryDir);

        const ext = path.extname(file.originalname);
        const uniqueName = `${path.basename(file.originalname, ext)}-${Date.now()}${ext}`;
        const filePath = path.join(categoryDir, uniqueName);
        const relativePath = path.join(category, uniqueName).replace(/\\/g, "/");

        await writeFile(filePath, file.buffer);

        return {
            storageProvider: this.name,
            relativePath,
            publicUrl: `/api/ats/report/resume/${uniqueName}` // Helper relative url
        };
    }

    /**
     * Returns a readable stream for a file.
     * @param {String} relativePath - The saved relative path
     * @returns {ReadableStream} File read stream
     */
    getFileStream(relativePath) {
        const fullPath = path.join(UPLOAD_ROOT, relativePath);
        if (!fs.existsSync(fullPath)) {
            throw new Error("File not found on disk.");
        }
        return fs.createReadStream(fullPath);
    }

    /**
     * Deletes a file from disk.
     * @param {String} relativePath - The saved relative path
     */
    async deleteFile(relativePath) {
        const fullPath = path.join(UPLOAD_ROOT, relativePath);
        if (fs.existsSync(fullPath)) {
            await unlink(fullPath);
        }
    }
}

module.exports = new LocalStorageProvider();
