const express = require('express');
const router = express.Router();
const examController = require('../controllers/examController');
const authMiddleware = require('../middlewares/authMiddleware');
const examSecurityMiddleware = require('../middlewares/examSecurityMiddleware');

router.get('/active', examController.checkExamActive);
router.post('/start', authMiddleware, examController.startExam);
router.get('/status', authMiddleware, examController.getExamStatus);
router.get('/question/:index', authMiddleware, examSecurityMiddleware, examController.getQuestion);
router.post('/answer', authMiddleware, examSecurityMiddleware, examController.saveAnswer);
router.post('/submit', authMiddleware, examSecurityMiddleware, examController.submitExam);
router.get('/result', authMiddleware, examController.getResult);

module.exports = router;
