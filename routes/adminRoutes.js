const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const User = require('../models/User');
const Class = require('../models/Class');

router.use(protect);
router.use(authorize('admin'));

// Get teachers
router.get('/teachers', async (req, res) => {
    try {
        const teachers = await User.find({ role: 'teacher' }).select('-password');
        res.json(teachers);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Get students  
router.get('/students', async (req, res) => {
    try {
        const students = await User.find({ role: 'student' }).select('-password');
        res.json(students);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Create class
router.post('/classes', async (req, res) => {
    try {
        const { className, subject, teacherId } = req.body;
        console.log('Creating class:', { className, subject, teacherId });
        
        const newClass = await Class.create({
            className,
            subject,
            teacher: teacherId || null,
            students: []
        });
        
        console.log('Class created in DB:', newClass);
        res.status(201).json(newClass);
    } catch (error) {
        console.error('Class creation error:', error);
        res.status(500).json({ message: error.message });
    }
});

// Create student
router.post('/students', async (req, res) => {
    try {
        const { name, email, rollNumber, password, classId } = req.body;
        console.log('Creating student:', { name, email, rollNumber });
        
        const student = await User.create({
            name,
            email,
            rollNumber,
            password,
            role: 'student'
        });
        
        console.log('Student created in DB:', student._id);
        
        if (classId) {
            const updatedClass = await Class.findByIdAndUpdate(classId, {
                $addToSet: { students: student._id }
            }, { new: true });
            console.log('Student added to class:', updatedClass.className);
        }
        
        res.status(201).json(student);
    } catch (error) {
        console.error('Student creation error:', error);
        res.status(500).json({ message: error.message });
    }
});

// Create teacher
router.post('/teachers', async (req, res) => {
    try {
        const { name, email, password, classId } = req.body;
        console.log('Creating teacher:', { name, email });
        
        const teacher = await User.create({
            name,
            email,
            password,
            role: 'teacher',
            department: 'General'
        });
        
        console.log('Teacher created in DB:', teacher._id);
        
        if (classId) {
            const updatedClass = await Class.findByIdAndUpdate(classId, {
                teacher: teacher._id
            }, { new: true });
            console.log('Teacher assigned to class:', updatedClass.className);
        }
        
        res.status(201).json(teacher);
    } catch (error) {
        console.error('Teacher creation error:', error);
        res.status(500).json({ message: error.message });
    }
});

// Change student class
router.put('/students/:studentId/change-class', async (req, res) => {
    try {
        const { studentId } = req.params;
        const { newClassId, removeFromCurrent } = req.body;
        
        console.log('Changing student class:', { studentId, newClassId, removeFromCurrent });
        
        if (removeFromCurrent) {
            const removedFrom = await Class.updateMany(
                { students: studentId },
                { $pull: { students: studentId } }
            );
            console.log('Removed from classes:', removedFrom.modifiedCount);
        }
        
        const updatedClass = await Class.findByIdAndUpdate(newClassId, {
            $addToSet: { students: studentId }
        }, { new: true });
        
        console.log('Added to class:', updatedClass.className);
        res.json({ message: 'Student class changed successfully' });
    } catch (error) {
        console.error('Class change error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Assign teacher to class
router.put('/classes/:classId/assign-teacher', async (req, res) => {
    try {
        const { classId } = req.params;
        const { teacherId } = req.body;
        
        await Class.findByIdAndUpdate(classId, {
            teacher: teacherId
        });
        
        res.json({ message: 'Teacher assigned successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Get class analytics
router.get('/classes/:classId/report', async (req, res) => {
    try {
        const { classId } = req.params;
        const Session = require('../models/Session');
        
        const classData = await Class.findById(classId)
            .populate('students', 'name email rollNumber')
            .populate('teacher', 'name email');
            
        if (!classData) {
            return res.status(404).json({ message: 'Class not found' });
        }
        
        const totalSessions = await Session.countDocuments({ classId });
        
        const studentStats = await Promise.all(
            classData.students.map(async (student) => {
                const attended = await Session.countDocuments({
                    classId,
                    presentStudents: student._id
                });
                
                return {
                    _id: student._id,
                    name: student.name,
                    rollNumber: student.rollNumber,
                    email: student.email,
                    attendedSessions: attended,
                    totalSessions,
                    percentage: totalSessions === 0 ? 0 : Math.round((attended / totalSessions) * 100)
                };
            })
        );
        
        res.json({
            className: classData.className,
            subject: classData.subject,
            teacher: classData.teacher,
            totalSessions,
            students: studentStats
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;