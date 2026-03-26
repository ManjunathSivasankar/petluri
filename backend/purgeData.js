const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const Enrollment = require('./models/Enrollment');
const Certificate = require('./models/Certificate');
const Course = require('./models/Course');
const Quiz = require('./models/Quiz');
const Payment = require('./models/Payment');
const User = require('./models/User');
const Otp = require('./models/Otp');

async function purgeAllData() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB for purging...');

        // 1. Clear Collections
        console.log('Purging collections...');
        const enrollCount = await Enrollment.deleteMany({});
        console.log(`- Deleted ${enrollCount.deletedCount} enrollments`);

        const certCount = await Certificate.deleteMany({});
        console.log(`- Deleted ${certCount.deletedCount} certificates`);

        const courseCount = await Course.deleteMany({});
        console.log(`- Deleted ${courseCount.deletedCount} courses`);

        const quizCount = await Quiz.deleteMany({});
        console.log(`- Deleted ${quizCount.deletedCount} quizzes`);

        const payCount = await Payment.deleteMany({});
        console.log(`- Deleted ${payCount.deletedCount} payments`);

        const otpCount = await Otp.deleteMany({});
        console.log(`- Deleted ${otpCount.deletedCount} otps`);

        // 2. Delete Student Users (Keep Admins)
        const studentCount = await User.deleteMany({ role: 'student' });
        console.log(`- Deleted ${studentCount.deletedCount} student users`);

        const remainingAdmins = await User.countDocuments({ role: 'admin' });
        console.log(`- Preserved ${remainingAdmins} admin users`);

        // 3. Clear Physical Files
        const directories = [
            'public/uploads/images',
            'public/uploads/templates',
            'public/certificates'
        ];

        console.log('Cleaning physical files...');
        directories.forEach(dir => {
            const fullPath = path.join(__dirname, dir);
            if (fs.existsSync(fullPath)) {
                const files = fs.readdirSync(fullPath);
                files.forEach(file => {
                    const filePath = path.join(fullPath, file);
                    if (fs.lstatSync(filePath).isFile()) {
                        fs.unlinkSync(filePath);
                        console.log(`  - Deleted file: ${dir}/${file}`);
                    }
                });
            } else {
                console.log(`  - Directory NOT found: ${dir}`);
            }
        });

        console.log('\n✅ Portal is now FRESH!');
    } catch (err) {
        console.error('Purge Error:', err.message);
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
}

purgeAllData();
