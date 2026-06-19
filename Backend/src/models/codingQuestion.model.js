const mongoose = require("mongoose");

const codingQuestionSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        unique: true
    },
    description: {
        type: String,
        required: true
    },
    difficulty: {
        type: String,
        enum: ["Easy", "Medium", "Hard"],
        required: true
    },
    topic: {
        type: String,
        required: true
    },
    sampleInput: {
        type: String,
        default: ""
    },
    sampleOutput: {
        type: String,
        default: ""
    },
    constraints: {
        type: [String],
        default: []
    },
    hints: {
        type: [String],
        default: []
    },
    isCustom: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

const codingQuestionModel = mongoose.model("CodingQuestion", codingQuestionSchema);

module.exports = codingQuestionModel;
