/**
 * Live test: generate an internship offer letter for the first enrolled student.
 */
require('dotenv').config();
const mongoose   = require('mongoose');
const Enrollment = require('./models/Enrollment');
const User       = require('./models/User');
const Course     = require('./models/Course');
const { issueInternshipOffer } = require('./services/internshipDocumentService');

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    const enrol   = await Enrollment.findOne({});
    if (!enrol) { console.log('No enrollments found'); process.exit(0); }
    const student = await User.findById(enrol.userId).select('+tempPassword');
    const course  = await Course.findById(enrol.courseId);
    console.log(`Testing offer for: ${student?.name} → ${course?.title} (type: ${course?.type})`);
    const result = await issueInternshipOffer(enrol.userId, enrol.courseId, {
        email: student?.email, password: student?.tempPassword, name: student?.name
    });
    console.log('Result:', result?.pdfUrl || 'null (not internship or no template)');
    await mongoose.disconnect();
    process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
