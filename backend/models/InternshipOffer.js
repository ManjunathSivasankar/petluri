const mongoose = require('mongoose');

const internshipOfferSchema = new mongoose.Schema({
    offerId: {
        type: String,
        required: true,
        unique: true // e.g., "OFFER-12345"
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
    courseTitle: String
});

module.exports = mongoose.model('InternshipOffer', internshipOfferSchema);
