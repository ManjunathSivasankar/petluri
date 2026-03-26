const mongoose = require('mongoose');

const internshipCertificateSchema = new mongoose.Schema({
    certificateId: {
        type: String,
        required: true,
        unique: true // e.g., "INT-CERT-12345"
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
    issuedDate: {
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

module.exports = mongoose.model('InternshipCertificate', internshipCertificateSchema);
