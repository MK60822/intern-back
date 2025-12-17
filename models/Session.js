const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
    classId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Class', 
        required: true,
        index: true 
    },
    date: { type: Date, default: Date.now },
    month: { type: Number }, // For optimized monthly reports
    year: { type: Number },
    
    // The specific 6-digit code used for this session
    sessionCode: { type: String, required: true },
    isActive: { type: Boolean, default: true },

    // Who actually attended?
    presentStudents: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    }]
}, { timestamps: true });

// Auto-fill month/year before saving for easier analytics
sessionSchema.pre('save', function() {
    const d = new Date(this.date);
    this.month = d.getMonth() + 1;
    this.year = d.getFullYear();
});

module.exports = mongoose.model('Session', sessionSchema);