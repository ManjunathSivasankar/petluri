const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const Quiz = require('../models/Quiz');
const Certificate = require('../models/Certificate');
const InternshipCertificate = require('../models/InternshipCertificate');
const InternshipOffer = require('../models/InternshipOffer');
const { issueCertificate } = require('../services/certificateService');
const { issueInternshipCertificate } = require('../services/internshipDocumentService');
const { getSignedDownloadUrl, streamVideoFile } = require('../services/videoStorageService');

const VIDEO_COMPLETION_THRESHOLD = 0.95;

const getCompletedVideoSet = (enrollment) => {
    const completed = new Set((enrollment.progress?.completedVideos || []).map(String));
    (enrollment.progress?.videoProgress || []).forEach((item) => {
        if (item.completed && item.videoId) {
            completed.add(String(item.videoId));
        }
    });
    return completed;
};

const updateVideoProgressRow = (enrollment, payload) => {
    enrollment.progress = enrollment.progress || {};
    enrollment.progress.completedVideos = enrollment.progress.completedVideos || [];
    enrollment.progress.quizAttempts = enrollment.progress.quizAttempts || [];
    enrollment.progress.videoProgress = enrollment.progress.videoProgress || [];

    const {
        moduleId,
        videoId,
        watchedDuration = 0,
        totalDuration = 0,
        currentTime = 0,
        playbackRate = 1,
        accessed = true
    } = payload;

    const safeWatched = Math.max(0, Number(watchedDuration) || 0);
    const safeTotal = Math.max(0, Number(totalDuration) || 0);
    const safeCurrent = Math.max(0, Number(currentTime) || 0);
    const ratio = safeTotal > 0 ? safeWatched / safeTotal : 0;
    const completed = ratio >= VIDEO_COMPLETION_THRESHOLD;

    let row = enrollment.progress.videoProgress.find(
        (item) => String(item.videoId) === String(videoId)
    );

    if (!row) {
        row = {
            moduleId: String(moduleId),
            videoId: String(videoId),
            watchedDuration: 0,
            totalDuration: safeTotal,
            lastPosition: 0,
            completed: false,
            playbackRate: playbackRate || 1,
            accessCount: 0,
            firstAccessedAt: null,
            lastWatchedAt: null
        };
        enrollment.progress.videoProgress.push(row);
    }

    row.moduleId = String(moduleId);
    row.watchedDuration = Math.max(row.watchedDuration || 0, safeWatched);
    row.totalDuration = Math.max(row.totalDuration || 0, safeTotal);
    row.lastPosition = Math.max(row.lastPosition || 0, safeCurrent);
    row.playbackRate = playbackRate || 1;
    row.lastWatchedAt = new Date();

    if (accessed) {
        row.accessCount = (row.accessCount || 0) + 1;
        if (!row.firstAccessedAt) row.firstAccessedAt = new Date();
    }

    if (completed) {
        row.completed = true;
        if (!enrollment.progress.completedVideos.includes(String(videoId))) {
            enrollment.progress.completedVideos.push(String(videoId));
        }
    }

    return {
        completed: row.completed,
        ratio: row.totalDuration > 0 ? row.watchedDuration / row.totalDuration : 0,
        row
    };
};

const getCourseItems = (course) => {
    const videoIds = new Set((course.videos || []).map(v => String(v._id)));
    const quizIds = new Set((course.quizzes || []).map(q => String(q)));
    const modules = (course.modules || []).map((mod, index) => {
        const moduleVideoIds = [];
        const moduleQuizIds = [];

        (mod.content || []).forEach((item) => {
            if (item.type === 'video') {
                moduleVideoIds.push(String(item._id));
                videoIds.add(String(item._id));
            }
            if (item.type === 'quiz' && item.quizId) {
                const quizId = String(item.quizId._id || item.quizId);
                moduleQuizIds.push(quizId);
                quizIds.add(quizId);
            }
        });

        return {
            moduleIndex: index,
            title: mod.title,
            videoIds: moduleVideoIds,
            quizIds: moduleQuizIds
        };
    });

    return {
        videoIds,
        quizIds,
        modules,
        totalItems: videoIds.size + quizIds.size
    };
};

const buildProgressSummary = (course, enrollment) => {
    const items = getCourseItems(course);
    const completedVideos = getCompletedVideoSet(enrollment);
    const passedQuizIds = new Set(
        (enrollment.progress?.quizAttempts || [])
            .filter(attempt => attempt.passed && attempt.quizId)
            .map(attempt => String(attempt.quizId))
    );

    const moduleProgress = items.modules.map((mod) => {
        const completedVideoCount = mod.videoIds.filter(id => completedVideos.has(id)).length;
        const completedQuizCount = mod.quizIds.filter(id => passedQuizIds.has(id)).length;
        const totalModuleItems = mod.videoIds.length + mod.quizIds.length;
        const completedItems = completedVideoCount + completedQuizCount;
        const percentage = totalModuleItems > 0 ? Math.round((completedItems / totalModuleItems) * 100) : 100;

        return {
            moduleIndex: mod.moduleIndex,
            title: mod.title,
            totalItems: totalModuleItems,
            completedItems,
            completedVideos: completedVideoCount,
            completedQuizzes: completedQuizCount,
            status: percentage === 100 ? 'completed' : percentage > 0 ? 'in-progress' : 'pending',
            completionPercentage: percentage
        };
    });

    const completedItemsCount = [...items.videoIds].filter(id => completedVideos.has(id)).length +
        [...items.quizIds].filter(id => passedQuizIds.has(id)).length;
    const completionPercentage = items.totalItems > 0 ? Math.round((completedItemsCount / items.totalItems) * 100) : 100;

    return {
        totalItems: items.totalItems,
        completedItems: completedItemsCount,
        completionPercentage,
        totalModules: moduleProgress.length,
        completedModules: moduleProgress.filter(m => m.status === 'completed').length,
        pendingModules: moduleProgress.filter(m => m.status !== 'completed').length,
        moduleProgress
    };
};

const syncEnrollmentProgress = (enrollment, course) => {
    const summary = buildProgressSummary(course, enrollment);
    enrollment.completionPercentage = summary.completionPercentage;

    if (summary.completionPercentage === 100) {
        enrollment.status = 'completed';
    } else if (enrollment.status === 'enrolled' || enrollment.status === 'completed') {
        enrollment.status = 'pending';
        enrollment.certificateIssued = false;
    }

    return summary;
};

const getQuizResultSummary = (enrollment) => {
    const attempts = enrollment.progress?.quizAttempts || [];
    const latestByQuiz = new Map();

    attempts.forEach((attempt) => {
        if (!attempt.quizId) return;
        const quizId = String(attempt.quizId);
        const current = latestByQuiz.get(quizId);
        if (!current || new Date(attempt.attemptedAt || 0) > new Date(current.attemptedAt || 0)) {
            latestByQuiz.set(quizId, attempt);
        }
    });

    const latestResults = Array.from(latestByQuiz.values()).map(a => ({
        quizId: a.quizId,
        score: a.score,
        totalQuestions: a.totalQuestions || 0,
        correctAnswers: a.correctAnswers || 0,
        passed: a.passed,
        attemptedAt: a.attemptedAt
    }));

    return {
        totalAttempts: attempts.length,
        passedQuizzes: latestResults.filter(r => r.passed).length,
        failedQuizzes: latestResults.filter(r => !r.passed).length,
        latestResults
    };
};

const issueCompletionDocument = async (userId, courseId) => {
    const course = await Course.findById(courseId);
    if (!course) return false;

    if (course.type === 'internship') {
        await issueInternshipCertificate(userId, courseId);
    } else {
        await issueCertificate(userId, courseId);
    }

    return true;
};

// @desc    Get Student Dashboard
// @route   GET /api/student/dashboard
// @access  Private/Student
const getDashboard = async (req, res) => {
    try {
        const enrollments = await Enrollment.find({ userId: req.user._id })
            .populate('courseId', 'title description duration level type image')
            .sort({ enrolledAt: -1 });

        // Guard: skip enrollments where the course has been deleted
        const validEnrollments = enrollments.filter(e => e.courseId != null);

        const dashboardData = {
            user: {
                name: req.user.name,
                email: req.user.email
            },
            enrolledCourses: await Promise.all(validEnrollments.map(async (enrollment) => {
                const c = enrollment.courseId;
                // Sign URLs for course content if needed
                if (c.modules) {
                    for (let mod of c.modules) {
                        if (mod.content) {
                            for (let item of mod.content) {
                                if (item.type === 'video' && item.storageProvider === 'backblaze') {
                                    item.url = `/api/student/video/stream/${c._id}/${mod._id}/${item._id}`;
                                }
                            }
                        }
                    }
                }
                return {
                    _id: c._id,
                    enrollmentId: enrollment.enrollmentId,
                    programId: c.programId || c.courseCode, // Primary ID from Course
                    title: c.title,
                    description: c.description,
                    duration: c.duration,
                    level: c.level,
                    image: c.image,
                    progress: enrollment.completionPercentage,
                    status: enrollment.status,
                    certificateIssued: enrollment.certificateIssued
                };
            })),
            stats: {
                totalEnrolled: validEnrollments.length,
                completed: validEnrollments.filter(e => e.status === 'completed').length,
                certificates: validEnrollments.filter(e => e.certificateIssued).length
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

        const courses = await Promise.all(enrollments
            .filter(enrollment => enrollment.courseId)
            .map(async (enrollment) => {
                const course = enrollment.courseId;
                if (course.modules) {
                    for (let mod of course.modules) {
                        if (mod.content) {
                            for (let item of mod.content) {
                                if (item.type === 'video' && item.storageProvider === 'backblaze') {
                                    item.url = `/api/student/video/stream/${course._id}/${mod._id}/${item._id}`;
                                }
                            }
                        }
                    }
                }
                return {
                    ...course._doc,
                    enrollmentId: enrollment.enrollmentId,
                    programId: course.programId || course.courseCode,
                    progress: enrollment.completionPercentage,
                    status: enrollment.status,
                    enrolledAt: enrollment.enrolledAt
                };
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

        if (enrollment.status === 'enrolled') {
            enrollment.status = 'pending';
            await enrollment.save();
        }

        const course = await Course.findById(req.params.id)
            .populate('quizzes', 'title timeLimit passingScore questions')
            .populate({
                path: 'modules.content.quizId',
                select: 'title timeLimit passingScore questions'
            });

        // Enrich ALL video URLs with fresh stream URLs if hosted on B2
        if (course.modules) {
            course.modules.forEach(mod => {
                if (mod.content) {
                    mod.content.forEach(item => {
                        if (item.type === 'video' && item.storageProvider === 'backblaze') {
                            item.url = `/api/student/video/stream/${course._id}/${mod._id}/${item._id}`;
                        }
                    });
                }
            });
        }

        res.json({
            course,
            progress: enrollment.progress,
            status: enrollment.status,
            enrollmentId: enrollment.enrollmentId, // Include for UI
            completionPercentage: enrollment.completionPercentage,
            progressSummary: buildProgressSummary(course, enrollment),
            quizResults: getQuizResultSummary(enrollment),
            feedback: {
                required: Boolean(enrollment.feedback?.required),
                submitted: Boolean(enrollment.feedback?.submitted),
                rating: enrollment.feedback?.rating || null,
                comments: enrollment.feedback?.comments || '',
                submittedAt: enrollment.feedback?.submittedAt || null
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Mark Video as Completed
// @route   POST /api/student/video/complete
// @access  Private/Student
const completeVideo = async (req, res) => {
    const { courseId, moduleId, videoId, watchedDuration, totalDuration, currentTime, playbackRate } = req.body;

    try {
        const enrollment = await Enrollment.findOne({ userId: req.user._id, courseId });

        if (!enrollment) {
            return res.status(404).json({ message: 'Enrollment not found' });
        }

        const course = await Course.findById(courseId);
        if (!course) {
            return res.status(404).json({ message: 'Course not found' });
        }

        const targetModule = (course.modules || []).find((mod) =>
            String(mod._id) === String(moduleId) ||
            (mod.content || []).some((item) => item.type === 'video' && String(item._id) === String(videoId))
        );

        if (!targetModule) {
            return res.status(400).json({ message: 'Invalid module or video for this course' });
        }

        const targetVideo = (targetModule.content || []).find((item) => item.type === 'video' && String(item._id) === String(videoId));
        if (!targetVideo) {
            return res.status(400).json({ message: 'Video does not belong to the selected module' });
        }

        const effectiveDuration = Number(totalDuration) || (() => {
            if (!targetVideo.duration) return 0;
            const parts = String(targetVideo.duration).split(':').map(Number);
            if (parts.length === 2) return (parts[0] * 60) + parts[1];
            if (parts.length === 3) return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
            return 0;
        })();

        const progressUpdate = updateVideoProgressRow(enrollment, {
            moduleId: targetModule._id,
            videoId: targetVideo._id,
            watchedDuration,
            totalDuration: effectiveDuration,
            currentTime,
            playbackRate,
            accessed: false
        });

        const summary = syncEnrollmentProgress(enrollment, course);

        if (summary.completionPercentage === 100 && !enrollment.certificateIssued) {
            try {
                await issueCompletionDocument(req.user._id, courseId);
                enrollment.certificateIssued = true;
            } catch (certError) {
                console.error('Certificate generation failed (non-fatal):', certError.message);
            }
        }

        await enrollment.save();

        res.json({
            ...enrollment.toObject(),
            videoCompletion: {
                completed: progressUpdate.completed,
                watchedRatio: Number(progressUpdate.ratio.toFixed(4))
            },
            progressSummary: summary,
            quizResults: getQuizResultSummary(enrollment)
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Track video progress with watched duration and anti-skip completion threshold
// @route   POST /api/student/video/progress
// @access  Private/Student
const updateVideoProgress = async (req, res) => {
    const { courseId, moduleId, videoId, watchedDuration, totalDuration, currentTime, playbackRate, accessed } = req.body;

    try {
        if (!courseId || !moduleId || !videoId) {
            return res.status(400).json({ message: 'courseId, moduleId and videoId are required' });
        }

        const enrollment = await Enrollment.findOne({ userId: req.user._id, courseId });
        if (!enrollment) {
            return res.status(404).json({ message: 'Enrollment not found' });
        }

        const course = await Course.findById(courseId);
        if (!course) {
            return res.status(404).json({ message: 'Course not found' });
        }

        const targetModule = (course.modules || []).find((mod) => String(mod._id) === String(moduleId));
        if (!targetModule) {
            return res.status(400).json({ message: 'Invalid moduleId for this course' });
        }

        const targetVideo = (targetModule.content || []).find((item) => item.type === 'video' && String(item._id) === String(videoId));
        if (!targetVideo) {
            return res.status(400).json({ message: 'Invalid videoId for this module' });
        }

        const progressUpdate = updateVideoProgressRow(enrollment, {
            moduleId,
            videoId,
            watchedDuration,
            totalDuration,
            currentTime,
            playbackRate,
            accessed
        });

        const summary = syncEnrollmentProgress(enrollment, course);

        if (summary.completionPercentage === 100 && !enrollment.certificateIssued) {
            try {
                await issueCompletionDocument(req.user._id, courseId);
                enrollment.certificateIssued = true;
            } catch (certError) {
                console.error('Certificate generation failed (non-fatal):', certError.message);
            }
        }

        await enrollment.save();

        res.json({
            message: 'Video progress updated',
            videoProgress: progressUpdate.row,
            videoCompletion: {
                completed: progressUpdate.completed,
                watchedRatio: Number(progressUpdate.ratio.toFixed(4))
            },
            completionPercentage: enrollment.completionPercentage,
            status: enrollment.status,
            progressSummary: summary,
            quizResults: getQuizResultSummary(enrollment)
        });
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
        const quiz = await Quiz.findById(quizId);
        if (!quiz) {
            return res.status(404).json({ message: 'Quiz not found' });
        }

        const questionCount = quiz.questions?.length || 0;
        let correctAnswers = 0;

        (quiz.questions || []).forEach((question) => {
            const selected = answers?.[String(question._id)];
            if (selected === undefined || selected === null) return;

            const normalizedSelected = String(selected).trim().toLowerCase();
            const normalizedCorrect = String(question.correctAnswer).trim().toLowerCase();
            const answerMatches = normalizedSelected === normalizedCorrect;

            const optionIndex = Number(selected);
            const indexMatches = Number.isInteger(optionIndex) && question.options?.[optionIndex]
                ? String(question.options[optionIndex]).trim().toLowerCase() === normalizedCorrect
                : false;

            if (answerMatches || indexMatches) {
                correctAnswers += 1;
            }
        });

        const score = questionCount > 0 ? Math.round((correctAnswers / questionCount) * 100) : 0;
        const requiredPassingScore = quiz.passingScore || 50;
        const passThreshold = Math.max(50, requiredPassingScore);
        const passed = score >= passThreshold;

        const enrollment = await Enrollment.findOne({ userId: req.user._id, courseId });
        if (!enrollment) {
            return res.status(404).json({ message: 'Enrollment not found' });
        }

        enrollment.progress = enrollment.progress || {};
        enrollment.progress.completedVideos = enrollment.progress.completedVideos || [];
        enrollment.progress.quizAttempts = enrollment.progress.quizAttempts || [];

        enrollment.progress.quizAttempts.push({
            quizId,
            score,
            totalQuestions: questionCount,
            correctAnswers,
            passed,
            answers,
            attemptedAt: new Date()
        });

        const course = await Course.findById(courseId);
        const summary = syncEnrollmentProgress(enrollment, course);

        if (summary.completionPercentage === 100 && !enrollment.certificateIssued) {
            try {
                await issueCompletionDocument(req.user._id, courseId);
                enrollment.certificateIssued = true;
            } catch (certError) {
                console.error('Certificate generation failed (non-fatal):', certError.message);
            }
        }

        await enrollment.save();

        res.json({
            score,
            passed,
            passThreshold,
            totalQuestions: questionCount,
            correctAnswers,
            enrollment,
            progressSummary: summary,
            quizResults: getQuizResultSummary(enrollment)
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Enrollment Progress Summary
// @route   GET /api/student/progress/:courseId
// @access  Private/Student
const getProgressSummary = async (req, res) => {
    try {
        const { courseId } = req.params;
        const enrollment = await Enrollment.findOne({ userId: req.user._id, courseId });
        if (!enrollment) {
            return res.status(404).json({ message: 'Enrollment not found' });
        }

        const course = await Course.findById(courseId);
        if (!course) {
            return res.status(404).json({ message: 'Course not found' });
        }

        const progressSummary = buildProgressSummary(course, enrollment);
        const progressTable = (enrollment.progress?.videoProgress || []).map((row) => ({
            userId: enrollment.userId,
            courseId: enrollment.courseId,
            moduleId: row.moduleId,
            videoId: row.videoId,
            videoProgress: row.totalDuration > 0 ? Math.round((row.watchedDuration / row.totalDuration) * 100) : 0,
            quizStatus: 'n/a',
            completedStatus: Boolean(row.completed),
            watchedDuration: row.watchedDuration,
            totalDuration: row.totalDuration,
            lastWatchedAt: row.lastWatchedAt
        }));
        res.json({
            completionPercentage: enrollment.completionPercentage,
            status: enrollment.status,
            progressSummary,
            progressTable,
            quizResults: getQuizResultSummary(enrollment),
            feedback: enrollment.feedback || { required: false, submitted: false }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Submit mandatory completion feedback
// @route   POST /api/student/feedback/submit
// @access  Private/Student
const submitCourseFeedback = async (req, res) => {
    try {
        const { courseId, rating, comments } = req.body;

        if (!courseId) {
            return res.status(400).json({ message: 'courseId is required' });
        }

        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ message: 'rating must be between 1 and 5' });
        }

        const enrollment = await Enrollment.findOne({ userId: req.user._id, courseId });
        if (!enrollment) {
            return res.status(404).json({ message: 'Enrollment not found' });
        }

        const course = await Course.findById(courseId);
        if (!course) {
            return res.status(404).json({ message: 'Course not found' });
        }

        const summary = syncEnrollmentProgress(enrollment, course);
        if (summary.completionPercentage < 100) {
            return res.status(400).json({ message: 'Feedback can be submitted only after completing all modules' });
        }

        enrollment.feedback = {
            required: false,
            submitted: true,
            rating,
            comments: String(comments || '').trim(),
            submittedAt: new Date()
        };

        if (enrollment.status !== 'completed') {
            enrollment.status = 'completed';
            await enrollment.save();

            try {
                await issueCompletionDocument(req.user._id, courseId);
                enrollment.certificateIssued = true;
            } catch (certError) {
                console.error('Certificate generation failed (non-fatal):', certError.message);
            }
        }

        await enrollment.save();

        res.json({
            message: 'Feedback submitted successfully',
            enrollment,
            progressSummary: summary
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getMyCertificates = async (req, res) => {
    try {
        const certificates = await Certificate.find({ userId: req.user._id })
            .populate('courseId', 'title')
            .sort({ generatedDate: -1 });
        res.json(certificates);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Download Certificate (Dynamic)
// @route   GET /api/student/certificates/:id/download
// @access  Private/Student
const downloadCertificate = async (req, res) => {
    try {
        const certificate = await Certificate.findById(req.params.id);
        
        if (!certificate) {
            return res.status(404).json({ message: 'Certificate not found' });
        }

        // Check ownership
        if (certificate.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to download this certificate' });
        }

        // Generate on-the-fly
        console.log(`Dynamic download requested for cert ${req.params.id}. Regenerating...`);
        const { pdfBytes, fileName } = await issueCertificate(certificate.userId, certificate.courseId);

        // Stream PDF to client
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        res.send(Buffer.from(pdfBytes));

    } catch (error) {
        console.error('Download Error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

const getMyInternshipDocuments = async (req, res) => {
    try {
        const [offers, certificates] = await Promise.all([
            InternshipOffer.find({ userId: req.user._id })
                .populate('courseId', 'title')
                .sort({ issuedDate: -1 }),
            InternshipCertificate.find({ userId: req.user._id })
                .populate('courseId', 'title')
                .sort({ issuedDate: -1 })
        ]);
        res.json({ offers, certificates });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Download Internship Certificate (student-facing)
// @route   GET /api/student/internship-certificates/:id/download
// @access  Private/Student
const downloadInternshipCertificate = async (req, res) => {
    try {
        const certificate = await InternshipCertificate.findById(req.params.id);

        if (!certificate) {
            return res.status(404).json({ message: 'Internship certificate not found' });
        }

        if (certificate.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to download this certificate' });
        }

        const result = await issueInternshipCertificate(certificate.userId, certificate.courseId);
        if (!result) return res.status(404).json({ message: 'Certificate generation failed or template missing' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${result.fileName}`);
        res.send(result.pdfBytes);

    } catch (error) {
        console.error('Internship certificate download error:', error.message);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Proxy video stream for enrolled students
// @route   GET /api/student/video/stream/:courseId/:moduleId/:videoId
// @access  Private/Student
const proxyVideo = async (req, res) => {
    try {
        const { courseId, moduleId, videoId } = req.params;
        
        // 1. Check enrollment
        const enrollment = await Enrollment.findOne({ userId: req.user._id, courseId });
        if (!enrollment) return res.status(403).send('Not enrolled in this course');

        // 2. Fetch course data to get the storage key
        const course = await Course.findById(courseId);
        if (!course) return res.status(404).send('Course not found');

        const mod = (course.modules || []).find(m => String(m._id) === moduleId);
        if (!mod) return res.status(404).send('Module not found');

        const video = (mod.content || []).find(c => c.type === 'video' && String(c._id) === videoId);
        if (!video || !video.storageKey) return res.status(404).send('Video not found or no storage key');

        if (video.storageProvider !== 'backblaze') {
            return res.status(400).send('Only Backblaze videos can be proxied');
        }

        const range = req.headers.range;
        const s3Response = await streamVideoFile({ key: video.storageKey, range });

        // Forward headers from B2
        if (s3Response.ContentType) res.setHeader('Content-Type', s3Response.ContentType);
        if (s3Response.ContentLength) res.setHeader('Content-Length', s3Response.ContentLength);
        if (s3Response.ContentRange) res.setHeader('Content-Range', s3Response.ContentRange);
        if (s3Response.AcceptRanges) res.setHeader('Accept-Ranges', s3Response.AcceptRanges);
        if (s3Response.ETag) res.setHeader('ETag', s3Response.ETag);

        res.status(s3Response.$metadata.httpStatusCode || 200);

        // Pipe the B2 stream to the express response
        s3Response.Body.pipe(res);
    } catch (error) {
        console.error('[Student proxyVideo] Stream error:', error.message);
        if (!res.headersSent) {
            res.status(500).send(error.message);
        }
    }
};

module.exports = {
    getDashboard,
    getMyCourses,
    getCourseDetails,
    updateVideoProgress,
    completeVideo,
    submitQuiz,
    getProgressSummary,
    submitCourseFeedback,
    getMyCertificates,
    downloadCertificate,
    getMyInternshipDocuments,
    downloadInternshipCertificate,
    proxyVideo
};
