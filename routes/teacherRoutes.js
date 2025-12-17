const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { getMyClasses, generateSessionCode, getClassReport, getAnalytics } = require('../controllers/teacherController');

router.use(protect);
router.use(authorize('teacher'));

router.get('/my-classes', getMyClasses);
router.post('/generate-code', generateSessionCode);
router.get('/class-report/:id', getClassReport);
router.get('/analytics', getAnalytics);

module.exports = router;