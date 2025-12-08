const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  collegeName: {
    type: String,
    required: true
  },
  class: {
    type: String,
    enum: ['11', '12'],
    required: true
  },
  rollNumber: {
    type: String,
    required: true
  },
  hasCompletedExam: {
    type: Boolean,
    default: false
  },
  deviceFingerprint: {
    type: String,
    default: null
  }
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
