const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const Quiz = require('../models/Quiz');
const Certificate = require('../models/Certificate');

// @desc    Get Student Dashboard
// @route   GET /api/student/dashboard
// @access  Private/Student
const getDashboard = async (req, res) => {
    try {
        const enrollments = await Enrollment.find({ userId: req.user._id })
            .populate('courseId', 'title description duration level type image')
            .sort({ enrolledAt: -1 });

        const dashboardData = {
            user: {
                name: req.user.name,
                email: req.user.email
            },
            enrolledCourses: enrollments.map(enrollment => ({
                _id: enrollment.courseId._id,
                title: enrollment.courseId.title,
                description: enrollment.courseId.description,
                duration: enrollment.courseId.duration,
                level: enrollment.courseId.level,
                image: enrollment.courseId.image,
                progress: enrollment.completionPercentage,
                status: enrollment.status,
                certificateIssued: enrollment.certificateIssued
            })),
            stats: {
                totalEnrolled: enrollments.length,
                completed: enrollments.filter(e => e.status === 'completed').length,
                certificates: enrollments.filter(e => e.certificateIssued).length
            }
        };

        res.json(dashboardData);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Enrolled Courses
// @route   GET /api/student/courses
// @access  Private/Student
const getMyCourses = async (req, res) => {
    try {
        const enrollments = await Enrollment.find({ userId: req.user._id })
            .populate('courseId');

        const courses = enrollments.map(enrollment => ({
            ...enrollment.courseId._doc,
            progress: enrollment.completionPercentage,
            status: enrollment.status,
            enrolledAt: enrollment.enrolledAt
        }));

        res.json(courses);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Single Course Details (Content)
// @route   GET /api/student/course/:id
// @access  Private/Student
const getCourseDetails = async (req, res) => {
    try {
        // Check enrollment first
        const enrollment = await Enrollment.findOne({
            userId: req.user._id,
            courseId: req.params.id
        });

        if (!enrollment) {
            return res.status(403).json({ message: 'Not enrolled in this course' });
        }

        const course = await Course.findById(req.params.id)
            .populate('quizzes', 'title timeLimit passingScore questions'); // Populate quizzes structure

        res.json({
            course,
            progress: enrollment.progress
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Mark Video as Completed
// @route   POST /api/student/video/complete
// @access  Private/Student
const completeVideo = async (req, res) => {
    const { courseId, videoId } = req.body;

    try {
        const enrollment = await Enrollment.findOne({ userId: req.user._id, courseId });

        if (!enrollment) {
            return res.status(404).json({ message: 'Enrollment not found' });
        }

        // Add if not already completed
        if (!enrollment.progress.completedVideos.includes(videoId)) {
            enrollment.progress.completedVideos.push(videoId);
        }

        // Calculate progress (Simplified logic: numCompleted / totalVideos * 100)
        // Ideally fetch course to get total video count
        const course = await Course.findById(courseId);
        const totalVideos = course.videos.length;
        const totalQuizzes = course.quizzes.length;

        // Weighting: Videos 80%, Quizzes 20% (Example logic) or simple item count
        // Let's use simple item count for robustness
        const totalItems = totalVideos + totalQuizzes;
        const completedItems = enrollment.progress.completedVideos.length + enrollment.progress.quizAttempts.filter(q => q.passed).length;

        enrollment.completionPercentage = Math.round((completedItems / totalItems) * 100);

        if (enrollment.completionPercentage === 100) {
            enrollment.status = 'completed';

            // Issue Certificate
            const { issueCertificate } = require('../services/certificateService');
            await issueCertificate(req.user._id, courseId);
            enrollment.certificateIssued = true;
        }

        await enrollment.save();

        res.json(enrollment);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Submit Quiz
// @route   POST /api/student/quiz/submit
// @access  Private/Student
const submitQuiz = async (req, res) => {
    const { courseId, quizId, answers } = req.body; // answers: { questionId: optionIndex/String }

    try {
        // Logic to calculate score would go here.
        // For now, assuming passing for simplicity or standard logic
        // We'd fetch Quiz, compare answers, calc score.

        const quiz = await Quiz.findById(quizId);
        let correctCount = 0;

        // Mock score calculation
        // In real app, iterate quiz.questions and compare with answers
        const score = 85; // Mock score
        const passed = score >= quiz.passingScore;

        const enrollment = await Enrollment.findOne({ userId: req.user._id, courseId });

        enrollment.progress.quizAttempts.push({
            quizId,
            score,
            passed,
            attemptedAt: new Date()
        });

        // Re-calculate progress... (Same logic as above, DRY in real app)
        await enrollment.save();

        res.json({ score, passed });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get my certificates
// @route   GET /api/student/certificates
// @access  Private/Student
const getCertificates = async (req, res) => {
    try {
        const certificates = await Certificate.find({ userId: req.user._id })
            .populate('courseId', 'title');
        res.json(certificates);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getDashboard,
    getMyCourses,
    getCourseDetails,
    completeVideo,
    submitQuiz,
    getCertificates
};
