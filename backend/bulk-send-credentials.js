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

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/petluri_lms')
    .then(async () => {
        const enrollments = await Enrollment.find({}).populate('userId').populate('courseId');
        
        console.log(`Processing ${enrollments.length} enrollments...`);

        for (const enrollment of enrollments) {
            const user = enrollment.userId;
            const course = enrollment.courseId;

            if (!user || !course) {
                console.log("  Missing user or course for enrollment:", enrollment._id);
                continue;
            }

            console.log(`- Student: ${user.name} (${user.email}) | Course: ${course.title}`);

            let password = user.tempPassword;
            
            // If no tempPassword exists, generate one using the new pattern
            if (!password) {
                const firstName = user.name.split(' ')[0];
                const last4Phone = user.phone.slice(-4) || '0000';
                password = `${firstName}@${last4Phone}`;
                
                // Update user in DB
                user.password = password; // pre-save hook will hash it
                user.tempPassword = password;
                await user.save();
                console.log(`  Generated new password: ${password}`);
            }

            // Send Email
            if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
                const mailOptions = {
                    from: `"Petluri Edutech" <${process.env.EMAIL_USER}>`,
                    to: user.email,
                    subject: 'Your Petluri Edutech Course Credentials',
                    html: `
                        <h2>Hello ${user.name},</h2>
                        <p>Thank you for enrolling in <strong>${course.title}</strong>.</p>
                        <p>You can now log in to our learning portal using the following credentials:</p>
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
            } else {
                console.warn("  Email credentials missing in .env, skipping email.");
            }
        }

        console.log("Bulk processing complete.");
        process.exit();
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
