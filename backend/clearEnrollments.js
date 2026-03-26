const mongoose = require('mongoose');
require('dotenv').config();
const Enrollment = require('./models/Enrollment');

async function clearAllEnrollments() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const result = await Enrollment.deleteMany({});
        console.log(`Deleted ${result.deletedCount} Enrollment record(s).`);

        console.log('\nDone. All enrollment records cleared.');
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

clearAllEnrollments();
