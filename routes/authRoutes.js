const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');
const { loginLimiter } = require('../middlewares/rateLimitMiddleware');

router.post('/register', authController.register);
router.post('/login', loginLimiter, authController.login);
router.get('/profile', authMiddleware, authController.getProfile);

module.exports = router;
