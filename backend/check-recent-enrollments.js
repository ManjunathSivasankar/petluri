const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Enrollment = require('./models/Enrollment');
const User = require('./models/User');
const Course = require('./models/Course');

dotenv.config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/petluri_lms')
    .then(async () => {
        // Find recent enrollments (within last 30 mins)
        const halfHourAgo = new Date(Date.now() - 30 * 60 * 1000);
        const recentEnrollments = await Enrollment.find({
            createdAt: { $gte: halfHourAgo }
        }).populate('userId').populate('courseId');
        
        console.log(`Found ${recentEnrollments.length} enrollments in the last 30 minutes.`);
        recentEnrollments.forEach(e => {
            console.log(`- Student: ${e.userId?.name} | Course: ${e.courseId?.title} | Created: ${e.createdAt}`);
        });
        process.exit();
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
