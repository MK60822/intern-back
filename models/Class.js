const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
    className: { type: String, required: true },
    subject: { type: String, required: true },
    teacher: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true,
        index: true 
    },
    students: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    }],
    // Store active session code here for quick validation
    activeSessionCode: { type: String, default: null } 
}, { timestamps: true });

module.exports = mongoose.model('Class', classSchema);