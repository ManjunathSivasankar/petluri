const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Course = require('./models/Course');

dotenv.config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/petluri_lms')
    .then(async () => {
        const courses = await Course.find({});
        console.log(JSON.stringify(courses, null, 2));
        process.exit();
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
