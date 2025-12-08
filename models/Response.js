const mongoose = require('mongoose');

const responseSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExamSession',
    required: true
  },
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
    required: true
  },
  selectedAnswer: {
    type: String,
    default: null
  },
  isCorrect: {
    type: Boolean,
    default: null
  },
  answeredAt: Date
}, { timestamps: true });

responseSchema.index({ userId: 1, questionId: 1 }, { unique: true });

module.exports = mongoose.model('Response', responseSchema);
