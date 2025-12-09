const ExamSession = require('../models/ExamSession');
const Question = require('../models/Question');
const Response = require('../models/Response');
const User = require('../models/User');
const Log = require('../models/Log');
const generateRandomQuestionSet = require('../utils/generateRandomQuestionSet');
const { shuffleAllQuestionOptions } = require('../utils/shuffleOptions');
const { calculateRemainingTime, hasExamExpired } = require('../utils/serverTimer');

exports.startExam = async (req, res) => {
  try {
    const userId = req.userId;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const deviceFingerprint = req.headers['x-device-fingerprint'] || 'unknown';

    // Check if exam is active globally
    const ExamControl = require('../models/ExamControl');
    const examControl = await ExamControl.findOne();
    console.log('Exam control status:', examControl);
    
    if (!examControl || !examControl.isExamActive) {
      console.log('Exam not active. isExamActive:', examControl?.isExamActive);
      return res.status(403).json({ message: 'Exam has not been started by admin yet. Please wait.' });
    }

    // Check if exam has already ended
    if (examControl.examEndTime && new Date() > new Date(examControl.examEndTime)) {
      console.log('Exam has already ended');
      return res.status(403).json({ message: 'Exam has already ended. You cannot join now.' });
    }

    // Check if countdown has actually ended (in case setTimeout didn't fire)
    if (examControl.isCountdownActive) {
      const now = new Date();
      const examStartTime = new Date(examControl.examStartTime);
      
      if (now >= examStartTime) {
        // Countdown should have ended - update it
        console.log('Countdown time has passed, activating exam...');
        examControl.isCountdownActive = false;
        await examControl.save();
        
        // Activate all waiting sessions
        await ExamSession.updateMany(
          { isWaitingForStart: true },
          { isActive: true, isWaitingForStart: false }
        );
      } else {
        console.log('Countdown phase - student joining early');
      }
    }
    
    console.log('Exam is active, proceeding with student exam start...');

    const user = await User.findById(userId);
    if (user.hasCompletedExam) {
      return res.status(403).json({ message: 'You have already completed the exam' });
    }

    let existingSession = await ExamSession.findOne({ userId });
    console.log('Existing session check:', existingSession ? 'Found' : 'Not found');
    if (existingSession) {
      console.log('Session details:', { 
        isActive: existingSession.isActive, 
        isWaitingForStart: existingSession.isWaitingForStart,
        isSubmitted: existingSession.isSubmitted 
      });
      
      // If session exists and is active, return it
      if (existingSession.isActive) {
        return res.status(400).json({ 
          message: 'Exam already in progress',
          sessionId: existingSession._id,
          questionTimeLimit: examControl.questionTimeLimit
        });
      }
      
      // If session exists and is waiting, return it
      if (existingSession.isWaitingForStart) {
        // Calculate current global question based on elapsed time
        const elapsedSeconds = Math.floor((new Date() - new Date(examControl.examStartTime)) / 1000);
        const questionTimeLimit = examControl.questionTimeLimit || 7;
        let currentGlobalQuestion = Math.floor(elapsedSeconds / questionTimeLimit);
        
        // Don't exceed total questions
        const totalQuestions = examControl?.totalQuestions || 5;
        if (currentGlobalQuestion >= totalQuestions) {
          currentGlobalQuestion = totalQuestions - 1;
        }
        
        return res.json({
          message: 'Joined exam. Waiting for countdown to finish...',
          sessionId: existingSession._id,
          totalQuestions: existingSession.questionOrder.length,
          startTime: existingSession.startTime,
          endTime: existingSession.endTime,
          globalEndTime: examControl.examEndTime,
          remainingTime: calculateRemainingTime(existingSession.endTime),
          questionTimeLimit: examControl.questionTimeLimit,
          currentGlobalQuestion: currentGlobalQuestion,
          isWaitingForStart: true,
          actualStartTime: examControl.examStartTime,
          countdownStartTime: examControl.countdownStartTime
        });
      }
    }

    // Get total questions from exam control
    const totalQuestions = examControl?.totalQuestions || 5;
    
    const questionIds = await generateRandomQuestionSet(totalQuestions);
    const questions = await Question.find({ _id: { $in: questionIds } });
    const shuffledOptions = shuffleAllQuestionOptions(questions);

    // Use the global exam times from exam control
    // If countdown is active, use the actual exam start time (after countdown)
    // Otherwise use current time
    const isWaiting = examControl.isCountdownActive;
    const startTime = isWaiting ? new Date(examControl.examStartTime) : new Date();
    let endTime;
    
    if (examControl.examEndTime) {
      // Use the global exam end time set by admin
      endTime = new Date(examControl.examEndTime);
    } else {
      // Fallback: calculate based on questions and time
      const questionTimeLimit = examControl?.questionTimeLimit || 7;
      const examDurationSeconds = totalQuestions * questionTimeLimit;
      endTime = new Date(startTime.getTime() + examDurationSeconds * 1000);
    }
    
    const session = await ExamSession.create({
      userId,
      questionOrder: questionIds,
      shuffledOptions: Object.fromEntries(shuffledOptions),
      startTime,
      endTime,
      ipAddress,
      deviceFingerprint,
      isActive: !isWaiting, // Not active during countdown
      isWaitingForStart: isWaiting // Waiting for countdown to finish
    });

    user.deviceFingerprint = deviceFingerprint;
    await user.save();

    await Log.create({
      userId,
      sessionId: session._id,
      eventType: 'EXAM_START',
      eventData: { startTime, endTime },
      ipAddress
    });

    // Calculate current global question based on elapsed time
    const elapsedSeconds = Math.floor((new Date() - new Date(examControl.examStartTime)) / 1000);
    const questionTimeLimit = examControl.questionTimeLimit || 7;
    let currentGlobalQuestion = Math.floor(elapsedSeconds / questionTimeLimit);
    
    // Don't exceed total questions
    if (currentGlobalQuestion >= totalQuestions) {
      currentGlobalQuestion = totalQuestions - 1;
    }

    res.json({
      message: isWaiting ? 'Joined exam. Waiting for countdown to finish...' : 'Exam started successfully',
      sessionId: session._id,
      totalQuestions: questionIds.length,
      startTime,
      endTime,
      globalEndTime: examControl.examEndTime, // Send global end time
      remainingTime: calculateRemainingTime(endTime),
      questionTimeLimit: examControl.questionTimeLimit,
      currentGlobalQuestion: currentGlobalQuestion, // Send current question
      isWaitingForStart: isWaiting, // Tell frontend to wait
      actualStartTime: examControl.examStartTime, // When exam will actually start
      countdownStartTime: examControl.countdownStartTime // When countdown started
    });
  } catch (error) {
    console.error('Error in startExam:', error);
    console.error('Error stack:', error.stack);
    
    // Handle duplicate key error - session already exists
    if (error.code === 11000) {
      try {
        // Fetch the existing session and return it
        const existingSession = await ExamSession.findOne({ userId: req.userId });
        if (existingSession) {
          const examControl = await ExamControl.findOne();
          
          // Calculate current global question
          const elapsedSeconds = Math.floor((new Date() - new Date(examControl.examStartTime)) / 1000);
          const questionTimeLimit = examControl.questionTimeLimit || 7;
          let currentGlobalQuestion = Math.floor(elapsedSeconds / questionTimeLimit);
          const totalQuestions = examControl?.totalQuestions || 5;
          if (currentGlobalQuestion >= totalQuestions) {
            currentGlobalQuestion = totalQuestions - 1;
          }
          
          return res.json({
            message: existingSession.isWaitingForStart ? 'Joined exam. Waiting for countdown to finish...' : 'Exam session already exists',
            sessionId: existingSession._id,
            totalQuestions: existingSession.questionOrder.length,
            startTime: existingSession.startTime,
            endTime: existingSession.endTime,
            globalEndTime: examControl.examEndTime,
            remainingTime: calculateRemainingTime(existingSession.endTime),
            questionTimeLimit: examControl.questionTimeLimit,
            currentGlobalQuestion: currentGlobalQuestion,
            isWaitingForStart: existingSession.isWaitingForStart,
            actualStartTime: examControl.examStartTime,
            countdownStartTime: examControl.countdownStartTime
          });
        }
      } catch (fetchError) {
        console.error('Error fetching existing session:', fetchError);
      }
    }
    
    res.status(500).json({ message: 'Failed to start exam', error: error.message });
  }
};

exports.getQuestion = async (req, res) => {
  try {
    const session = req.session;
    const questionIndex = parseInt(req.params.index);

    if (questionIndex < 0 || questionIndex >= session.questionOrder.length) {
      return res.status(400).json({ message: 'Invalid question index' });
    }

    const questionId = session.questionOrder[questionIndex];
    const question = await Question.findById(questionId).select('-correctAnswer');

    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    const shuffledOrder = session.shuffledOptions.get(questionId.toString());
    const orderedOptions = shuffledOrder.map(optionId => 
      question.options.find(opt => opt.optionId === optionId)
    );

    const previousResponse = await Response.findOne({
      userId: req.userId,
      questionId
    });

    res.json({
      questionIndex,
      totalQuestions: session.questionOrder.length,
      question: {
        id: question._id,
        text: question.questionText,
        options: orderedOptions,
        subject: question.subject,
        marks: question.marks
      },
      selectedAnswer: previousResponse?.selectedAnswer || null,
      remainingTime: calculateRemainingTime(session.endTime)
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch question', error: error.message });
  }
};

exports.saveAnswer = async (req, res) => {
  try {
    const session = req.session;
    const { questionId, selectedAnswer } = req.body;

    if (!questionId || !selectedAnswer) {
      return res.status(400).json({ message: 'Question ID and answer are required' });
    }

    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    const isCorrect = question.correctAnswer === selectedAnswer;

    await Response.findOneAndUpdate(
      { userId: req.userId, questionId },
      {
        userId: req.userId,
        sessionId: session._id,
        questionId,
        selectedAnswer,
        isCorrect,
        answeredAt: new Date()
      },
      { upsert: true, new: true }
    );

    await Log.create({
      userId: req.userId,
      sessionId: session._id,
      eventType: 'ANSWER_SAVE',
      eventData: { questionId, selectedAnswer },
      ipAddress: req.ipAddress
    });

    res.json({ 
      message: 'Answer saved successfully',
      remainingTime: calculateRemainingTime(session.endTime)
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to save answer', error: error.message });
  }
};

exports.submitExam = async (req, res) => {
  try {
    const session = req.session;

    if (session.isSubmitted) {
      return res.status(400).json({ message: 'Exam already submitted' });
    }

    session.isActive = false;
    session.isSubmitted = true;
    session.submittedAt = new Date();
    await session.save();

    const user = await User.findById(req.userId);
    user.hasCompletedExam = true;
    await user.save();

    const responses = await Response.find({ userId: req.userId, sessionId: session._id });
    const correctAnswers = responses.filter(r => r.isCorrect).length;
    const totalQuestions = session.questionOrder.length;
    const score = correctAnswers;

    await Log.create({
      userId: req.userId,
      sessionId: session._id,
      eventType: 'EXAM_SUBMIT',
      eventData: { score, totalQuestions, submittedAt: session.submittedAt },
      ipAddress: req.ipAddress
    });

    res.json({
      message: 'Exam submitted successfully',
      score,
      totalQuestions,
      correctAnswers,
      submittedAt: session.submittedAt
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to submit exam', error: error.message });
  }
};

exports.getExamStatus = async (req, res) => {
  try {
    const session = await ExamSession.findOne({ userId: req.userId });

    if (!session) {
      return res.json({ hasSession: false });
    }

    const isExpired = hasExamExpired(session.endTime);

    if (isExpired && session.isActive) {
      const Response = require('../models/Response');
      const responses = await Response.find({ 
        userId: req.userId, 
        sessionId: session._id 
      });
      const correctAnswers = responses.filter(r => r.isCorrect).length;

      session.isActive = false;
      session.isSubmitted = true;
      session.submittedAt = new Date();
      session.finalScore = correctAnswers;
      session.totalAnswered = responses.length;
      await session.save();

      const user = await User.findById(req.userId);
      user.hasCompletedExam = true;
      await user.save();
    }

    // If disqualified, cannot rejoin
    if (session.isDisqualified) {
      return res.json({
        hasSession: true,
        isActive: false,
        isSubmitted: true,
        isDisqualified: true,
        disqualificationReason: session.disqualificationReason,
        cannotRejoin: true,
        finalScore: session.finalScore,
        totalAnswered: session.totalAnswered
      });
    }

    // If waiting for start, check if countdown has ended
    if (session.isWaitingForStart) {
      const ExamControl = require('../models/ExamControl');
      const examControl = await ExamControl.findOne();
      
      // Check if countdown time has actually passed
      let countdownEnded = false;
      if (examControl && examControl.isCountdownActive) {
        const now = new Date();
        const examStartTime = new Date(examControl.examStartTime);
        if (now >= examStartTime) {
          // Countdown has ended - update it
          examControl.isCountdownActive = false;
          await examControl.save();
          countdownEnded = true;
        }
      }
      
      // If countdown is no longer active, activate this session
      if (examControl && (!examControl.isCountdownActive || countdownEnded) && examControl.isExamActive) {
        session.isActive = true;
        session.isWaitingForStart = false;
        await session.save();
        
        // Return active status
        return res.json({
          hasSession: true,
          isActive: true,
          isWaitingForStart: false,
          currentQuestionIndex: session.currentQuestionIndex,
          totalQuestions: session.questionOrder.length,
          remainingTime: calculateRemainingTime(session.endTime),
          tabSwitchCount: session.tabSwitchCount,
          maxTabSwitches: parseInt(process.env.MAX_TAB_SWITCHES) || 3,
          questionTimeLimit: examControl.questionTimeLimit
        });
      }
      
      // Still waiting
      return res.json({
        hasSession: true,
        isActive: false,
        isWaitingForStart: true,
        actualStartTime: examControl?.examStartTime,
        message: 'Waiting for exam to start...'
      });
    }

    res.json({
      hasSession: true,
      isActive: session.isActive && !isExpired,
      isSubmitted: session.isSubmitted || isExpired,
      isDisqualified: session.isDisqualified || false,
      currentQuestionIndex: session.currentQuestionIndex,
      totalQuestions: session.questionOrder.length,
      remainingTime: calculateRemainingTime(session.endTime),
      tabSwitchCount: session.tabSwitchCount,
      maxTabSwitches: parseInt(process.env.MAX_TAB_SWITCHES) || 3
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch exam status', error: error.message });
  }
};

exports.checkExamActive = async (req, res) => {
  try {
    const ExamControl = require('../models/ExamControl');
    const examControl = await ExamControl.findOne();
    
    // Calculate current question based on elapsed time
    let currentGlobalQuestion = 0;
    if (examControl && examControl.isExamActive && examControl.examStartTime) {
      const elapsedSeconds = Math.floor((new Date() - new Date(examControl.examStartTime)) / 1000);
      const questionTimeLimit = examControl.questionTimeLimit || 7;
      currentGlobalQuestion = Math.floor(elapsedSeconds / questionTimeLimit);
      
      // Don't exceed total questions
      if (currentGlobalQuestion >= examControl.totalQuestions) {
        currentGlobalQuestion = examControl.totalQuestions - 1;
      }
    }
    
    res.json({
      isExamActive: examControl?.isExamActive || false,
      questionTimeLimit: examControl?.questionTimeLimit || 7,
      totalQuestions: examControl?.totalQuestions || 5,
      currentGlobalQuestion: currentGlobalQuestion,
      examStartTime: examControl?.examStartTime
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to check exam status', error: error.message });
  }
};

exports.getResult = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user.hasCompletedExam) {
      return res.status(403).json({ message: 'Exam not completed yet' });
    }

    const session = await ExamSession.findOne({ userId: req.userId });
    
    // If disqualified, return saved marks
    if (session.isDisqualified) {
      return res.json({
        score: session.finalScore || 0,
        totalQuestions: session.questionOrder.length,
        correctAnswers: session.finalScore || 0,
        incorrectAnswers: session.totalAnswered - (session.finalScore || 0),
        rank: null,
        totalParticipants: null,
        submittedAt: session.submittedAt,
        isDisqualified: true,
        disqualificationReason: session.disqualificationReason
      });
    }

    const responses = await Response.find({ userId: req.userId, sessionId: session._id });
    
    const correctAnswers = responses.filter(r => r.isCorrect).length;
    const totalQuestions = session.questionOrder.length;
    const score = correctAnswers;

    // Only rank non-disqualified students
    const allSessions = await ExamSession.find({ isSubmitted: true, isDisqualified: false });
    const allScores = await Promise.all(
      allSessions.map(async (s) => {
        const resp = await Response.find({ sessionId: s._id });
        return {
          userId: s.userId,
          score: resp.filter(r => r.isCorrect).length
        };
      })
    );

    allScores.sort((a, b) => b.score - a.score);
    const rank = allScores.findIndex(s => s.userId.toString() === req.userId.toString()) + 1;

    res.json({
      score,
      totalQuestions,
      correctAnswers,
      incorrectAnswers: totalQuestions - correctAnswers,
      rank,
      totalParticipants: allScores.length,
      submittedAt: session.submittedAt,
      isDisqualified: false
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch result', error: error.message });
  }
};
