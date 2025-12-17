const Session = require('../models/Session');
const Class = require('../models/Class');
const Attendance = require('../models/Attendance');
const User = require('../models/User');

// Helper function to generate random 6-character alphanumeric code
const generateSessionCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
};

// @desc    Create a new session (Teacher Only)
// @route   POST /api/sessions
// @access  Teacher only
const createSession = async (req, res) => {
    const { classId } = req.body;

    try {
        // Validate that the class exists
        const classDoc = await Class.findById(classId);
        if (!classDoc) {
            return res.status(404).json({ message: 'Class not found' });
        }

        // Verify that the teacher owns this class
        if (classDoc.teacher.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'You are not authorized to start a session for this class' });
        }

        // Deactivate any existing active sessions for this class
        await Session.updateMany(
            { classId, isActive: true },
            { isActive: false }
        );

        // Clear the active session code from the class
        await Class.findByIdAndUpdate(classId, { activeSessionCode: null });

        // Generate a unique code
        let sessionCode = generateSessionCode();
        let existingSession = await Session.findOne({ sessionCode, isActive: true });

        // Ensure code is unique (regenerate if collision)
        while (existingSession) {
            sessionCode = generateSessionCode();
            existingSession = await Session.findOne({ sessionCode, isActive: true });
        }

        // Create new session
        const session = await Session.create({
            classId,
            sessionCode,
            isActive: true
        });

        // Update the class with the active session code
        await Class.findByIdAndUpdate(classId, { activeSessionCode: sessionCode });

        res.status(201).json({
            success: true,
            code: session.sessionCode,
            classId: session.classId,
            className: classDoc.className,
            subject: classDoc.subject,
            sessionId: session._id
        });

    } catch (error) {
        console.error('Error creating session:', error);
        res.status(500).json({ message: 'Server error while creating session' });
    }
};

// @desc    Mark attendance using session code (Student Only)
// @route   POST /api/sessions/mark-attendance
// @access  Student only
const markAttendance = async (req, res) => {
    const { code, sessionCode } = req.body;
    const attendanceCode = code || sessionCode;

    if (!attendanceCode) {
        return res.status(400).json({ message: 'Session code is required' });
    }

    try {
        // Find active session with this code
        const session = await Session.findOne({ sessionCode: attendanceCode.toUpperCase(), isActive: true });

        if (!session) {
            return res.status(404).json({ message: 'Invalid or expired session code' });
        }

        // Check if student is enrolled in this class
        const classDoc = await Class.findById(session.classId);
        const isEnrolled = classDoc.students.some(
            studentId => studentId.toString() === req.user._id.toString()
        );

        if (!isEnrolled) {
            return res.status(403).json({ message: 'You are not enrolled in this class' });
        }

        // Check if student already marked attendance for this session
        if (session.presentStudents.includes(req.user._id)) {
            return res.status(400).json({ message: 'Attendance already marked for this session' });
        }

        // Add student to presentStudents array in session
        session.presentStudents.push(req.user._id);
        await session.save();

        // 6. Emit real-time updates to teacher and class room
        const attendanceUpdate = {
            classId: classDoc._id,
            sessionId: session._id,
            studentId: req.user._id,
            studentName: req.user.name,
            rollNumber: req.user.rollNumber,
            timestamp: new Date(),
            presentCount: session.presentStudents.length
        };

        // Emit to teacher's room
        global.io.to(`teacher-${classDoc.teacher}`).emit('attendance-marked', attendanceUpdate);

        // Emit to class room (for any other listeners)
        global.io.to(`class-${classDoc._id}`).emit('attendance-update', attendanceUpdate);

        res.status(200).json({
            success: true,
            message: 'Attendance marked successfully',
            className: classDoc.className,
            subject: classDoc.subject,
            date: session.date
        });

    } catch (error) {
        console.error('Error marking attendance:', error);
        res.status(500).json({ message: 'Server error while marking attendance' });
    }
};

// @desc    Get active session for a class (Teacher Only)
// @route   GET /api/sessions/class/:classId
// @access  Teacher only
const getActiveSession = async (req, res) => {
    try {
        const session = await Session.findOne({
            classId: req.params.classId,
            isActive: true
        }).populate('classId');

        if (!session) {
            return res.status(404).json({ message: 'No active session found' });
        }

        res.status(200).json(session);
    } catch (error) {
        console.error('Error fetching session:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    End active session for a class (Teacher Only)
// @route   POST /api/sessions/end
// @access  Teacher only
const endSession = async (req, res) => {
    const { classId } = req.body;

    try {
        // Validate that the class exists and teacher owns it
        const classDoc = await Class.findById(classId);
        if (!classDoc) {
            return res.status(404).json({ message: 'Class not found' });
        }

        if (classDoc.teacher.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'You are not authorized to end sessions for this class' });
        }

        // Find and deactivate the active session
        const session = await Session.findOneAndUpdate(
            { classId, isActive: true },
            { isActive: false },
            { new: true }
        );

        if (!session) {
            return res.status(404).json({ message: 'No active session found for this class' });
        }

        // Clear the active session code from the class
        await Class.findByIdAndUpdate(classId, { activeSessionCode: null });

        res.status(200).json({
            success: true,
            message: 'Session ended successfully',
            sessionId: session._id,
            presentCount: session.presentStudents.length
        });

    } catch (error) {
        console.error('Error ending session:', error);
        res.status(500).json({ message: 'Server error while ending session' });
    }
};

module.exports = {
    createSession,
    markAttendance,
    getActiveSession,
    endSession
};

