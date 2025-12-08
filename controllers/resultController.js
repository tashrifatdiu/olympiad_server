const ExamSession = require('../models/ExamSession');
const User = require('../models/User');
const Response = require('../models/Response');

exports.getAllResults = async (req, res) => {
  try {
    // Get all submitted sessions (both completed and disqualified)
    const sessions = await ExamSession.find({ 
      isSubmitted: true 
    }).populate('userId', 'name email collegeName class rollNumber').sort({ submittedAt: -1 });

    const results = await Promise.all(
      sessions.map(async (session) => {
        const responses = await Response.find({ 
          userId: session.userId._id,
          sessionId: session._id 
        });

        const correctAnswers = responses.filter(r => r.isCorrect).length;
        const totalAnswered = responses.length;
        const totalQuestions = session.questionOrder.length;

        return {
          userId: session.userId._id,
          name: session.userId.name,
          email: session.userId.email,
          collegeName: session.userId.collegeName,
          class: session.userId.class,
          rollNumber: session.userId.rollNumber,
          score: session.isDisqualified ? session.finalScore : correctAnswers,
          totalAnswered: session.isDisqualified ? session.totalAnswered : totalAnswered,
          totalQuestions,
          percentage: ((session.isDisqualified ? session.finalScore : correctAnswers) / totalQuestions * 100).toFixed(2),
          isDisqualified: session.isDisqualified || false,
          disqualificationReason: session.disqualificationReason || null,
          status: session.isDisqualified ? 'Disqualified' : 'Completed',
          startTime: session.startTime,
          submittedAt: session.submittedAt,
          timeTaken: Math.floor((new Date(session.submittedAt) - new Date(session.startTime)) / 1000), // seconds
          tabSwitchCount: session.tabSwitchCount
        };
      })
    );

    // Calculate ranks for non-disqualified students
    const completedResults = results.filter(r => !r.isDisqualified);
    completedResults.sort((a, b) => b.score - a.score);
    
    completedResults.forEach((result, index) => {
      result.rank = index + 1;
    });

    // Add null rank for disqualified students
    results.forEach(result => {
      if (result.isDisqualified) {
        result.rank = null;
      } else {
        const completedResult = completedResults.find(r => r.userId.toString() === result.userId.toString());
        result.rank = completedResult ? completedResult.rank : null;
      }
    });

    // Sort by status (completed first) then by rank/score
    results.sort((a, b) => {
      if (a.isDisqualified && !b.isDisqualified) return 1;
      if (!a.isDisqualified && b.isDisqualified) return -1;
      if (!a.isDisqualified && !b.isDisqualified) return a.rank - b.rank;
      return b.score - a.score;
    });

    res.json({
      totalStudents: results.length,
      completedStudents: completedResults.length,
      disqualifiedStudents: results.filter(r => r.isDisqualified).length,
      results
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch results', error: error.message });
  }
};

exports.exportResults = async (req, res) => {
  try {
    const sessions = await ExamSession.find({ 
      isSubmitted: true 
    }).populate('userId', 'name email collegeName class rollNumber').sort({ submittedAt: -1 });

    const results = await Promise.all(
      sessions.map(async (session) => {
        const responses = await Response.find({ 
          userId: session.userId._id,
          sessionId: session._id 
        });

        const correctAnswers = responses.filter(r => r.isCorrect).length;
        const totalAnswered = responses.length;

        return {
          Name: session.userId.name,
          Email: session.userId.email,
          College: session.userId.collegeName,
          Class: session.userId.class,
          RollNumber: session.userId.rollNumber,
          Score: session.isDisqualified ? session.finalScore : correctAnswers,
          TotalAnswered: session.isDisqualified ? session.totalAnswered : totalAnswered,
          TotalQuestions: session.questionOrder.length,
          Percentage: ((session.isDisqualified ? session.finalScore : correctAnswers) / session.questionOrder.length * 100).toFixed(2),
          Status: session.isDisqualified ? 'Disqualified' : 'Completed',
          DisqualificationReason: session.disqualificationReason || 'N/A',
          TabSwitches: session.tabSwitchCount,
          StartTime: session.startTime,
          SubmittedAt: session.submittedAt,
          TimeTaken: Math.floor((new Date(session.submittedAt) - new Date(session.startTime)) / 1000) + ' seconds'
        };
      })
    );

    // Convert to CSV
    if (results.length === 0) {
      return res.status(404).json({ message: 'No results to export' });
    }

    const headers = Object.keys(results[0]);
    const csv = [
      headers.join(','),
      ...results.map(row => headers.map(header => {
        const value = row[header];
        return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
      }).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=exam-results.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ message: 'Failed to export results', error: error.message });
  }
};
