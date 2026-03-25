const mongoose = require('mongoose');
const Enrollment = require('./models/Enrollment');
const { issueCertificate } = require('./services/certificateService');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

const recoverCertificates = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const completedEnrollments = await Enrollment.find({ status: 'completed' });
        console.log(`Found ${completedEnrollments.length} completed enrollments.`);

        for (const enrollment of completedEnrollments) {
            const certPath = path.join(__dirname, 'public/certificates');
            if (!fs.existsSync(certPath)) {
                fs.mkdirSync(certPath, { recursive: true });
            }

            // We want to force re-generation if the file is missing
            // But issueCertificate checks the DB first.
            // So we'll check if the file exists on disk.
            
            // To properly re-issue, we might need to delete the old DB record 
            // if we want issueCertificate to run its full logic, 
            // OR we modify issueCertificate to have a 'force' flag.
            
            console.log(`Checking certificate for User: ${enrollment.userId}, Course: ${enrollment.courseId}`);
            try {
                const cert = await issueCertificate(enrollment.userId, enrollment.courseId);
                console.log(`Certificate for ${enrollment.userId} ensured: ${cert.certificateId}`);
                
                // Ensure the flag is updated in Enrollment 
                if (!enrollment.certificateIssued) {
                    enrollment.certificateIssued = true;
                    await enrollment.save();
                    console.log(`Updated certIssued flag for enrollment ${enrollment._id}`);
                }
            } catch (err) {
                console.error(`Failed for ${enrollment.userId}:`, err.message);
            }
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

recoverCertificates();
