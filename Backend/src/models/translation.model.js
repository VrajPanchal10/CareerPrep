const mongoose = require("mongoose");

const translationSchema = new mongoose.Schema({
    sourceText: { type: String, required: true },
    targetLanguage: { type: String, required: true },
    translatedText: { type: String, required: true }
}, {
    timestamps: true
});

// Compound index to guarantee instant lookups and prevent duplicate translation inserts
translationSchema.index({ sourceText: 1, targetLanguage: 1 }, { unique: true });

const translationModel = mongoose.model("Translation", translationSchema);

module.exports = translationModel;
