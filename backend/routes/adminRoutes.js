const express = require('express');
const router = express.Router();
const {
    createCourse,
    updateCourse,
    getAllCourses,
    getCourseById,
    getAllStudents,
    createStudent,
    enrollStudent,
    getAllEnrollments,
    createQuiz,
    getAllQuizzes,
    getQuizById,
    updateQuiz,
    getDashboardStats,
    uploadVideo,
    deleteCourse,
    getStudentCredentials,
    resendStudentCredentials,
    deleteStudent
} = require('../controllers/adminController');
const { protect } = require('../middlewares/authMiddleware');
const { adminOnly } = require('../middlewares/roleMiddleware');

// Check Protection and Role for all admin routes
router.use(protect);
router.use(adminOnly);

router.post('/courses', createCourse);
router.put('/courses/:id', updateCourse);
router.delete('/courses/:id', deleteCourse);
router.get('/courses/:id', getCourseById);
router.get('/courses', getAllCourses);

router.get('/students', getAllStudents);
router.post('/create-student', createStudent);
router.delete('/students/:id', deleteStudent);
router.post('/enroll-student', enrollStudent);
router.get('/enrollments', getAllEnrollments);
router.post('/enrollments/:id/credentials', getStudentCredentials);
router.post('/enrollments/:id/resend-credentials', resendStudentCredentials);

router.post('/create-quiz', createQuiz);
router.get('/quizzes', getAllQuizzes);
router.get('/quizzes/:id', getQuizById);
router.put('/quizzes/:id', updateQuiz);
router.get('/dashboard-stats', getDashboardStats);
router.post('/upload-video', uploadVideo);

module.exports = router;
