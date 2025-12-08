const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
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
  eventType: {
    type: String,
    enum: ['TAB_SWITCH', 'FULLSCREEN_EXIT', 'IP_CHANGE', 'DEVICE_CHANGE', 'EXAM_START', 'EXAM_SUBMIT', 'ANSWER_SAVE', 'DISQUALIFIED'],
    required: true
  },
  eventData: {
    type: mongoose.Schema.Types.Mixed
  },
  ipAddress: String,
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('Log', logSchema);
