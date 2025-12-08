const ExamSession = require('../models/ExamSession');
const Log = require('../models/Log');

const examSecurityMiddleware = async (req, res, next) => {
  try {
    const userId = req.userId;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const deviceFingerprint = req.headers['x-device-fingerprint'];

    // Find session that is either active or waiting to start
    const session = await ExamSession.findOne({ 
      userId, 
      $or: [{ isActive: true }, { isWaitingForStart: true }]
    });

    if (!session) {
      return res.status(404).json({ message: 'No active exam session found' });
    }
    
    // If session is waiting, don't allow question access yet
    if (session.isWaitingForStart) {
      return res.status(403).json({ message: 'Exam has not started yet. Please wait for countdown to finish.' });
    }

    // Check if exam has expired (only for active sessions)
    if (session.isActive && new Date() > session.endTime) {
      session.isActive = false;
      session.isSubmitted = true;
      session.submittedAt = new Date();
      await session.save();
      return res.status(403).json({ message: 'Exam time has expired', autoSubmitted: true });
    }

    // Check IP change
    if (session.ipAddress && session.ipAddress !== ipAddress) {
      await Log.create({
        userId,
        sessionId: session._id,
        eventType: 'IP_CHANGE',
        eventData: { oldIp: session.ipAddress, newIp: ipAddress },
        ipAddress
      });
    }

    // Check device change
    if (session.deviceFingerprint && deviceFingerprint && session.deviceFingerprint !== deviceFingerprint) {
      await Log.create({
        userId,
        sessionId: session._id,
        eventType: 'DEVICE_CHANGE',
        eventData: { oldDevice: session.deviceFingerprint, newDevice: deviceFingerprint },
        ipAddress
      });
      return res.status(403).json({ message: 'Device mismatch detected. Exam locked.' });
    }

    req.session = session;
    req.ipAddress = ipAddress;
    next();
  } catch (error) {
    return res.status(500).json({ message: 'Security check failed', error: error.message });
  }
};

module.exports = examSecurityMiddleware;
