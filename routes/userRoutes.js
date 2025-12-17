const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { getAllUsers, getUsersByRole } = require('../controllers/userController');

// Admin-only routes
router.get('/', protect, adminOnly, getAllUsers);
router.get('/role/:role', protect, adminOnly, getUsersByRole);

module.exports = router;

