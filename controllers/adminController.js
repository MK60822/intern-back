const User = require('../models/User');
const Class = require('../models/Class');

// @desc    Get all users by role
// @route   GET /api/admin/:role (teachers/students)
const getUsersByRole = async (req, res, next) => {
    try {
        const role = req.params.role === 'teachers' ? 'teacher' : 'student';
        const users = await User.find({ role }).select('-password');
        res.json(users);
    } catch (error) { next(error); }
};

// @desc    Create a new Class
// @route   POST /api/admin/classes
const createClass = async (req, res, next) => {
    try {
        const { className, subject, teacherId } = req.body;

        const newClass = await Class.create({
            className,
            subject,
            teacher: teacherId
        });

        // Populate teacher details for immediate UI update
        const fullClass = await Class.findById(newClass._id).populate('teacher', 'name email');
        res.status(201).json(fullClass);
    } catch (error) { next(error); }
};

// @desc    Add Student to Class
// @route   PUT /api/admin/classes/:id/student
const manageClassStudent = async (req, res, next) => {
    try {
        const { studentId, action } = req.body; // action: 'add' or 'remove'
        const classId = req.params.id;

        let updatedClass;
        if (action === 'add') {
            updatedClass = await Class.findByIdAndUpdate(
                classId,
                { $addToSet: { students: studentId } }, // $addToSet prevents duplicates
                { new: true }
            ).populate('students', 'name email rollNumber').populate('teacher', 'name');
        } else {
            updatedClass = await Class.findByIdAndUpdate(
                classId,
                { $pull: { students: studentId } },
                { new: true }
            ).populate('students', 'name email rollNumber').populate('teacher', 'name');
        }
        res.json(updatedClass);
    } catch (error) { next(error); }
};

// @desc    Bulk Add Students to Class
// @route   PUT /api/admin/classes/:id/bulk-enroll
const bulkEnrollStudents = async (req, res, next) => {
    try {
        const { studentIds } = req.body; // Expecting an ARRAY of IDs
        const classId = req.params.id;

        if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
            res.status(400);
            throw new Error('Please select at least one student.');
        }

        // $addToSet + $each ensures no duplicates are added
        const updatedClass = await Class.findByIdAndUpdate(
            classId,
            { $addToSet: { students: { $each: studentIds } } },
            { new: true }
        )
        .populate('students', 'name email rollNumber')
        .populate('teacher', 'name');

        res.json(updatedClass);
    } catch (error) { next(error); }
};

// @desc    Change student's class assignment
// @route   PUT /api/admin/students/:studentId/change-class
const changeStudentClass     = async (req, res, next) => {
    try {
        const { studentId } = req.params;
        const { newClassId, removeFromCurrent } = req.body;

        // Validate student exists
        const student = await User.findById(studentId);
        if (!student || student.role !== 'student') {
            return res.status(404).json({ message: 'Student not found' });
        }

        // Validate new class exists
        const newClass = await Class.findById(newClassId);
        if (!newClass) {
            return res.status(404).json({ message: 'New class not found' });
        }

        // Remove student from current classes if requested
        if (removeFromCurrent) {
            await Class.updateMany(
                { students: studentId },
                { $pull: { students: studentId } }
            );
        }

        // Add student to new class
        const updatedClass = await Class.findByIdAndUpdate(
            newClassId,
            { $addToSet: { students: studentId } },
            { new: true }
        ).populate('students', 'name email rollNumber').populate('teacher', 'name');

        res.json({
            message: 'Student class changed successfully',
            student: {
                _id: student._id,
                name: student.name,
                email: student.email,
                rollNumber: student.rollNumber
            },
            newClass: {
                _id: updatedClass._id,
                className: updatedClass.className,
                subject: updatedClass.subject
            }
        });
    } catch (error) { next(error); }
};

// @desc    Create a new student account
// @route   POST /api/admin/students
const createStudent = async (req, res, next) => {
    try {
        const { name, email, rollNumber, password, classId } = req.body;

        // Check if email already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already exists' });
        }

        // Create new student
        const newStudent = await User.create({
            name,
            email,
            rollNumber,
            password,
            role: 'student'
        });

        // If classId provided, add student to class
        if (classId) {
            await Class.findByIdAndUpdate(
                classId,
                { $addToSet: { students: newStudent._id } },
                { new: true }
            );
        }

        res.status(201).json({
            _id: newStudent._id,
            name: newStudent.name,
            email: newStudent.email,
            rollNumber: newStudent.rollNumber,
            role: newStudent.role
        });
    } catch (error) { next(error); }
};

// @desc    Create a new teacher account
// @route   POST /api/admin/teachers
const createTeacher = async (req, res, next) => {
    try {
        const { name, email, password, classId } = req.body;

        // Check if email already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already exists' });
        }

        // Create new teacher
        const newTeacher = await User.create({
            name,
            email,
            password,
            role: 'teacher'
        });

        // If classId provided, assign teacher to class
        if (classId) {
            await Class.findByIdAndUpdate(
                classId,
                { teacher: newTeacher._id },
                { new: true }
            );
        }

        res.status(201).json({
            _id: newTeacher._id,
            name: newTeacher.name,
            email: newTeacher.email,
            role: newTeacher.role
        });
    } catch (error) { next(error); }
};

// @desc    Assign teacher to class
// @route   PUT /api/admin/classes/:id/assign-teacher
const assignTeacherToClass = async (req, res, next) => {
    try {
        const { teacherId } = req.body;
        const classId = req.params.id;

        // Validate teacher exists and is a teacher
        const teacher = await User.findById(teacherId);
        if (!teacher || teacher.role !== 'teacher') {
            return res.status(404).json({ message: 'Teacher not found' });
        }

        const updatedClass = await Class.findByIdAndUpdate(
            classId,
            { teacher: teacherId },
            { new: true }
        ).populate('teacher', 'name email').populate('students', 'name email rollNumber');

        res.json(updatedClass);
    } catch (error) { next(error); }
};

// @desc    Get class report for admin
// @route   GET /api/admin/classes/:classId/report
const getClassReport = async (req, res, next) => {
    try {
        const { classId } = req.params;
        const Session = require('../models/Session');

        const classData = await Class.findById(classId).populate('students', 'name email rollNumber').populate('teacher', 'name email');
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
                    totalSessions: totalSessions,
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
    } catch (error) { next(error); }
};


