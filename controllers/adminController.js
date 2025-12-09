const Admin = require('../models/Admin');
const ExamControl = require('../models/ExamControl');
const ExamSession = require('../models/ExamSession');
const User = require('../models/User');
const Response = require('../models/Response');
const Log = require('../models/Log');
const jwt = require('jsonwebtoken');

const generateToken = (adminId) => {
  return jwt.sign({ adminId, role: 'admin' }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    const admin = await Admin.findOne({ username });
    if (!admin) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isPasswordValid = await admin.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(admin._id);

    res.json({
      message: 'Login successful',
      token,
      admin: {
        id: admin._id,
        username: admin.username,
        role: admin.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
};

// Schedule exam for specific date/time
exports.scheduleExam = async (req, res) => {
  try {
    console.log('=== Schedule Exam Called ===');
    console.log('Request body:', req.body);
    
    const { scheduledStartTime } = req.body;
    
    if (!scheduledStartTime) {
      console.log('Error: No scheduledStartTime provided');
      return res.status(400).json({ message: 'Scheduled start time is required' });
    }

    // Parse the scheduled time
    // If it comes as ISO string, it's already in UTC
    // If it comes without timezone, treat as UTC
    const scheduledTime = new Date(scheduledStartTime);
    const now = new Date();
    
    console.log('Received scheduledStartTime:', scheduledStartTime);
    console.log('Parsed scheduled time (UTC):', scheduledTime.toISOString());
    console.log('Parsed scheduled time (Local):', scheduledTime.toLocaleString());
    console.log('Current time (UTC):', now.toISOString());
    console.log('Current time (Local):', now.toLocaleString());

    if (scheduledTime <= now) {
      console.log('Error: Scheduled time is in the past');
      return res.status(400).json({ message: 'Scheduled time must be in the future' });
    }

    console.log('Finding ExamControl...');
    let examControl = await ExamControl.findOne();
    if (!examControl) {
      console.log('Creating new ExamControl...');
      examControl = await ExamControl.create({});
    }
    console.log('ExamControl found/created');

    // Calculate exam duration
    const totalQuestions = examControl.totalQuestions || 5;
    const questionTimeLimit = examControl.questionTimeLimit || 7;
    const calculatedDuration = totalQuestions * questionTimeLimit;
    const countdownSeconds = Math.floor((scheduledTime - now) / 1000);

    console.log('Updating ExamControl with scheduled times...');
    
    // Update fields individually to avoid validation issues
    examControl.isExamActive = true;
    examControl.isCountdownActive = true;
    examControl.countdownStartTime = now;
    examControl.examStartTime = scheduledTime;
    examControl.examEndTime = new Date(scheduledTime.getTime() + (calculatedDuration * 1000));
    examControl.calculatedDuration = calculatedDuration;
    examControl.currentGlobalQuestion = 0;
    examControl.lastQuestionChangeTime = scheduledTime;
    
    console.log('Saving ExamControl...');
    await examControl.save();
    console.log('ExamControl saved successfully');

    // Emit to all students
    if (req.io) {
      console.log('Emitting socket event...');
      req.io.emit('exam-countdown-started', {
        countdownSeconds: countdownSeconds,
        countdownStartTime: now,
        actualStartTime: scheduledTime,
        message: `Exam scheduled to start at ${scheduledTime.toLocaleString()}`
      });
      console.log('Socket event emitted');
    }

    console.log('Sending success response');
    res.json({
      message: 'Exam scheduled successfully',
      scheduledStartTime: scheduledTime,
      countdownSeconds: countdownSeconds,
      examEndTime: examControl.examEndTime,
      duration: `${calculatedDuration} seconds (${totalQuestions} questions × ${questionTimeLimit}s each)`
    });
    console.log('=== Schedule Exam Completed Successfully ===');
  } catch (error) {
    console.error('=== Schedule Exam Error ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    
    res.status(500).json({ 
      message: 'Failed to schedule exam', 
      error: error.message,
      errorName: error.name
    });
  }
};

exports.startExamForAll = async (req, res) => {
  try {
    let examControl = await ExamControl.findOne();
    if (!examControl) {
      examControl = await ExamControl.create({});
    }

    // Calculate exam duration based on questions and time per question
    const totalQuestions = examControl.totalQuestions || 5;
    const questionTimeLimit = examControl.questionTimeLimit || 7;
    const calculatedDuration = totalQuestions * questionTimeLimit; // in seconds

    const now = new Date();

    // Get countdown duration from settings (default 30 seconds)
    const countdownDuration = examControl.countdownDuration || 30;
    const countdownMs = countdownDuration * 1000;

    examControl.isExamActive = true;
    examControl.isCountdownActive = true;
    examControl.countdownStartTime = now;
    examControl.examStartTime = new Date(now.getTime() + countdownMs); // Actual start after countdown
    examControl.examEndTime = new Date(now.getTime() + countdownMs + (calculatedDuration * 1000));
    examControl.calculatedDuration = calculatedDuration;
    examControl.currentGlobalQuestion = 0;
    examControl.lastQuestionChangeTime = new Date(now.getTime() + countdownMs);
    await examControl.save();

    // Emit countdown start event
    req.io.emit('exam-countdown-started', {
      countdownSeconds: countdownDuration,
      countdownStartTime: startTime, // When countdown actually started
      actualStartTime: examControl.examStartTime,
      message: `Exam will start in ${countdownDuration} seconds. Get ready!`
    });

    // After countdown duration, start the actual exam
    setTimeout(async () => {
      try {
        const control = await ExamControl.findOne();
        if (control && control.isExamActive) {
          control.isCountdownActive = false;
          await control.save();

          // Activate all waiting sessions
          await ExamSession.updateMany(
            { isWaitingForStart: true },
            { isActive: true, isWaitingForStart: false }
          );

          // Emit exam actually started event
          req.io.emit('exam-actually-started', {
            startTime: control.examStartTime,
            message: 'Exam has started! Beginning now...'
          });

          // Start global question timer
          startGlobalQuestionTimer(req.io, control);
        }
      } catch (error) {
        console.error('Failed to start exam after countdown:', error);
      }
    }, countdownMs);

    // Emit socket event to all connected clients
    req.io.emit('exam-started', {
      startTime: examControl.examStartTime,
      endTime: examControl.examEndTime,
      questionTimeLimit: examControl.questionTimeLimit,
      totalQuestions: examControl.totalQuestions,
      duration: calculatedDuration
    });

    // Auto-stop exam after countdown + exam duration
    const totalDuration = countdownMs + (calculatedDuration * 1000);
    setTimeout(async () => {
      try {
        const control = await ExamControl.findOne();
        if (control && control.isExamActive) {
          await autoStopExam(req.io);
        }
      } catch (error) {
        console.error('Auto-stop exam failed:', error);
      }
    }, totalDuration);

    res.json({
      message: `Exam countdown started! Students have ${countdownDuration} seconds to join.`,
      examControl,
      countdownSeconds: countdownDuration,
      actualStartTime: examControl.examStartTime,
      duration: `${calculatedDuration} seconds (${totalQuestions} questions × ${questionTimeLimit}s each)`
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to start exam', error: error.message });
  }
};

// Global question timer
let globalQuestionInterval = null;

const startGlobalQuestionTimer = (io, examControl) => {
  // Clear any existing interval
  if (globalQuestionInterval) {
    clearInterval(globalQuestionInterval);
  }

  const questionTimeLimit = examControl.questionTimeLimit || 7;
  const totalQuestions = examControl.totalQuestions || 5;

  globalQuestionInterval = setInterval(async () => {
    try {
      const control = await ExamControl.findOne();
      if (!control || !control.isExamActive) {
        clearInterval(globalQuestionInterval);
        return;
      }

      // Move to next question
      control.currentGlobalQuestion += 1;
      control.lastQuestionChangeTime = new Date();

      // Check if exam is complete
      if (control.currentGlobalQuestion >= totalQuestions) {
        clearInterval(globalQuestionInterval);
        await autoStopExam(io);
        return;
      }

      await control.save();

      // Notify all students to move to next question
      io.emit('global-question-change', {
        currentQuestion: control.currentGlobalQuestion,
        totalQuestions: totalQuestions,
        timePerQuestion: questionTimeLimit
      });

      console.log(`Global question changed to: ${control.currentGlobalQuestion + 1}/${totalQuestions}`);
    } catch (error) {
      console.error('Global question timer error:', error);
    }
  }, questionTimeLimit * 1000);
};

// Helper function to auto-stop exam
const autoStopExam = async (io) => {
  const Response = require('../models/Response');
  
  const examControl = await ExamControl.findOne();
  if (!examControl) return;

  examControl.isExamActive = false;
  await examControl.save();

  // Clear global question timer
  if (globalQuestionInterval) {
    clearInterval(globalQuestionInterval);
    globalQuestionInterval = null;
  }

  // Auto-submit all active sessions
  const activeSessions = await ExamSession.find({ isActive: true });
  
  for (const session of activeSessions) {
    const responses = await Response.find({ 
      userId: session.userId, 
      sessionId: session._id 
    });
    const correctAnswers = responses.filter(r => r.isCorrect).length;

    session.isActive = false;
    session.isSubmitted = true;
    session.submittedAt = new Date();
    session.finalScore = correctAnswers;
    session.totalAnswered = responses.length;
    await session.save();

    const User = require('../models/User');
    const user = await User.findById(session.userId);
    user.hasCompletedExam = true;
    await user.save();
  }

  io.emit('exam-stopped', { reason: 'Time expired' });
  io.emit('exam-auto-stopped', { 
    message: 'Exam time has expired. All active exams have been submitted.',
    timestamp: new Date()
  });
};

exports.stopExamForAll = async (req, res) => {
  try {
    const examControl = await ExamControl.findOne();
    if (!examControl) {
      return res.status(404).json({ message: 'Exam control not found' });
    }

    examControl.isExamActive = false;
    await examControl.save();

    // Auto-submit all active sessions
    await ExamSession.updateMany(
      { isActive: true },
      { isActive: false, isSubmitted: true, submittedAt: new Date() }
    );

    req.io.emit('exam-stopped');

    res.json({ message: 'Exam stopped for all students' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to stop exam', error: error.message });
  }
};

exports.getExamStatus = async (req, res) => {
  try {
    let examControl = await ExamControl.findOne();
    if (!examControl) {
      examControl = await ExamControl.create({});
    }

    res.json(examControl);
  } catch (error) {
    res.status(500).json({ message: 'Failed to get exam status', error: error.message });
  }
};

exports.getLiveStudents = async (req, res) => {
  try {
    const sessions = await ExamSession.find({ isActive: true })
      .populate('userId', 'name email collegeName class rollNumber')
      .lean();

    const studentsData = await Promise.all(
      sessions.map(async (session) => {
        const responses = await Response.countDocuments({ 
          userId: session.userId._id,
          sessionId: session._id 
        });

        const logs = await Log.find({
          userId: session.userId._id,
          sessionId: session._id
        }).sort({ timestamp: -1 }).limit(10);

        const lastFullscreenExit = logs.find(log => log.eventType === 'FULLSCREEN_EXIT');

        return {
          userId: session.userId._id,
          name: session.userId.name,
          email: session.userId.email,
          collegeName: session.userId.collegeName,
          class: session.userId.class,
          rollNumber: session.userId.rollNumber,
          currentQuestionIndex: session.currentQuestionIndex,
          totalQuestions: session.questionOrder.length,
          answeredQuestions: responses,
          tabSwitchCount: session.tabSwitchCount,
          isDisqualified: session.isDisqualified || false,
          disqualificationReason: session.disqualificationReason || null,
          finalScore: session.finalScore || 0,
          totalAnswered: session.totalAnswered || 0,
          startTime: session.startTime,
          lastActivity: logs[0]?.timestamp || session.updatedAt,
          recentLogs: logs
        };
      })
    );

    res.json(studentsData);
  } catch (error) {
    res.status(500).json({ message: 'Failed to get live students', error: error.message });
  }
};

exports.disqualifyStudent = async (req, res) => {
  try {
    const { userId, reason } = req.body;
    const Response = require('../models/Response');

    const session = await ExamSession.findOne({ userId, isActive: true });
    if (!session) {
      return res.status(404).json({ message: 'Active session not found' });
    }

    // Calculate current score before disqualifying
    const responses = await Response.find({ 
      userId, 
      sessionId: session._id 
    });
    const correctAnswers = responses.filter(r => r.isCorrect).length;
    const totalAnswered = responses.length;

    session.isActive = false;
    session.isSubmitted = true;
    session.isDisqualified = true;
    session.disqualificationReason = reason;
    session.submittedAt = new Date();
    session.finalScore = correctAnswers;
    session.totalAnswered = totalAnswered;
    await session.save();

    const User = require('../models/User');
    const user = await User.findById(userId);
    user.hasCompletedExam = true;
    await user.save();

    await Log.create({
      userId,
      sessionId: session._id,
      eventType: 'DISQUALIFIED',
      eventData: { reason, score: correctAnswers, totalAnswered },
      ipAddress: req.ip
    });

    req.io.emit('student-disqualified', { 
      userId, 
      reason,
      score: correctAnswers,
      totalAnswered: totalAnswered
    });

    res.json({ 
      message: 'Student disqualified successfully',
      score: correctAnswers,
      totalAnswered: totalAnswered
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to disqualify student', error: error.message });
  }
};

exports.updateExamSettings = async (req, res) => {
  try {
    const { questionTimeLimit, disqualifyOnFullscreenExit, totalQuestions, countdownDuration } = req.body;

    let examControl = await ExamControl.findOne();
    if (!examControl) {
      examControl = await ExamControl.create({});
    }

    if (questionTimeLimit !== undefined) {
      examControl.questionTimeLimit = questionTimeLimit;
    }
    if (disqualifyOnFullscreenExit !== undefined) {
      examControl.disqualifyOnFullscreenExit = disqualifyOnFullscreenExit;
    }
    if (totalQuestions !== undefined) {
      examControl.totalQuestions = totalQuestions;
    }
    if (countdownDuration !== undefined) {
      // Validate countdown duration (20 seconds to 5 minutes)
      if (countdownDuration >= 20 && countdownDuration <= 300) {
        examControl.countdownDuration = countdownDuration;
      }
    }

    // Recalculate duration
    examControl.calculatedDuration = examControl.totalQuestions * examControl.questionTimeLimit;

    await examControl.save();

    req.io.emit('exam-settings-updated', {
      questionTimeLimit: examControl.questionTimeLimit,
      totalQuestions: examControl.totalQuestions,
      calculatedDuration: examControl.calculatedDuration,
      countdownDuration: examControl.countdownDuration,
      disqualifyOnFullscreenExit: examControl.disqualifyOnFullscreenExit
    });

    res.json({ 
      message: 'Settings updated', 
      examControl,
      duration: `${examControl.calculatedDuration} seconds (${examControl.totalQuestions} questions × ${examControl.questionTimeLimit}s each)`
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update settings', error: error.message });
  }
};


exports.clearExamData = async (req, res) => {
  try {
    // Clear all exam sessions
    await ExamSession.deleteMany({});
    
    // Clear all responses
    await Response.deleteMany({});
    
    // Clear all logs
    await Log.deleteMany({});
    
    // Reset exam control
    await ExamControl.updateMany({}, {
      isExamActive: false,
      isCountdownActive: false,
      examStartTime: null,
      examEndTime: null,
      currentGlobalQuestion: 0,
      countdownStartTime: null
    });
    
    // Reset user exam completion status
    await User.updateMany({}, {
      hasCompletedExam: false
    });
    
    res.json({
      message: 'Exam data cleared successfully. Students can now take the exam again.',
      cleared: {
        sessions: true,
        responses: true,
        logs: true,
        examControl: true,
        userStatus: true
      }
    });
  } catch (error) {
    console.error('Failed to clear exam data:', error);
    res.status(500).json({ message: 'Failed to clear exam data', error: error.message });
  }
};
