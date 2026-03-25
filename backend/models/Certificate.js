const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema({
    certificateId: {
        type: String,
        required: true,
        unique: true // e.g., "CERT-12345"
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true
    },
    generatedDate: {
        type: Date,
        default: Date.now
    },
    pdfUrl: {
        type: String,
        required: true
    },
    studentName: String,
    courseTitle: String,
    verificationUrl: String
});

module.exports = mongoose.model('Certificate', certificateSchema);
