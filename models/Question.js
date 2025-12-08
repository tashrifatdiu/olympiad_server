const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  questionText: {
    type: String,
    required: true
  },
  options: [{
    text: String,
    optionId: String
  }],
  correctAnswer: {
    type: String,
    required: true
  },
  subject: {
    type: String,
    enum: ['Physics', 'Chemistry', 'Mathematics', 'Biology'],
    required: true
  },
  difficulty: {
    type: String,
    enum: ['Easy', 'Medium', 'Hard'],
    default: 'Medium'
  },
  marks: {
    type: Number,
    default: 1
  }
}, { timestamps: true });

module.exports = mongoose.model('Question', questionSchema);
