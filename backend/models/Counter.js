const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
    _id: { 
        type: String, 
        required: true 
    }, // e.g., "student_2026", "program_I", "program_C", "program_F", "program_P"
    seq: { 
        type: Number, 
        default: 0 
    },
    year: { 
        type: String 
    }, // last 2 digits for students (e.g. "26")
    type: { 
        type: String, 
        required: true,
        enum: ['student', 'program', 'certificate', 'enrollment']
    }
}, { timestamps: true });

module.exports = mongoose.model('Counter', counterSchema);
