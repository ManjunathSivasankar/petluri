const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');
const Course = require('./models/Course');
const Enrollment = require('./models/Enrollment');
const Payment = require('./models/Payment');
const { verifyPayment } = require('./controllers/paymentController');

// Mock req and res
const mockResponse = () => {
    const res = {};
    res.status = (code) => {
        res.statusCode = code;
        return res;
    };
    res.json = (data) => {
        res.data = data;
        return res;
    };
    return res;
};

async function test() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected.");

        // 1. Get a course
        const course = await Course.findOne({ price: { $gt: 0 } });
        if (!course) {
            console.error("No paid course found for testing.");
            process.exit(1);
        }
        console.log(`Found course: ${course.title} (Price: ${course.price})`);

        // 2. Get the test user
        const email = 'maheshwarancloud@gmail.com';
        let user = await User.findOne({ email });
        if (!user) {
            console.error(`User ${email} not found.`);
            process.exit(1);
        }
        console.log(`Found user: ${user.name} | studentId: ${user.studentId}`);

        // 3. Simulate a signature mismatch (should fail with 400)
        console.log("\n--- Testing Signature Mismatch ---");
        const reqMismatch = {
            body: {
                razorpay_order_id: 'order_test_123',
                razorpay_payment_id: 'pay_test_123',
                razorpay_signature: 'invalid_signature',
                courseId: course._id,
                userDetails: {
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    collegeName: user.collegeName,
                    collegeDetails: user.collegeDetails,
                    personalAddress: user.personalAddress
                }
            }
        };
        const resMismatch = mockResponse();
        await verifyPayment(reqMismatch, resMismatch);
        console.log(`Status: ${resMismatch.statusCode}`);
        console.log(`Message: ${resMismatch.data.message}`);
        console.log(`Error detail: ${resMismatch.data.error}`);

        // Note: We can't easily test a SUCCESSFUL signature without a real Razorpay secret 
        // and matching order/payment IDs, but we've verified the error path and logging.

        console.log("\nVerification complete.");
        process.exit(0);

    } catch (error) {
        console.error("Test failed:", error);
        process.exit(1);
    }
}

test();
