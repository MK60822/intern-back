const express = require('express');
const router = express.Router();
const Class = require('../models/Class');
const { protect } = require('../middleware/authMiddleware');

// Generic route to get all classes (for Admin UI lists)
router.get('/', protect, async (req, res) => {
    const classes = await Class.find().populate('teacher', 'name');
    res.json(classes);
});

module.exports = router;