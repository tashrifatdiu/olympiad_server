const mongoose = require('mongoose');

const examSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  questionOrder: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question'
  }],
  shuffledOptions: {
    type: Map,
    of: [String]
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  currentQuestionIndex: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isSubmitted: {
    type: Boolean,
    default: false
  },
  submittedAt: Date,
  ipAddress: String,
  deviceFingerprint: String,
  tabSwitchCount: {
    type: Number,
    default: 0
  },
  isDisqualified: {
    type: Boolean,
    default: false
  },
  disqualificationReason: {
    type: String,
    default: null
  },
  finalScore: {
    type: Number,
    default: 0
  },
  totalAnswered: {
    type: Number,
    default: 0
  },
  isWaitingForStart: {
    type: Boolean,
    default: false // True during countdown phase
  }
}, { timestamps: true });

module.exports = mongoose.model('ExamSession', examSessionSchema);
