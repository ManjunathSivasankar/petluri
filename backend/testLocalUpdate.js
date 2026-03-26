const mongoose = require('mongoose');
const Course = require('./models/Course');
const Enrollment = require('./models/Enrollment');
const Certificate = require('./models/Certificate');
const { issueCertificate } = require('./services/certificateService');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function testUpdate() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        
        const course = await Course.findOne({ title: /Cyber Security/i });
        if (!course) { console.log("Course not found."); return; }
        
        const enrollments = await Enrollment.find({ courseId: course._id, status: 'completed' });
        if (enrollments.length === 0) { console.log("No enrollments."); return; }

        // Use absolute path for test to avoid relative __dirname resolution issues
        const validTemplate = path.join(__dirname, 'public/uploads/templates/template-1773732337513-957501903.pdf');
        
        if (!fs.existsSync(validTemplate)) {
            console.log("Template not found on disk:", validTemplate);
            return;
        }

        course.certificateTemplate = validTemplate;
        await course.save();
        
        console.log(`Simulating template change to ${validTemplate}...`);
        
        for (const enrollment of enrollments) {
            try {
                const newCert = await issueCertificate(enrollment.userId, enrollment.courseId);
                console.log(`Successfully regenerated certificate for user ${enrollment.userId}`);
                console.log(`Generated PDF URL: ${newCert.pdfUrl}`);
            } catch (err) {
                console.error(`Failed to regenerate certificate for user ${enrollment.userId}:`, err.message);
            }
        }
        
    } catch (err) {
        console.error('Test FAILED:', err.message);
    } finally {
        process.exit(0);
    }
}

testUpdate();
