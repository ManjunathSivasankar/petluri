/**
 * FULL DATABASE WIPE SCRIPT
 * Clears: Courses, Enrollments, Users (students only), Payments,
 *         Certificates, InternshipOffers, InternshipCertificates,
 *         Quizzes, OTPs
 * Also deletes all generated PDFs and uploaded templates from disk.
 */
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const Course                = require('./models/Course');
const Enrollment            = require('./models/Enrollment');
const User                  = require('./models/User');
const Payment               = require('./models/Payment');
const Certificate           = require('./models/Certificate');
const InternshipOffer       = require('./models/InternshipOffer');
const InternshipCertificate = require('./models/InternshipCertificate');
const Quiz                  = require('./models/Quiz');
const Otp                   = require('./models/Otp');

async function fullWipe() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        // --- Database ---
        const results = await Promise.all([
            Course.deleteMany({}),
            Enrollment.deleteMany({}),
            User.deleteMany({ role: 'student' }),   // keep admin accounts
            Payment.deleteMany({}),
            Certificate.deleteMany({}),
            InternshipOffer.deleteMany({}),
            InternshipCertificate.deleteMany({}),
            Quiz.deleteMany({}),
            Otp.deleteMany({}),
        ]);

        const labels = [
            'Courses',
            'Enrollments',
            'Students',
            'Payments',
            'Certificates',
            'InternshipOffers',
            'InternshipCertificates',
            'Quizzes',
            'OTPs'
        ];
        results.forEach((r, i) => console.log(`🗑  ${labels[i]}: ${r.deletedCount} deleted`));

        // --- Disk: generated PDFs and uploaded templates ---
        const dirs = [
            path.join(__dirname, 'public/certificates'),
            path.join(__dirname, 'public/internships/offers'),
            path.join(__dirname, 'public/internships/certificates'),
            path.join(__dirname, 'public/uploads/templates'),
            path.join(__dirname, 'public/uploads/images'),
            path.join(__dirname, 'public/uploads'),
        ];

        console.log('');
        let totalFilesRemoved = 0;
        
        function deleteFilesRecursively(dir) {
            if (!fs.existsSync(dir)) return;
            const items = fs.readdirSync(dir);
            for (const item of items) {
                const fullPath = path.join(dir, item);
                if (fs.statSync(fullPath).isDirectory()) {
                    deleteFilesRecursively(fullPath);
                } else {
                    fs.unlinkSync(fullPath);
                    totalFilesRemoved++;
                }
            }
        }

        for (const dir of dirs) {
            if (!fs.existsSync(dir)) { console.log(`⚠  Skipped (not found): ${dir}`); continue; }
            let beforeCount = totalFilesRemoved;
            deleteFilesRecursively(dir);
            console.log(`🗑  ${totalFilesRemoved - beforeCount} file(s) removed from: ${dir}`);
        }

        console.log(`\n✅ Done. Database cleared and ${totalFilesRemoved} total file(s) removed from disk.`);
        console.log('   Admin accounts are preserved. You can now start with a clean Slate.');
    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

fullWipe();
