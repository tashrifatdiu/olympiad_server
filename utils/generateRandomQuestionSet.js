const Question = require('../models/Question');

const generateRandomQuestionSet = async (count = 5) => {
  // Ensure count is a valid number
  count = parseInt(count) || 5;
  try {
    const allQuestions = await Question.find({});
    
    if (allQuestions.length < count) {
      throw new Error(`Not enough questions in database. Required: ${count}, Available: ${allQuestions.length}`);
    }

    // Fisher-Yates shuffle algorithm
    const shuffled = [...allQuestions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled.slice(0, count).map(q => q._id);
  } catch (error) {
    throw error;
  }
};

module.exports = generateRandomQuestionSet;
