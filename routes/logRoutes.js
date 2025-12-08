const express = require('express');
const router = express.Router();
const logController = require('../controllers/logController');
const authMiddleware = require('../middlewares/authMiddleware');
const examSecurityMiddleware = require('../middlewares/examSecurityMiddleware');

router.post('/tab-switch', authMiddleware, examSecurityMiddleware, logController.logTabSwitch);
router.post('/fullscreen-exit', authMiddleware, examSecurityMiddleware, logController.logFullscreenExit);

module.exports = router;
