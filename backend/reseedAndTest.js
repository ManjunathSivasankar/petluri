require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Course = require('./models/Course');
const Enrollment = require('./models/Enrollment');
const { issueInternshipOffer } = require('./services/internshipDocumentService');

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    
    // 1. Create/Find Admin User (to be creator)
    let admin = await User.findOne({ role: 'admin' });
    if (!admin) {
        console.log('No admin found, creating one...');
        admin = await User.create({
            name: 'Admin',
            email: 'admin@petluri.com',
            password: 'password123',
            role: 'admin'
        });
    }

    // 2. Create/update Internship Course with dates
    let course = await Course.findOne({ type: 'internship' });
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);

    if (course) {
        course.startDate = startDate;
        course.endDate = endDate;
        await course.save();
        console.log('Updated existing internship course dates.');
    } else {
        course = await Course.create({
            title: 'Full Stack Web Developer',
            description: 'Learn full stack development',
            type: 'internship',
            level: 'Beginner',
            duration: '1 Month',
            price: 4999,
            startDate: startDate,
            endDate: endDate,
            createdBy: admin._id,
            status: 'published',
            isPublished: true,
            internshipOfferTemplate: '/uploads/templates/internship-offer-template.pdf'
        });
        console.log('Created new internship course.');
    }

    // 3. Create dummy student
    const studentEmail = 'teststudent@example.com';
    await User.deleteOne({ email: studentEmail });
    const student = await User.create({
        name: 'MANJUNATH S',
        email: studentEmail,
        password: 'password123',
        collegeName: 'Adhiyamaan College of Engineering',
        collegeDetails: 'BE-CSE, 3rd Year'
    });
    console.log('Created test student.');

    // 4. Create enrollment
    const enrollment = await Enrollment.create({
        userId: student._id,
        courseId: course._id,
        status: 'enrolled'
    });
    console.log('Created enrollment.');

    // 5. Issue Offer Letter
    console.log('Generating Offer Letter...');
    const result = await issueInternshipOffer(student._id, course._id, { password: 'password123' });
    
    console.log('✅ Success!');
    console.log('PDF URL:', result.pdfUrl);
    console.log('Offer ID:', result.offerId);

    await mongoose.disconnect();
    process.exit(0);
}

run().catch(e => {
    console.error(e);
    process.exit(1);
});
