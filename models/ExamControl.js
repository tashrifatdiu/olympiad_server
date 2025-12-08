const mongoose = require('mongoose');

const examControlSchema = new mongoose.Schema({
  isExamActive: {
    type: Boolean,
    default: false
  },
  examStartTime: {
    type: Date,
    default: null
  },
  examEndTime: {
    type: Date,
    default: null
  },
  questionTimeLimit: {
    type: Number,
    default: 7 // seconds per question
  },
  totalQuestions: {
    type: Number,
    default: 5
  },
  calculatedDuration: {
    type: Number,
    default: 35 // seconds (5 questions × 7 seconds)
  },
  disqualifyOnFullscreenExit: {
    type: Boolean,
    default: true
  },
  currentGlobalQuestion: {
    type: Number,
    default: 0 // Track which question everyone is on
  },
  lastQuestionChangeTime: {
    type: Date,
    default: null
  },
  isCountdownActive: {
    type: Boolean,
    default: false // 10-second countdown before exam starts
  },
  countdownStartTime: {
    type: Date,
    default: null
  },
  countdownDuration: {
    type: Number,
    default: 30, // seconds (20 sec to 5 min = 300 sec)
    min: 20,
    max: 300
  }
}, { timestamps: true });

module.exports = mongoose.model('ExamControl', examControlSchema);
