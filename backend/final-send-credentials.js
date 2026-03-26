const mongoose = require('mongoose');
const dotenv = require('dotenv');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Enrollment = require('./models/Enrollment');
const Course = require('./models/Course');

dotenv.config();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const sendEnrollmentEmail = async (user, course, password) => {
    const mailOptions = {
        from: `"Petluri Edutech" <${process.env.EMAIL_USER}>`,
        to: user.email,
        subject: 'Welcome to Petluri Edutech - Course Enrollment Successful!',
        html: `
            <h2>Welcome ${user.name}!</h2>
            <p>Thank you for enrolling in <strong>${course.title}</strong>.</p>
            <p>You can use the following credentials to access our learning portal:</p>
            <ul>
                <li><strong>Email:</strong> ${user.email}</li>
                <li><strong>Password:</strong> ${password}</li>
            </ul>
            <p>Log in here: <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/login">Learning Portal</a></p>
            <p>Regards,<br>Petluri Edutech Team</p>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`  Email sent to ${user.email}`);
    } catch (err) {
        console.error(`  Failed to send email to ${user.email}:`, err.message);
    }
};

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/petluri_lms')
    .then(async () => {
        const enrollments = await Enrollment.find({}).populate('userId', '+tempPassword').populate('courseId');
        
        console.log(`Processing ${enrollments.length} enrollments...`);

        for (const enrollment of enrollments) {
            const user = enrollment.userId;
            const course = enrollment.courseId;

            if (!user || !course) continue;

            console.log(`- Student: ${user.name} (${user.email}) | Course: ${course.title}`);

            const password = user.tempPassword || "Existing User Password";
            
            await sendEnrollmentEmail(user, course, password);
        }

        console.log("Bulk processing complete.");
        process.exit();
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
