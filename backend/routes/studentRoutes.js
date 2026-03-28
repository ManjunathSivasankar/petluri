const express = require('express');
const router = express.Router();
const {
    getDashboard,
    getMyCourses,
    getCourseDetails,
    completeVideo,
    updateVideoProgress,
    submitQuiz,
    getProgressSummary,
    submitCourseFeedback,
    getMyCertificates,
    downloadCertificate,
    getMyInternshipDocuments,
    downloadInternshipCertificate,
    proxyVideo
} = require('../controllers/studentController');
const { protect } = require('../middlewares/authMiddleware');
const { studentOnly } = require('../middlewares/roleMiddleware');
const courseAccess = require('../middlewares/courseAccess');

router.use(protect);
router.use(studentOnly);

router.get('/dashboard', getDashboard);
router.get('/courses', getMyCourses);
router.get('/certificates', getMyCertificates);
router.get('/certificates/:id/download', downloadCertificate);
router.get('/internship-documents', getMyInternshipDocuments);
router.get('/internship-certificates/:id/download', downloadInternshipCertificate);
router.get('/progress/:courseId', getProgressSummary);
router.post('/feedback/submit', submitCourseFeedback);

// Course Specific Protected Routes
router.get('/course/:id', courseAccess, getCourseDetails);
router.post('/video/progress', courseAccess, updateVideoProgress);
router.post('/video/complete', courseAccess, completeVideo);
router.post('/quiz/submit', courseAccess, submitQuiz);
router.get('/video/stream/:courseId/:moduleId/:videoId', proxyVideo);

module.exports = router;
