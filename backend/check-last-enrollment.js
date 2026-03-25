const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Enrollment = require('./models/Enrollment');
const User = require('./models/User');

dotenv.config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/petluri_lms')
    .then(async () => {
        const lastEnrollment = await Enrollment.findOne({}).sort({ createdAt: -1 }).populate('userId').populate('courseId');
        if (lastEnrollment) {
            console.log("Last Enrollment Found:");
            console.log("- Student:", lastEnrollment.userId?.name, `(${lastEnrollment.userId?.email})`);
            console.log("- Course:", lastEnrollment.courseId?.title);
            console.log("- Date:", lastEnrollment.createdAt);
            
            if (lastEnrollment.userId) {
                console.log("- User details in DB:", {
                    role: lastEnrollment.userId.role,
                    hasTempPassword: !!lastEnrollment.userId.tempPassword
                });
            }
        } else {
            console.log("No enrollments found.");
        }
        process.exit();
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
