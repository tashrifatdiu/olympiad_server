const shuffleOptions = (options) => {
  const shuffled = [...options];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.map(opt => opt.optionId);
};

const shuffleAllQuestionOptions = (questions) => {
  const shuffledOptionsMap = new Map();
  
  questions.forEach(question => {
    const shuffledOrder = shuffleOptions(question.options);
    shuffledOptionsMap.set(question._id.toString(), shuffledOrder);
  });
  
  return shuffledOptionsMap;
};

module.exports = { shuffleOptions, shuffleAllQuestionOptions };
