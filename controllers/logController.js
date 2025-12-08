const Log = require('../models/Log');
const ExamSession = require('../models/ExamSession');

exports.logTabSwitch = async (req, res) => {
  try {
    const Response = require('../models/Response');
    const session = req.session;
    const maxTabSwitches = parseInt(process.env.MAX_TAB_SWITCHES) || 3;

    session.tabSwitchCount += 1;
    await session.save();

    await Log.create({
      userId: req.userId,
      sessionId: session._id,
      eventType: 'TAB_SWITCH',
      eventData: { count: session.tabSwitchCount },
      ipAddress: req.ipAddress
    });

    if (session.tabSwitchCount >= maxTabSwitches) {
      // Calculate current score before disqualifying
      const responses = await Response.find({ 
        userId: req.userId, 
        sessionId: session._id 
      });
      const correctAnswers = responses.filter(r => r.isCorrect).length;
      const totalAnswered = responses.length;

      session.isActive = false;
      session.isSubmitted = true;
      session.isDisqualified = true;
      session.disqualificationReason = `Exceeded maximum tab switches (${maxTabSwitches})`;
      session.submittedAt = new Date();
      session.finalScore = correctAnswers;
      session.totalAnswered = totalAnswered;
      await session.save();

      const User = require('../models/User');
      const user = await User.findById(req.userId);
      user.hasCompletedExam = true;
      await user.save();

      req.io.emit('student-disqualified', { 
        userId: req.userId, 
        reason: `Exceeded maximum tab switches (${maxTabSwitches})`,
        score: correctAnswers,
        totalAnswered: totalAnswered
      });

      return res.json({
        message: 'Disqualified due to excessive tab switches. Your marks have been saved.',
        autoSubmitted: true,
        disqualified: true,
        cannotRejoin: true,
        tabSwitchCount: session.tabSwitchCount,
        score: correctAnswers,
        totalAnswered: totalAnswered
      });
    }

    res.json({
      message: 'Tab switch logged',
      tabSwitchCount: session.tabSwitchCount,
      maxTabSwitches,
      warning: `Warning ${session.tabSwitchCount}/${maxTabSwitches}`
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to log tab switch', error: error.message });
  }
};

exports.logFullscreenExit = async (req, res) => {
  try {
    const ExamControl = require('../models/ExamControl');
    const Response = require('../models/Response');
    const examControl = await ExamControl.findOne();

    await Log.create({
      userId: req.userId,
      sessionId: req.session._id,
      eventType: 'FULLSCREEN_EXIT',
      eventData: {},
      ipAddress: req.ipAddress
    });

    // Always disqualify on fullscreen exit - no rejoin allowed
    const session = req.session;
    
    // Calculate current score before disqualifying
    const responses = await Response.find({ 
      userId: req.userId, 
      sessionId: session._id 
    });
    const correctAnswers = responses.filter(r => r.isCorrect).length;
    const totalAnswered = responses.length;

    session.isActive = false;
    session.isSubmitted = true;
    session.isDisqualified = true;
    session.disqualificationReason = 'Exited fullscreen mode - Cannot rejoin';
    session.submittedAt = new Date();
    session.finalScore = correctAnswers;
    session.totalAnswered = totalAnswered;
    await session.save();

    const User = require('../models/User');
    const user = await User.findById(req.userId);
    user.hasCompletedExam = true;
    await user.save();

    // Emit socket event
    req.io.emit('student-disqualified', { 
      userId: req.userId, 
      reason: 'Exited fullscreen mode - Cannot rejoin',
      score: correctAnswers,
      totalAnswered: totalAnswered
    });

    return res.json({ 
      message: 'Disqualified for exiting fullscreen. Your marks have been saved.',
      disqualified: true,
      cannotRejoin: true,
      score: correctAnswers,
      totalAnswered: totalAnswered
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to log fullscreen exit', error: error.message });
  }
};
