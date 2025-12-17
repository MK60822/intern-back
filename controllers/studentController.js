const Class = require('../models/Class');
const Session = require('../models/Session');

// @desc    Mark Attendance via Code
// @route   POST /api/student/mark-attendance
const markAttendance = async (req, res, next) => {
    try {
        const { code } = req.body;
        const studentId = req.user._id;

        // 1. Find the class that currently has this active code
        const classData = await Class.findOne({ activeSessionCode: code });

        if (!classData) {
            res.status(404);
            throw new Error('Invalid or Expired Code');
        }

        // 2. Verify student is actually enrolled in this class
        if (!classData.students.includes(studentId)) {
            res.status(403);
            throw new Error('You are not enrolled in this class');
        }

        // 3. Find the specific active session document
        const session = await Session.findOne({ 
            classId: classData._id, 
            sessionCode: code, 
            isActive: true 
        });

        if (!session) {
            res.status(400);
            throw new Error('Session is no longer active');
        }

        // 4. Check if already marked
        if (session.presentStudents.includes(studentId)) {
            res.status(400);
            throw new Error('Attendance already marked for today');
        }

        // 5. Mark Present
        session.presentStudents.push(studentId);
        await session.save();

        // 6. Emit real-time updates to teacher and class room
        const attendanceUpdate = {
            classId: classData._id,
            sessionId: session._id,
            studentId: studentId,
            studentName: req.user.name,
            rollNumber: req.user.rollNumber,
            timestamp: new Date(),
            presentCount: session.presentStudents.length
        };

        // Emit to teacher's room
        global.io.to(`teacher-${classData.teacher}`).emit('attendance-marked', attendanceUpdate);

        // Emit to class room (for any other listeners)
        global.io.to(`class-${classData._id}`).emit('attendance-update', attendanceUpdate);

        res.json({
            success: true,
            className: classData.className,
            subject: classData.subject
        });

    } catch (error) { next(error); }
};

// @desc    Get My Stats
// @route   GET /api/student/my-percentage
const getStudentStats = async (req, res, next) => {
    try {
        const studentId = req.user._id;

        // Find all classes where student is enrolled
        const classes = await Class.find({ students: studentId });

        const stats = await Promise.all(classes.map(async (cls) => {
            const totalSessions = await Session.countDocuments({ classId: cls._id });
            const attendedSessions = await Session.countDocuments({ 
                classId: cls._id, 
                presentStudents: studentId 
            });

            const percentage = totalSessions === 0 ?   0 : Math.round((attendedSessions / totalSessions) * 100);

            return {
                classId: cls._id,
                className: cls.className,
                subject: cls.subject,
                totalSessions,
                attendedSessions,
                percentage,
                status: percentage >= 75 ? 'Good' : 'Low'
            };
        }));

        res.json({ classes: stats });
    } catch (error) { next(error); }
};

module.exports = { markAttendance, getStudentStats };