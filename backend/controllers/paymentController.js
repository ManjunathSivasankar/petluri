const Razorpay = require('razorpay');
const crypto = require('crypto');
const User = require('../models/User');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const Payment = require('../models/Payment');
const sendEmail = require('../services/emailService');
const { issueInternshipOffer } = require('../services/internshipDocumentService');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'dummy_key',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_secret'
});

/**
 * Send enrollment confirmation email.
 * For internship courses — also generates the offer letter PDF and attaches it.
 */
const sendEnrollmentEmail = async (user, course, password) => {
    try {
        const loginUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/login`;
        const isInternship = course.type === 'internship';

        // --- Build email body ---
        const html = `
          <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;padding:24px;border:1px solid #e0e0e0;border-radius:10px;">
            <h2 style="color:#007bff;text-align:center;">Welcome, ${user.name}! 🎉</h2>
            <p>You have successfully enrolled in <strong>${course.title}</strong>.</p>
            <h3>Your Login Credentials</h3>
            <table style="border-collapse:collapse;width:100%;background:#f8f8f8;border-radius:6px;">
              <tr><td style="padding:6px 12px;color:#555;">Email</td><td style="padding:6px 12px;font-weight:bold;">${user.email}</td></tr>
              <tr><td style="padding:6px 12px;color:#555;">Password</td><td style="padding:6px 12px;font-weight:bold;">${password || '(use your existing password)'}</td></tr>
            </table>
            <p style="margin-top:16px;">
              <a href="${loginUrl}" style="background:#007bff;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Log In to Student Portal</a>
            </p>
            ${isInternship ? '<p>Your <strong>Internship Offer Letter</strong> is attached to this email as a PDF.</p>' : ''}
            <p style="font-size:11px;color:#aaa;margin-top:20px;text-align:center;">Petluri Edutech LMS</p>
          </div>`;

        const emailOptions = {
            email:   user.email,
            subject: isInternship
                ? `🎉 Internship Offer – ${course.title} | Login Credentials`
                : `✅ Enrollment Confirmed – ${course.title}`,
            html,
            message: `Welcome ${user.name}! You enrolled in ${course.title}. Email: ${user.email}, Password: ${password}`,
        };

        // --- Internship: generate offer PDF and attach it ---
        if (isInternship) {
            try {
                const offerResult = await issueInternshipOffer(user._id, course._id, {
                    email: user.email, password, name: user.name
                });
                if (offerResult && offerResult.pdfBytes) {
                    emailOptions.attachments = [{
                        filename:    `Offer_Letter_${offerResult.offerId}.pdf`,
                        content:     offerResult.pdfBytes,
                        contentType: 'application/pdf',
                    }];
                    emailOptions.html += `<p style="font-size:12px;color:#888;">Offer ID: ${offerResult.offerId}</p>`;
                }
            } catch (offerErr) {
                console.error('[Enrollment Email] Offer letter generation failed (email still sent):', offerErr.message);
            }
        }

        await sendEmail(emailOptions);
        console.log(`[Enrollment] Email sent to ${user.email} (internship=${isInternship})`);
    } catch (err) {
        console.error(`[Enrollment] Email failed for ${user.email}:`, err.message);
    }
};


exports.createOrder = async (req, res) => {
    try {
        const { courseId } = req.body;
        const course = await Course.findById(courseId);

        if (!course) {
            return res.status(404).json({ message: 'Course not found' });
        }

        if (course.price <= 0) {
            return res.status(400).json({ message: 'Course is free. Use free enrollment route.' });
        }

        const options = {
            amount: course.price * 100, // Amount in paise
            currency: 'INR',
            receipt: `receipt_order_${Math.floor(Math.random() * 1000)}`
        };

        if (process.env.RAZORPAY_KEY_ID?.includes('your_') || process.env.RAZORPAY_KEY_SECRET?.includes('your_')) {
            return res.status(400).json({ 
                message: 'Razorpay configuration incomplete', 
                error: 'Please provide valid RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env'
            });
        }

        const order = await razorpay.orders.create(options);
        res.status(200).json(order);
    } catch (error) {
        console.error("Razorpay Order Creation Error:", error);
        // Provide more descriptive error if it's a Razorpay error
        const errorMessage = error.error ? error.error.description : error.message;
        res.status(500).json({ 
            message: 'Failed to create Razorpay order', 
            error: errorMessage,
            code: error.statusCode
        });
    }
};

exports.verifyPayment = async (req, res) => {
    try {
        console.log("Entering verifyPayment...");
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            courseId,
            userDetails
        } = req.body;

        console.log(`Request data: ${JSON.stringify({ razorpay_order_id, razorpay_payment_id, courseId, email: userDetails?.email })}`);

        // Verify Signature
        const sign = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSign = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || 'dummy_secret')
            .update(sign.toString())
            .digest("hex");

        if (razorpay_signature !== expectedSign) {
            console.warn("Signature mismatch!");
            return res.status(400).json({ message: 'Invalid payment signature' });
        }

        console.log("Signature verified.");

        const course = await Course.findById(courseId);
        if (!course) {
            console.log(`Course not found: ${courseId}`);
            return res.status(404).json({ message: 'Course not found' });
        }

        console.log(`Course found: ${course.title}`);

        // Handle User Creation/Update
        let user = await User.findOne({ email: userDetails.email }).select('+tempPassword');
        let password = null;

        if (!user) {
            console.log("User not found, creating new user...");
            const firstName = userDetails.name.split(' ')[0];
            const last4Phone = userDetails.phone.slice(-4);
            password = `${firstName}@${last4Phone}`;

            user = await User.create({
                name: userDetails.name,
                email: userDetails.email,
                password: password,
                tempPassword: password,
                phone: userDetails.phone,
                collegeName: userDetails.collegeName,
                collegeDetails: userDetails.collegeDetails,
                personalAddress: userDetails.personalAddress,
                role: 'student'
            });
            console.log(`User created successfully: ${user._id}`);
        } else {
            console.log("Existing user found, updating details...");
            user.phone = userDetails.phone || user.phone;
            user.collegeName = userDetails.collegeName || user.collegeName;
            user.collegeDetails = userDetails.collegeDetails || user.collegeDetails;
            user.personalAddress = userDetails.personalAddress || user.personalAddress;
            await user.save();
            console.log(`User updated: ${user._id}`);
            password = user.tempPassword || 'Enrolled with your existing password';
        }

        // Send Email with credentials (Unified)
        await sendEnrollmentEmail(user, course, password);

        // Save Payment
        console.log("Saving payment record...");
        await Payment.create({
            userId: user._id,
            courseId: course._id,
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            razorpaySignature: razorpay_signature,
            amount: course.price,
            status: 'successful'
        });
        console.log("Payment record saved.");

        // Create Enrollment
        console.log("Creating enrollment record...");
        const existingEnrollment = await Enrollment.findOne({ userId: user._id, courseId: course._id });
        if (!existingEnrollment) {
            await Enrollment.create({
                userId: user._id,
                courseId: course._id
            });
            console.log("Enrollment created.");
        } else {
            console.log("User already enrolled.");
        }

        res.status(200).json({ message: 'Payment verified and enrollment successful', success: true });
    } catch (error) {
        console.error("Verification error crash:", error);
        console.error(error.stack);
        res.status(500).json({ message: 'Verification failed', error: error.message });
    }
};

exports.enrollFree = async (req, res) => {
    try {
        const { courseId, userDetails } = req.body;

        const course = await Course.findById(courseId);
        if (!course) {
            return res.status(404).json({ message: 'Course not found' });
        }

        if (course.price > 0) {
            return res.status(400).json({ message: 'Course is not free. Payment required.' });
        }

        // Handle User Creation/Update
        let user = await User.findOne({ email: userDetails.email }).select('+tempPassword');
        let password = null;

        if (!user) {
            // Create user
            const firstName = userDetails.name.split(' ')[0];
            const last4Phone = userDetails.phone.slice(-4);
            password = `${firstName}@${last4Phone}`;

            user = await User.create({
                name: userDetails.name,
                email: userDetails.email,
                password: password,
                tempPassword: password, // Store for admin view
                phone: userDetails.phone,
                collegeName: userDetails.collegeName,
                collegeDetails: userDetails.collegeDetails,
                personalAddress: userDetails.personalAddress,
                role: 'student'
            });
            console.log(`User created successfully: ${user._id}`);
        } else {
            console.log("Existing user found, updating details...");
            user.phone = userDetails.phone || user.phone;
            user.collegeName = userDetails.collegeName || user.collegeName;
            user.collegeDetails = userDetails.collegeDetails || user.collegeDetails;
            user.personalAddress = userDetails.personalAddress || user.personalAddress;
            await user.save();
            password = user.tempPassword || 'Enrolled with your existing password';
        }

        // Send Email with credentials (Unified)
        await sendEnrollmentEmail(user, course, password);

        // Create Enrollment
        const existingEnrollment = await Enrollment.findOne({ userId: user._id, courseId: course._id });
        if (!existingEnrollment) {
            await Enrollment.create({
                userId: user._id,
                courseId: course._id
            });
        }

        res.status(200).json({ message: 'Free enrollment successful', success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Enrollment failed', error: error.message });
    }
}
