const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { markAttendance, getStudentStats } = require('../controllers/studentController');

router.use(protect);
router.use(authorize('student'));

router.post('/mark-attendance', markAttendance);
router.get('/my-percentage', getStudentStats);

module.exports = router;