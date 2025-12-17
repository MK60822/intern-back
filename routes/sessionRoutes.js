const express = require('express');
const router = express.Router();
const { createSession, markAttendance, getActiveSession, endSession } = require('../controllers/sessionController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Create a new session (Teacher only)
router.post('/', protect, authorize('teacher'), createSession);

// End active session (Teacher only)
router.post('/end', protect, authorize('teacher'), endSession);

// Mark attendance using session code (Student only)
router.post('/mark-attendance', protect, authorize('student'), markAttendance);

// Get active session for a class (Teacher only)
router.get('/class/:classId', protect, authorize('teacher'), getActiveSession);

module.exports = router;

