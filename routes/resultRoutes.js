const express = require('express');
const router = express.Router();
const resultController = require('../controllers/resultController');
const adminMiddleware = require('../middlewares/adminMiddleware');

router.get('/all', adminMiddleware, resultController.getAllResults);
router.get('/export', adminMiddleware, resultController.exportResults);

module.exports = router;
