const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Enrollment = require('./models/Enrollment');
const User = require('./models/User');
const Course = require('./models/Course');

dotenv.config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/petluri_lms')
    .then(async () => {
        const lastEnrollments = await Enrollment.find({}).sort({ createdAt: -1 }).limit(5).populate('userId').populate('courseId');
        
        console.log(`Last 5 Enrollments:`);
        lastEnrollments.forEach(e => {
            console.log(`- Student: ${e.userId?.name} | Course: ${e.courseId?.title} | Created: ${e.createdAt}`);
        });
        process.exit();
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
