const calculateRemainingTime = (endTime) => {
  const now = new Date();
  const end = new Date(endTime);
  const remainingMs = end - now;
  
  if (remainingMs <= 0) {
    return 0;
  }
  
  return Math.floor(remainingMs / 1000); // Return seconds
};

const hasExamExpired = (endTime) => {
  return calculateRemainingTime(endTime) <= 0;
};

module.exports = { calculateRemainingTime, hasExamExpired };
