const Class = require('../models/Class');
const Session = require('../models/Session');

const getMyClasses = (req, res) => {
    Class.find({ teacher: req.user._id })
        .populate('students', 'name rollNumber')
        .then(classes => res.json(classes))
        .catch(error => res.status(500).json({ message: 'Server error' }));
};

const generateSessionCode = async (req, res) => {
    const { classId } = req.body;

    if (!classId) {
        return res.status(400).json({ message: 'Class ID is required' });
    }

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
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        let existingSession = await Session.findOne({ sessionCode: code, isActive: true });

        // Ensure code is unique (regenerate if collision)
        while (existingSession) {
            code = '';
            for (let i = 0; i < 6; i++) {
                code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            existingSession = await Session.findOne({ sessionCode: code, isActive: true });
        }

        // Create new session
        const session = await Session.create({
            classId,
            sessionCode: code,
            isActive: true
        });

        // Update the class with the active session code
        await Class.findByIdAndUpdate(classId, { activeSessionCode: code });

        res.json({
            code,
            className: classDoc.className,
            subject: classDoc.subject,
            sessionId: session._id
        });

    } catch (error) {
        console.error('Error generating session code:', error);
        res.status(500).json({ message: 'Server error while generating session code' });
    }
};

const endSession = (req, res) => {
    const { classId } = req.body;
    
    if (!classId) {
        return res.status(400).json({ message: 'Class ID is required' });
    }

    // Find and deactivate the active session
    Session.findOneAndUpdate(
        { classId, isActive: true },
        { isActive: false },
        { new: true }
    )
    .then(session => {
        if (!session) {
            return res.status(404).json({ message: 'No active session found for this class' });
        }

        // Clear the active session code from the class
        return Class.findByIdAndUpdate(classId, { activeSessionCode: null })
            .then(() => {
                res.json({ 
                    message: 'Session ended successfully',
                    sessionId: session._id,
                    presentCount: session.presentStudents.length
                });
            });
    })
    .catch(error => {
        console.error('Error:', error);
        res.status(500).json({ message: 'Server error' });
    });
};
    
const getClassReport = (req, res) => {
    const classId = req.params.id;
    
    Promise.all([
        Session.countDocuments({ classId }),
        Class.findById(classId).populate('students', 'name email rollNumber')
    ])
    .then(([totalSessions, classData]) => {
        const promises = classData.students.map(student => {
            return Session.countDocuments({ 
                classId, 
                presentStudents: student._id 
            }).then(attended => ({
                _id: student._id,
                name: student.name,
                rollNumber: student.rollNumber,
                email: student.email,
                attendedSessions: attended,
                totalSessions: totalSessions,
                percentage: totalSessions === 0 ? 0 : Math.round((attended / totalSessions) * 100)
            }));
        });

        return Promise.all(promises).then(studentStats => {
            res.json({
                className: classData.className,
                subject: classData.subject,
                totalSessions,
                students: studentStats
            });
        });
    })
    .catch(error => res.status(500).json({ message: 'Server error' }));
};

const getAnalytics = (req, res) => {
    const teacherId = req.user._id;
    console.log('Analytics request for teacher:', teacherId);
    
    Promise.all([
        Class.find({ teacher: teacherId }),
        Session.find().populate('classId')
    ])
    .then(([classes, allSessions]) => {
        console.log('Classes found:', classes.length);
        console.log('All sessions:', allSessions.length);
        
        const teacherSessions = allSessions.filter(session => 
            session.classId && classes.some(cls => cls._id.toString() === session.classId._id.toString())
        );
        console.log('Teacher sessions:', teacherSessions.length);
        
        // Create sample data if no sessions exist
        const sessionData = teacherSessions.length > 0 
            ? teacherSessions.slice(-10).map(session => ({
                date: session.date,
                attendance: session.presentStudents.length,
                className: session.classId.className
            }))
            : [
                { date: new Date(), attendance: 15, className: 'Sample' },
                { date: new Date(Date.now() - 86400000), attendance: 18, className: 'Sample' },
                { date: new Date(Date.now() - 172800000), attendance: 12, className: 'Sample' }
            ];
        
        const totalStudents = classes.reduce((sum, cls) => sum + cls.students.length, 0);
        const totalAttendance = teacherSessions.reduce((sum, s) => sum + s.presentStudents.length, 0);
        const avgAttendance = teacherSessions.length > 0 ? Math.round((totalAttendance / (teacherSessions.length * totalStudents)) * 100) : 75;
        
        const recentSessions = teacherSessions.length > 0
            ? teacherSessions.slice(-5).map(session => {
                const classData = classes.find(cls => cls._id.toString() === session.classId._id.toString());
                const rate = classData ? Math.round((session.presentStudents.length / classData.students.length) * 100) : 0;
                
                return {
                    date: session.date,
                    className: session.classId.className,
                    subject: session.classId.subject,
                    attendance: session.presentStudents.length,
                    totalStudents: classData ? classData.students.length : 0,
                    rate
                };
            })
            : [];
        
        const result = {
            totalSessions: teacherSessions.length,
            totalStudents,
            avgAttendance,
            activeClasses: classes.length,
            sessionData,
            recentSessions
        };
        
        console.log('Analytics result:', result);
        res.json(result);
    })
    .catch(error => {
        console.error('Analytics error:', error);
        res.status(500).json({ message: 'Server error' });
    });
};

module.exports = { getMyClasses, generateSessionCode, endSession, getClassReport, getAnalytics };