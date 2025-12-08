const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const adminMiddleware = require('../middlewares/adminMiddleware');

router.post('/login', adminController.login);
router.post('/exam/start', adminMiddleware, adminController.startExamForAll);
router.post('/exam/stop', adminMiddleware, adminController.stopExamForAll);
router.post('/exam/clear', adminMiddleware, adminController.clearExamData);
router.get('/exam/status', adminMiddleware, adminController.getExamStatus);
router.get('/students/live', adminMiddleware, adminController.getLiveStudents);
router.post('/students/disqualify', adminMiddleware, adminController.disqualifyStudent);
router.put('/exam/settings', adminMiddleware, adminController.updateExamSettings);

module.exports = router;
