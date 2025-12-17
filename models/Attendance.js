const mongoose = require('mongoose');

const attendanceSchema = mongoose.Schema(
    {
        studentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        classId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Class',
            required: true
        },
        date: {
            type: Date,
            default: Date.now
        },
        status: {
            type: String,
            enum: ['Present', 'Absent'],
            default: 'Present'
        }
    },
    {
        timestamps: true
    }
);

// Compound index to prevent duplicate attendance on same day
attendanceSchema.index({ studentId: 1, classId: 1, date: 1 }, { unique: true });

// Index for faster queries
attendanceSchema.index({ studentId: 1, classId: 1 });
attendanceSchema.index({ classId: 1, date: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);

