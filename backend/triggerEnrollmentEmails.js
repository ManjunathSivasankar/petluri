/**
 * Trigger enrollment emails for all existing enrolled students.
 * - Certification / free courses  → credentials email only
 * - Internship courses            → credentials + offer letter PDF attached
 */
require('dotenv').config();
const mongoose = require('mongoose');

const User       = require('./models/User');
const Course     = require('./models/Course');
const Enrollment = require('./models/Enrollment');
const sendEmail  = require('./services/emailService');
const { issueInternshipOffer } = require('./services/internshipDocumentService');

async function triggerEnrollmentEmails() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const enrollments = await Enrollment.find({}).lean();
    console.log(`Found ${enrollments.length} enrollment(s)\n`);

    if (enrollments.length === 0) {
        console.log('No enrollments found. Nothing to do.');
        await mongoose.disconnect();
        process.exit(0);
    }

    let sent = 0, failed = 0;

    for (const enrol of enrollments) {
        try {
            const student = await User.findById(enrol.userId).select('+tempPassword');
            const course  = await Course.findById(enrol.courseId);

            if (!student || !course) {
                console.warn(`  ⚠  Skipping enrollment ${enrol._id} – student or course not found`);
                continue;
            }

            const password    = student.tempPassword || '(use your portal password)';
            const isInternship = course.type === 'internship';
            const loginUrl    = `${process.env.CLIENT_URL || 'http://localhost:5173'}/login`;

            const html = `
              <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;padding:24px;border:1px solid #e0e0e0;border-radius:10px;">
                <h2 style="color:#007bff;text-align:center;">Welcome, ${student.name}! 🎉</h2>
                <p>You have successfully enrolled in <strong>${course.title}</strong>.</p>
                <h3>Your Login Credentials</h3>
                <table style="border-collapse:collapse;width:100%;background:#f8f8f8;border-radius:6px;">
                  <tr><td style="padding:6px 12px;color:#555;">Email</td><td style="padding:6px 12px;font-weight:bold;">${student.email}</td></tr>
                  <tr><td style="padding:6px 12px;color:#555;">Password</td><td style="padding:6px 12px;font-weight:bold;">${password}</td></tr>
                </table>
                <p style="margin-top:16px;">
                  <a href="${loginUrl}" style="background:#007bff;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Log In to Student Portal</a>
                </p>
                ${isInternship ? '<p>Your <strong>Internship Offer Letter</strong> is attached to this email as a PDF.</p>' : ''}
                <p style="font-size:11px;color:#aaa;margin-top:20px;text-align:center;">Petluri Edutech LMS</p>
              </div>`;

            const emailOptions = {
                email:   student.email,
                subject: isInternship
                    ? `🎉 Internship Offer – ${course.title} | Login Credentials`
                    : `✅ Enrollment Confirmed – ${course.title}`,
                html,
                message: `Welcome ${student.name}! Enrolled in ${course.title}. Email: ${student.email} | Password: ${password}`,
            };

            // Internship: attach offer letter PDF
            if (isInternship) {
                try {
                    const offerResult = await issueInternshipOffer(student._id, course._id, {
                        email: student.email, password, name: student.name
                    });
                    if (offerResult?.pdfBytes) {
                        emailOptions.attachments = [{
                            filename:    `Offer_Letter_${offerResult.offerId}.pdf`,
                            content:     offerResult.pdfBytes,
                            contentType: 'application/pdf',
                        }];
                        emailOptions.html += `<p style="font-size:12px;color:#888;">Offer ID: ${offerResult.offerId}</p>`;
                    }
                } catch (offerErr) {
                    console.warn(`  ⚠  Offer letter generation failed for ${student.email}: ${offerErr.message}`);
                }
            }

            await sendEmail(emailOptions);
            console.log(`  ✅ Sent to ${student.email} (${course.title}) [internship=${isInternship}]`);
            sent++;
        } catch (err) {
            console.error(`  ❌ Failed for enrollment ${enrol._id}: ${err.message}`);
            failed++;
        }
    }

    console.log(`\n📧 Done. Sent: ${sent}, Failed: ${failed}`);
    await mongoose.disconnect();
    process.exit(0);
}

triggerEnrollmentEmails().catch(err => {
    console.error('Fatal:', err.message);
    process.exit(1);
});
