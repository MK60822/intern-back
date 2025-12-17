const Class = require('../models/Class');
const Attendance = require('../models/Attendance');
const User = require('../models/User');

// @desc    Create a new class
// @route   POST /api/classes
// @access  Admin only
const createClass = async (req, res) => {
    const { className, subject, teacherId } = req.body;

    try {
        // Validate teacher exists and has teacher role
        const teacher = await User.findById(teacherId);
        if (!teacher) {
            return res.status(404).json({ message: 'Teacher not found' });
        }
        if (teacher.role !== 'teacher') {
            return res.status(400).json({ message: 'Selected user is not a teacher' });
        }

        // Create class
        const newClass = await Class.create({
            className,
            subject,
            teacher: teacherId,
            students: []
        });

        const populatedClass = await Class.findById(newClass._id)
            .populate('teacher', 'name email')
            .populate('students', 'name rollNumber');

        res.status(201).json(populatedClass);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all classes (Role-based filtering)
// @route   GET /api/classes
// @access  Admin, Teacher
const getAllClasses = async (req, res) => {
    try {
        let query = {};

        // Role-based filtering
        if (req.user.role === 'teacher') {
            // Teachers can only see their own classes
            query.teacher = req.user._id;
        }
        // Admins see all classes (no filter)

        const classes = await Class.find(query)
            .populate('teacher', 'name email department')
            .populate('students', 'name email rollNumber')
            .sort({ createdAt: -1 });

        res.json(classes);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Manage student enrollment (Add/Remove)
// @route   PUT /api/classes/:id/student
// @access  Admin only
const manageStudent = async (req, res) => {
    const { id } = req.params;
    const { studentId, action } = req.body;

    try {
        // Validate student exists and has student role
        const student = await User.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }
        if (student.role !== 'student') {
            return res.status(400).json({ message: 'Selected user is not a student' });
        }

        // Find class
        const classDoc = await Class.findById(id);
        if (!classDoc) {
            return res.status(404).json({ message: 'Class not found' });
        }

        // Add or Remove student
        if (action === 'add') {
            // Check if student already enrolled
            if (classDoc.students.includes(studentId)) {
                return res.status(400).json({ message: 'Student already enrolled in this class' });
            }
            classDoc.students.push(studentId);
        } else if (action === 'remove') {
            classDoc.students = classDoc.students.filter(
                s => s.toString() !== studentId.toString()
            );
        } else {
            return res.status(400).json({ message: 'Invalid action. Use "add" or "remove"' });
        }

        await classDoc.save();

        const updatedClass = await Class.findById(id)
            .populate('teacher', 'name email')
            .populate('students', 'name email rollNumber');

        res.json(updatedClass);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get class attendance report
// @route   GET /api/classes/:id/report
// @access  Admin only
const getClassReport = async (req, res) => {
    const { id } = req.params;
    const { month, year } = req.query;

    try {
        // Validate class exists
        const classDoc = await Class.findById(id).populate('students', 'name email rollNumber');
        if (!classDoc) {
            return res.status(404).json({ message: 'Class not found' });
        }

        // Parse month and year
        const monthNum = parseInt(month);
        const yearNum = parseInt(year);

        if (!monthNum || !yearNum) {
            return res.status(400).json({ message: 'Month and year are required' });
        }

        // Calculate date range for the month
        const startDate = new Date(yearNum, monthNum - 1, 1);
        const endDate = new Date(yearNum, monthNum, 0, 23, 59, 59);

        // Aggregation pipeline to calculate attendance
        const attendanceData = await Attendance.aggregate([
            {
                $match: {
                    classId: classDoc._id,
                    date: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $unwind: '$attendees'
            },
            {
                $group: {
                    _id: '$attendees',
                    presentCount: { $sum: 1 }
                }
            }
        ]);

        // Get total sessions count
        const totalSessions = await Attendance.countDocuments({
            classId: classDoc._id,
            date: { $gte: startDate, $lte: endDate }
        });

        // Build report for all students
        const report = classDoc.students.map(student => {
            const attendance = attendanceData.find(
                a => a._id.toString() === student._id.toString()
            );
            const presentCount = attendance ? attendance.presentCount : 0;
            const percentage = totalSessions > 0 ? ((presentCount / totalSessions) * 100).toFixed(2) : 0;

            return {
                studentId: student._id,
                name: student.name,
                email: student.email,
                rollNumber: student.rollNumber,
                presentCount,
                totalSessions,
                percentage: parseFloat(percentage)
            };
        });

        res.json({
            className: classDoc.className,
            subject: classDoc.subject,
            month: monthNum,
            year: yearNum,
            totalSessions,
            report
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { createClass, getAllClasses, manageStudent, getClassReport };

