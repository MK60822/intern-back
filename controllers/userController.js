const User = require('../models/User');

// @desc    Get all users (for admin)
// @route   GET /api/users
// @access  Admin only
const getAllUsers = async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get users by role
// @route   GET /api/users/role/:role
// @access  Admin only
const getUsersByRole = async (req, res) => {
    const { role } = req.params;

    try {
        const users = await User.find({ role }).select('-password').sort({ name: 1 });
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getAllUsers, getUsersByRole };

