const express = require('express');
const fs = require('fs');
const router = express.Router();
const multer = require('multer');
const path = require('path');

const ensureDir = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

const uploadsRoot = path.join(__dirname, '..', 'public', 'uploads');
const imagesDir = path.join(uploadsRoot, 'images');
const videosDir = path.join(uploadsRoot, 'videos');
const templatesDir = path.join(uploadsRoot, 'templates');

// ── Multer: Course banner images (jpg/png/webp only) ─────────────────────────
const imageStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        ensureDir(imagesDir);
        cb(null, imagesDir);
    },
    filename:    (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + '-' + unique + path.extname(file.originalname));
    }
});

const uploadImage = multer({
    storage: imageStorage,
    limits:  { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|webp/;
        if (allowed.test(file.mimetype) && allowed.test(path.extname(file.originalname).toLowerCase())) {
            return cb(null, true);
        }
        cb(new Error('Only image files (jpeg, jpg, png, webp) are allowed here'));
    }
});

// ── Multer: Course videos (mp4/webm/mov/mkv/avi) ─────────────────────────────
const videoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        ensureDir(videosDir);
        cb(null, videosDir);
    },
    filename:    (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, 'video-' + unique + path.extname(file.originalname));
    }
});

const uploadVideoFile = multer({
    storage: videoStorage,
    limits:  { fileSize: 500 * 1024 * 1024 }, // 500 MB
    fileFilter: (req, file, cb) => {
        const allowedExt = /mp4|webm|mov|mkv|avi/;
        const allowedMime = /video\/mp4|video\/webm|video\/quicktime|video\/x-matroska|video\/x-msvideo|application\/octet-stream/;
        const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
        if (allowedExt.test(ext) && allowedMime.test(file.mimetype)) {
            return cb(null, true);
        }
        cb(new Error('Only video files (mp4, webm, mov, mkv, avi) are allowed'));
    }
});

// ── Multer: Certificate templates (PDF only) ──────────────────────────────────
const templateStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        ensureDir(templatesDir);
        cb(null, templatesDir);
    },
    filename:    (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, 'template-' + unique + '.pdf');
    }
});

const uploadTemplate = multer({
    storage: templateStorage,
    limits:  { fileSize: 10 * 1024 * 1024 }, // 10 MB
    fileFilter: (req, file, cb) => {
        const isPdf = file.mimetype === 'application/pdf' ||
                      path.extname(file.originalname).toLowerCase() === '.pdf';
        if (isPdf) return cb(null, true);
        cb(new Error('Only PDF files are allowed for certificate templates'));
    }
});

const handleMulter = (multerMiddleware) => (req, res, next) => {
    multerMiddleware(req, res, (err) => {
        if (!err) return next();

        if (err instanceof multer.MulterError) {
            const message = err.code === 'LIMIT_FILE_SIZE'
                ? 'Uploaded file exceeds allowed size limit'
                : err.message;
            return res.status(400).json({ message, code: err.code });
        }

        return res.status(400).json({ message: err.message || 'Invalid upload payload' });
    });
};
const {
    createCourse,
    updateCourse,
    getAllCourses,
    getCourseById,
    getAllStudents,
    createStudent,
    enrollStudent,
    getAllEnrollments,
    getEnrollmentMonitoringDetails,
    exportCourseEnrollments,
    updateEnrollmentStatus,
    createQuiz,
    getAllQuizzes,
    getQuizById,
    updateQuiz,
    getDashboardStats,
    uploadVideo,
    deleteCourse,
    getStudentCredentials,
    resendStudentCredentials,
    deleteStudent,
    getAllCertificates,
    downloadCertificate,
    getAllInternshipOffers,
    getAllInternshipCertificates,
    downloadInternshipCertificate,
    getAdminVideos,
    uploadModuleVideo,
    deleteModuleVideo
} = require('../controllers/adminController');
const { protect } = require('../middlewares/authMiddleware');
const { adminOnly } = require('../middlewares/roleMiddleware');

// Check Protection and Role for all admin routes
router.use(protect);
router.use((req, res, next) => {
    console.log(`DEBUG: Admin request from ${req.user.email} (Role: ${req.user.role}) for ${req.method} ${req.originalUrl}`);
    next();
});
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
router.get('/enrollments/:id/details', getEnrollmentMonitoringDetails);
router.get('/enrollments/export/:courseId', exportCourseEnrollments);
router.put('/enrollments/:id/status', updateEnrollmentStatus);
router.post('/enrollments/:id/credentials', getStudentCredentials);
router.post('/enrollments/:id/resend-credentials', resendStudentCredentials);

router.post('/create-quiz', createQuiz);
router.get('/quizzes', getAllQuizzes);
router.get('/quizzes/:id', getQuizById);
router.put('/quizzes/:id', updateQuiz);
router.get('/dashboard-stats', getDashboardStats);
router.get('/certificates', getAllCertificates);
router.get('/certificates/:id/download', downloadCertificate);

// Internship Document Management
router.get('/internships/offers', getAllInternshipOffers);
router.get('/internships/certificates', getAllInternshipCertificates);
router.get('/internships/certificates/:id/download', downloadInternshipCertificate);

// Admin video management
router.get('/videos', getAdminVideos);
router.post('/videos/upload', handleMulter(uploadVideoFile.single('video')), uploadModuleVideo);
router.delete('/videos/:courseId/:moduleId', deleteModuleVideo);

// Upload course banner image (jpg/png/webp)
router.post('/upload-image', handleMulter(uploadImage.single('file')), uploadVideo);

// Upload course video file (mp4/webm/mov/mkv/avi)
router.post('/upload-video', handleMulter(uploadVideoFile.single('video')), uploadVideo);

// Upload certificate template (PDF only)
router.post('/upload-template', handleMulter(uploadTemplate.single('file')), uploadVideo);

module.exports = router;
