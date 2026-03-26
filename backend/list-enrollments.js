const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Enrollment = require("./models/Enrollment");
const User = require("./models/User");
const Course = require("./models/Course");

dotenv.config();

mongoose
  .connect(process.env.MONGO_URI || "mongodb://localhost:27017/petluri_lms")
  .then(async () => {
    const enrollments = await Enrollment.find({})
      .populate("userId", "name email phone")
      .populate("courseId", "title");

    console.log("Total Enrollments:", enrollments.length);
    console.log(JSON.stringify(enrollments, null, 2));
    process.exit();
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
