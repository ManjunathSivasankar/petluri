const express = require('express');
const router = express.Router();
const {
    getDashboard,
    getMyCourses,
    getCourseDetails,
    completeVideo,
    submitQuiz,
    getCertificates
} = require('../controllers/studentController');
const { protect } = require('../middlewares/authMiddleware');
const { studentOnly } = require('../middlewares/roleMiddleware');
const courseAccess = require('../middlewares/courseAccess');

router.use(protect);
router.use(studentOnly);

router.get('/dashboard', getDashboard);
router.get('/courses', getMyCourses);
router.get('/certificates', getCertificates);

// Course Specific Protected Routes
router.get('/course/:id', courseAccess, getCourseDetails);
router.post('/video/complete', courseAccess, completeVideo);
router.post('/quiz/submit', courseAccess, submitQuiz);

module.exports = router;
