require('dotenv').config();
const mongoose = require('mongoose');

const Enrollment = require('./models/Enrollment');
const Course = require('./models/Course');
const { issueInternshipOffer } = require('./services/internshipDocumentService');

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const enrollments = await Enrollment.find({}).select('userId courseId status').lean();
    console.log(`Found ${enrollments.length} total enrollment(s)`);

    let checked = 0;
    let internshipEnrollments = 0;
    let regenerated = 0;
    let skipped = 0;
    let failed = 0;

    for (const enrollment of enrollments) {
      checked++;
      try {
        const course = await Course.findById(enrollment.courseId).select('type title internshipOfferTemplate').lean();
        if (!course || course.type !== 'internship') {
          skipped++;
          continue;
        }

        internshipEnrollments++;

        const result = await issueInternshipOffer(
          enrollment.userId,
          enrollment.courseId,
          null,
          { sendEmail: false }
        );

        if (result && result.pdfUrl) {
          regenerated++;
          console.log(`[OK] Regenerated offer for enrollment ${enrollment._id} -> ${result.pdfUrl}`);
        } else {
          skipped++;
          console.log(`[SKIP] Enrollment ${enrollment._id} has no internship template or not eligible`);
        }
      } catch (err) {
        failed++;
        console.error(`[FAIL] Enrollment ${enrollment._id}: ${err.message}`);
      }
    }

    console.log('\nDone');
    console.log(`Checked: ${checked}`);
    console.log(`Internship enrollments: ${internshipEnrollments}`);
    console.log(`Regenerated: ${regenerated}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Failed: ${failed}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Fatal:', error.message);
    try { await mongoose.disconnect(); } catch {}
    process.exit(1);
  }
}

run();
