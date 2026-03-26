const mongoose = require('mongoose');
const User = require('./models/User');
const Course = require('./models/Course');
const Enrollment = require('./models/Enrollment');
const Certificate = require('./models/Certificate');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// We'll simulate the adminController logic manually to ensure backend connects and models work
// Then we'll actually use an axios request or similar to hit the endpoint for a true test

// actually let's just use axios to hit the endpoint locally
const axios = require('axios');

async function testUpdate() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        
        // 1. Get an existing course
        const courses = await Course.find();
        if (courses.length === 0) {
            console.log("No courses found to test with.");
            return;
        }
        
        const course = courses[0];
        console.log("Testing with Course:", course.title, course._id);
        
        // 2. See if there's a completed enrollment
        const enrollments = await Enrollment.find({ courseId: course._id, status: 'completed' });
        console.log(`Found ${enrollments.length} completed enrollments for this course.`);
        
        if (enrollments.length === 0) {
            console.log("Please ensure there is at least one completed enrollment for this course to fully test the logic.");
        }
        
        // 3. We will simulate updating the template.
        // For a true test, we need to log in as admin and hit the PUT endpoint.
        // It's easier to just call the API directly if we have a token, or we can use a custom script that bypasses auth for this specific test.
        // Let's create a temporary test route in adminRoutes if needed, or simply log in.
        
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@petluriedutech.com';
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
        
        let token;
        try {
            const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
                email: adminEmail,
                password: adminPassword
            });
            token = loginRes.data.token;
            console.log("Logged in as admin.");
        } catch (err) {
            console.error("Login failed:", err.response?.data || err.message);
            process.exit(1);
        }
        
        // 4. Update the course with a "dummy" template change, then change it back immediately.
        // Actually, let's just change it once because the logic should trigger.
        const originalTemplate = course.certificateTemplate;
        const newTemplate = '/uploads/templates/dummy-test-template.pdf'; // Doesn't have to exist if generating fails gracefully, but we want it to succeed. Let's use the real one and just toggle it slightly or use a different string that resolves.
        // If we use a dummy one, 'issueCertificate' will fail to find the file and throw, which is fine, we just want to see the error logged from our new logic.
        
        console.log(`Original Template: ${originalTemplate}`);
        console.log(`Sending PUT request to update template to: ${newTemplate}`);
        
        const putRes = await axios.put(`http://localhost:5000/api/admin/courses/${course._id}`, {
            certificateTemplate: newTemplate,
             // include required fields just in case, though PUT typically handles partials if coded that way. Our controller does `...req.body` so it's technically a PATCH.
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        console.log("Update response status:", putRes.status);
        if (putRes.data.certificateTemplate === newTemplate) {
            console.log("Template updated successfully in DB via API.");
        }
        
        // 5. Change it back so we don't break the system
        setTimeout(async () => {
             console.log("Reverting template...");
             await axios.put(`http://localhost:5000/api/admin/courses/${course._id}`, {
                certificateTemplate: originalTemplate,
             }, {
                headers: { Authorization: `Bearer ${token}` }
             });
             console.log("Reverted successfully.");
             process.exit(0);
        }, 3000); // give the async regeneration loop 3 seconds to trigger

    } catch (err) {
        console.error('Test FAILED:', err.message);
        if (err.response) {
            console.error(err.response.data);
        }
    }
}

testUpdate();
