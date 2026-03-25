const Course = require('../models/Course');
const User = require('../models/User');
const Enrollment = require('../models/Enrollment');
const Quiz = require('../models/Quiz');
const Payment = require('../models/Payment');
const Certificate = require('../models/Certificate');
const InternshipOffer = require('../models/InternshipOffer');
const InternshipCertificate = require('../models/InternshipCertificate');
const sendEmail = require('../services/emailService');
const { issueCertificate } = require('../services/certificateService');
const { issueInternshipOffer, issueInternshipCertificate } = require('../services/internshipDocumentService');
const { uploadVideoFile, deleteVideoFile } = require('../services/videoStorageService');
const crypto = require('crypto'); // For random password
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const inferLocalVideoSize = (url = '') => {
    if (!url || !url.startsWith('/uploads/')) return 0;
    const localPath = path.join(__dirname, '..', 'public', url.replace(/^\//, ''));
    if (!fs.existsSync(localPath)) return 0;
    try {
        return fs.statSync(localPath).size || 0;
    } catch {
        return 0;
    }
};

const getQuizTrackingSummary = (enrollment) => {
    const attempts = enrollment.progress?.quizAttempts || [];
    const latestByQuiz = new Map();

    attempts.forEach((attempt) => {
        if (!attempt.quizId) return;
        const key = String(attempt.quizId);
        const current = latestByQuiz.get(key);
        if (!current || new Date(attempt.attemptedAt || 0) > new Date(current.attemptedAt || 0)) {
            latestByQuiz.set(key, attempt);
        }
    });

    const latest = Array.from(latestByQuiz.values());
    return {
        totalAttempts: attempts.length,
        passed: latest.filter(a => a.passed).length,
        failed: latest.filter(a => !a.passed).length,
        latestResults: latest.map(a => ({
            quizId: a.quizId,
            score: a.score,
            totalQuestions: a.totalQuestions || 0,
            correctAnswers: a.correctAnswers || 0,
            passed: a.passed,
            attemptedAt: a.attemptedAt
        }))
    };
};

// @desc    Create a new course
// @route   POST /api/admin/courses
// @access  Private/Admin
// Helper: Validate Program for Publishing
const validateProgram = (data) => {
    const errors = [];

    // 1. Basic Details
    if (!data.title) errors.push("Program title is required");
    if (!data.description) errors.push("Description is required");
    if (!data.type) errors.push("Program type is required");
    if (!data.level) errors.push("Difficulty level is required");
    if (!data.duration) errors.push("Duration is required");

    // 2. Price Logic
    if (data.type !== 'free') {
        if (!data.price || data.price <= 0) errors.push("Price > 0 is required for paid programs");
    } else {
        if (data.price > 0) errors.push("Free programs must have price = 0");
    }

    // 3. Module & Content Logic (Common for all except Internship? User said Internship doesn't need videos)
    // "INTERNSHIP PROGRAM (No videos)"
    if (data.type !== 'internship') {
        if (!data.modules || data.modules.length === 0) {
            errors.push("At least one module is required");
        } else {
            let hasContent = false;
            data.modules.forEach((mod, idx) => {
                if (!mod.content || mod.content.length === 0) {
                    errors.push(`Module ${idx + 1} (${mod.title}) is empty`);
                } else {
                    hasContent = true;
                    // Check for at least one video if it's a video-based program
                    // User said: "At least 1 module... Each module must contain: At least 1 video" 
                    // Wait, "Each module must contain: At least 1 video"? Or just "At least 1 module"?
                    // User said: "At least 1 module... Each module must contain: At least 1 video". 
                    // Let's enforce strict rule: Every module must have at least one video (or maybe content?).
                    // Let's assume "At least one item of content" is the hard rule, and "At least 1 video" implies the program must have content.
                    // Actually, the requirement says: "Each module must contain: At least 1 video". 
                    // This is quite strict. Let's verify if `type` is video based.
                    // "VIDEO-BASED PROGRAMS (Free / Certification / Professional)" -> Yes.

                    const hasVideo = mod.content.some(c => c.type === 'video');
                    if (!hasVideo) errors.push(`Module ${idx + 1} must contain at least one video`);

                    const videoCount = mod.content.filter(c => c.type === 'video').length;
                    if (videoCount > 1) errors.push(`Module ${idx + 1} can contain only one video`);
                }
            });
            if (!hasContent) errors.push("Program must have content");
        }
    }

    // 4. Certification specific
    if (data.type === 'certification') {
        if (!data.certificateTemplate) {
            errors.push("Certification programs must have a certificate background image.");
        }
    }

    // 5. Internship Logic
    if (data.type === 'internship') {
        if (!data.internshipOfferTemplate && !data.internshipTemplate) {
            // Allow saving as draft without templates — only block publish
        }
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};

const validateSingleVideoPerModule = (modules = []) => {
    const errors = [];
    modules.forEach((mod, idx) => {
        const count = (mod.content || []).filter((item) => item.type === 'video').length;
        if (count > 1) {
            errors.push(`Module ${idx + 1} has ${count} videos. Only one video is allowed per module.`);
        }
    });
    return errors;
};

// @desc    Create a new course
// @route   POST /api/admin/courses
// @access  Private/Admin
const createCourse = async (req, res) => {
    try {
        const { title, description, type, level, duration, price, videos, modules, image, certificateTemplate, internshipTemplate, internshipOfferTemplate, internshipCertificateTemplate, startDate, endDate, status } = req.body;

        const moduleErrors = validateSingleVideoPerModule(modules || []);
        if (moduleErrors.length > 0) {
            return res.status(400).json({
                message: 'Invalid module video structure',
                errors: moduleErrors
            });
        }

        // Generate Program Code
        const prefixes = {
            'free': 'FC',
            'certification': 'CP',
            'professional': 'PMC',
            'internship': 'IP'
        };
        const prefix = prefixes[type] || 'PROG';
        const randomNum = Math.floor(10000 + Math.random() * 90000); // 5 digit random number
        const programCode = `${prefix}-${randomNum}`; // e.g. FC-12345

        let finalStatus = status || 'draft';
        let isPublished = finalStatus === 'published';

        // Validation if trying to publish
        if (finalStatus === 'published') {
            const validation = validateProgram(req.body);
            if (!validation.isValid) {
                return res.status(400).json({
                    message: "Cannot publish invalid program",
                    errors: validation.errors
                });
            }
        }

        const course = await Course.create({
            programCode,
            title,
            description,
            type,
            level,
            duration,
            price,
            image: image || '',
            certificateTemplate: certificateTemplate || '',
            internshipTemplate: internshipTemplate || '',
            internshipOfferTemplate: internshipOfferTemplate || '',
            internshipCertificateTemplate: internshipCertificateTemplate || '',
            modules: modules || [],
            videos: videos || [], // Legacy support
            status: finalStatus,
            isPublished: isPublished,
            createdBy: req.user._id
        });

        // Link Quizzes
        await linkQuizzesToCourse(course._id, modules);

        res.status(201).json(course);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update a course
// @route   PUT /api/admin/courses/:id
// @access  Private/Admin
const updateCourse = async (req, res) => {
    try {
        const { status, modules, certificateTemplate, internshipTemplate, internshipOfferTemplate, internshipCertificateTemplate } = req.body;

        if (modules) {
            const moduleErrors = validateSingleVideoPerModule(modules);
            if (moduleErrors.length > 0) {
                return res.status(400).json({
                    message: 'Invalid module video structure',
                    errors: moduleErrors
                });
            }
        }

        let updateData = { ...req.body };

        if (status === 'published') {
            const validation = validateProgram(req.body);
            if (!validation.isValid) {
                return res.status(400).json({
                    message: "Cannot publish invalid program",
                    errors: validation.errors
                });
            }
            updateData.isPublished = true;
            updateData.status = 'published';
        } else if (status === 'draft' || status === 'archived') {
            updateData.isPublished = false;
        } else {
            const currentCourse = await Course.findById(req.params.id);
            if (currentCourse && (currentCourse.status === 'published' || currentCourse.isPublished)) {
                updateData.isPublished = true;
                updateData.status = 'published';
            }
        }

        const course = await Course.findById(req.params.id);

        if (!course) {
            return res.status(404).json({ message: 'Course not found' });
        }

        // Check if template changed
        const templateChanged = (certificateTemplate && course.certificateTemplate !== certificateTemplate) || 
                          (internshipTemplate && course.internshipTemplate !== internshipTemplate) ||
                          (internshipOfferTemplate && course.internshipOfferTemplate !== internshipOfferTemplate) ||
                          (internshipCertificateTemplate && course.internshipCertificateTemplate !== internshipCertificateTemplate);

        const updatedCourse = await Course.findByIdAndUpdate(req.params.id, updateData, {
            new: true,
        });

        // Link Quizzes
        if (modules) {
            await linkQuizzesToCourse(updatedCourse._id, modules);
        }

        // ── Regular certificate template changed ───────────────────────
        const certTemplateChanged = certificateTemplate && course.certificateTemplate !== certificateTemplate;
        // ── Internship offer letter template changed ───────────────────
        const offerTemplateChanged = internshipOfferTemplate && course.internshipOfferTemplate !== internshipOfferTemplate;
        // ── Internship completion cert template changed ────────────────
        const internCertTemplateChanged = internshipCertificateTemplate && course.internshipCertificateTemplate !== internshipCertificateTemplate;

        // Asynchronously regenerate docs (non-blocking — don't delay the API response)
        if (certTemplateChanged) {
            console.log(`[updateCourse] Certificate template changed – regenerating all completed certs...`);
            Enrollment.find({ courseId: updatedCourse._id, status: 'completed' })
                .then(async (enrollments) => {
                    for (const e of enrollments) {
                        try { await issueCertificate(e.userId, e.courseId); }
                        catch (err) { console.error(`Cert regen failed for user ${e.userId}:`, err.message); }
                    }
                }).catch(err => console.error('Cert regen lookup error:', err.message));
        }

        if (offerTemplateChanged) {
            console.log(`[updateCourse] Internship offer template changed – regenerating all offer letters...`);
            Enrollment.find({ courseId: updatedCourse._id })
                .then(async (enrollments) => {
                    for (const e of enrollments) {
                        try { await issueInternshipOffer(e.userId, e.courseId); }
                        catch (err) { console.error(`Offer regen failed for user ${e.userId}:`, err.message); }
                    }
                }).catch(err => console.error('Offer regen lookup error:', err.message));
        }

        if (internCertTemplateChanged) {
            console.log(`[updateCourse] Internship cert template changed – regenerating completed certs...`);
            Enrollment.find({ courseId: updatedCourse._id, status: 'completed' })
                .then(async (enrollments) => {
                    for (const e of enrollments) {
                        try { await issueInternshipCertificate(e.userId, e.courseId); }
                        catch (err) { console.error(`Intern cert regen failed for user ${e.userId}:`, err.message); }
                    }
                }).catch(err => console.error('Intern cert regen lookup error:', err.message));
        }

        res.json(updatedCourse);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete a course
// @route   DELETE /api/admin/courses/:id
// @access  Private/Admin
const deleteCourse = async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);

        if (!course) {
            return res.status(404).json({ message: 'Course not found' });
        }

        // Ideally, check for enrollments before deleting?
        // For now, allow force delete or cascade? 
        // Mongoose middleware might trigger cascade if configured. 
        // Let's just delete the course.

        await Course.findByIdAndDelete(req.params.id);

        res.json({ message: 'Course removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all courses (Admin View)
// @route   GET /api/admin/courses
// @access  Private/Admin
const getAllCourses = async (req, res) => {
    try {
        const courses = await Course.find({}).sort({ createdAt: -1 });
        res.json(courses);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get single course by ID
// @route   GET /api/admin/courses/:id
// @access  Private/Admin
const getCourseById = async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) {
            return res.status(404).json({ message: 'Course not found' });
        }
        res.json(course);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all students
// @route   GET /api/admin/students
// @access  Private/Admin
const getAllStudents = async (req, res) => {
    try {
        const students = await User.find({ role: 'student' }).select('-password').sort({ createdAt: -1 });
        res.json({
            success: true,
            count: students.length,
            data: students
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create a new student (Auto-generate password)
// @route   POST /api/admin/create-student
// @access  Private/Admin
const createStudent = async (req, res) => {
    const {
        name, fullName,
        email,
        phone, mobile,
        collegeName, institution,
        collegeDetails, regNo, department, year,
        personalAddress, city, state, pincode,
        program, type
    } = req.body;

    const finalName = fullName || name || (email ? email.split('@')[0] : 'Student');
    const finalPhone = mobile || phone || '0000000000';
    const finalCollegeName = institution || collegeName || 'Not Provided';

    console.log('DEBUG: createStudent payload:', { finalName, email, finalPhone, finalCollegeName });

    // Construct collegeDetails if parts are provided
    let finalCollegeDetails = collegeDetails;
    if (regNo || department || year) {
        finalCollegeDetails = `Reg No: ${regNo || 'N/A'}, Dept: ${department || 'N/A'}, Year: ${year || 'N/A'}`;
    } else {
        finalCollegeDetails = finalCollegeDetails || 'Not Provided';
    }

    // Construct personalAddress if parts are provided
    let finalPersonalAddress = personalAddress;
    if (city || state || pincode) {
        const addressParts = [city, state, pincode].filter(Boolean);
        finalPersonalAddress = addressParts.length > 0 ? addressParts.join(', ') : 'Not Provided';
    } else {
        finalPersonalAddress = finalPersonalAddress || 'Not Provided';
    }

    try {
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Generate random password
        const password = crypto.randomBytes(8).toString('hex');

        const user = await User.create({
            name: finalName,
            email,
            password, // Hook will hash it
            tempPassword: password, // For admin to view
            phone: finalPhone,
            collegeName: finalCollegeName,
            collegeDetails: finalCollegeDetails,
            personalAddress: finalPersonalAddress,
            role: 'student',
            program: program || 'N/A',
            programType: type || 'Certification Course'
        });

        // Send Email
        const htmlMessage = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                <h2 style="color: #007bff; text-align: center;">Welcome to Petluri Edutech LMS</h2>
                <p>Hello <strong>${finalName}</strong>,</p>
                <p>Your student account has been created successfully by the administrator. You have been invited to join <strong>${program || 'our learning platform'}</strong>.</p>
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Login URL:</strong> <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/login" style="color: #007bff;">Click Here to Login</a></p>
                    <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
                </div>
                <p style="color: #666; font-size: 14px;">Please use the email above to sign in via the OTP sent to your mailbox.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="font-size: 12px; color: #777; text-align: center;">&copy; 2026 Petluri Edutech LMS. All rights reserved.</p>
            </div>
        `;

        try {
            await sendEmail({
                email: user.email,
                subject: 'Your Petluri Edutech Student Account',
                html: htmlMessage,
                message: `You have been invited to join ${program || 'our learning platform'}. Login at: ${process.env.CLIENT_URL || 'http://localhost:5173'}/login`
            });
        } catch (emailError) {
            console.error('Email send failed', emailError);
        }

        res.status(201).json({
            message: 'Student created and email sent',
            user: { _id: user._id, name: user.name, email: user.email }
        });

    } catch (error) {
        console.error('ERROR in createStudent:', error);
        res.status(500).json({
            success: false,
            message: error.message,
            error: error.errors
        });
    }
};

// @desc    Delete a student
// @route   DELETE /api/admin/students/:id
// @access  Private/Admin
const deleteStudent = async (req, res) => {
    try {
        const student = await User.findById(req.params.id);

        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        if (student.role !== 'student') {
            return res.status(403).json({ message: 'Cannot delete non-student users' });
        }

        // Delete associated enrollments (optional but keeps DB clean)
        const Enrollment = require('../models/Enrollment');
        await Enrollment.deleteMany({ userId: student._id });

        await student.onDelete ? student.onDelete() : null; // If there's a hook
        await User.findByIdAndDelete(req.params.id);

        res.json({ message: 'Student and associated enrollments deleted successfully' });
    } catch (error) {
        console.error('ERROR in deleteStudent:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Manually enroll a student
// @route   POST /api/admin/enroll-student
// @access  Private/Admin
const enrollStudent = async (req, res) => {
    const { userId, courseId } = req.body;

    try {
        const enrollmentExists = await Enrollment.findOne({ userId, courseId });

        if (enrollmentExists) {
            return res.status(400).json({ message: 'Student already enrolled' });
        }

        const enrollment = await Enrollment.create({
            userId,
            courseId,
            status: 'active'
        });

        res.status(201).json(enrollment);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    View Student Credentials (requires admin validation)
// @route   POST /api/admin/enrollments/:id/credentials
// @access  Private/Admin
const getStudentCredentials = async (req, res) => {
    try {
        const { adminPassword } = req.body;
        const studentId = req.params.id;

        // Verify admin password
        const adminUser = await User.findById(req.user._id).select('+password');
        if (!adminUser) return res.status(401).json({ message: 'Admin not found' });

        const isMatch = await adminUser.matchPassword(adminPassword);
        if (!isMatch) return res.status(401).json({ message: 'Invalid admin password' });

        // Retrieve student
        const student = await User.findById(studentId).select('+tempPassword');
        if (!student) return res.status(404).json({ message: 'Student not found' });

        res.json({
            email: student.email,
            password: student.tempPassword || 'Password intentionally removed or not generated'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to retrieve credentials', error: error.message });
    }
};

// @desc    Resend Student Credentials
// @route   POST /api/admin/enrollments/:id/resend-credentials
// @access  Private/Admin
const resendStudentCredentials = async (req, res) => {
    try {
        const studentId = req.params.id;
        const student = await User.findById(studentId).select('+tempPassword');

        if (!student) return res.status(404).json({ message: 'Student not found' });

        const rawPassword = student.tempPassword || 'Not Available (User may have reset it)';

        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            return res.status(500).json({ message: 'Email service is not configured on the server.' });
        }

        const message = `
            <h2>Hello ${student.name},</h2>
            <p>Your login credentials have been requested to be resent to you.</p>
            <ul>
                <li><strong>Email:</strong> ${student.email}</li>
                <li><strong>Password/Secret:</strong> ${rawPassword}</li>
            </ul>
            <p>Please log in and ensure your information is secure.</p>
            <p>Regards,<br>Petluri Edutech</p>
        `;

        await sendEmail({
            email: student.email,
            subject: 'Your Petluri Edutech Login Credentials',
            html: message,
            message: `Email: ${student.email}, Password: ${rawPassword}`
        });

        res.json({ message: 'Credentials email sent to student successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to resend credentials', error: error.message });
    }
};

// @desc    Create a quiz
// @route   POST /api/admin/create-quiz
// @access  Private/Admin
const createQuiz = async (req, res) => {
    try {
        const { title, courseId, questions, passingScore, timeLimit } = req.body;

        const quiz = await Quiz.create({
            title,
            courseId,
            questions,
            passingScore,
            timeLimit
        });

        // Link quiz to course if courseId is provided
        if (courseId) {
            await Course.findByIdAndUpdate(courseId, {
                $push: { quizzes: quiz._id }
            });
        }

        res.status(201).json(quiz);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Upload Course Asset (Image or PDF Template)
// @route   POST /api/admin/upload-video   (images)
// @route   POST /api/admin/upload-template (PDF templates)
// @access  Private/Admin
const uploadVideo = async (req, res) => {
    try {
        console.log('Upload payload debug:', {
            fileField: req.file?.fieldname,
            fileName: req.file?.originalname,
            mimeType: req.file?.mimetype,
            body: req.body
        });

        if (!req.file) {
            return res.status(400).json({
                message: 'No file uploaded. Ensure multipart/form-data is sent with the expected field name.'
            });
        }

        if ((req.file.mimetype || '').startsWith('video/')) {
            const uploaded = await uploadVideoFile(req.file);
            return res.json({
                message: 'File uploaded successfully',
                url: uploaded.url,
                filename: uploaded.fileName,
                fileSizeBytes: uploaded.fileSizeBytes,
                storageProvider: uploaded.provider
            });
        }

        // Derive the correct public URL from the actual saved path.
        // req.file.path might be like `public\uploads\templates\file.pdf`
        const normalizedPath = req.file.path.replace(/\\/g, '/');
        // Extract everything after 'public/'
        const match = normalizedPath.match(/public\/(.*)/);
        const relativePath = match ? match[1] : normalizedPath;
        const fileUrl = `/${relativePath}`;

        res.json({
            message: 'File uploaded successfully',
            url: fileUrl,
            filename: req.file.filename
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    List uploaded videos (optionally by course)
// @route   GET /api/admin/videos
// @access  Private/Admin
const getAdminVideos = async (req, res) => {
    try {
        const { courseId } = req.query;
        const query = courseId ? { _id: courseId } : {};

        const courses = await Course.find(query).select('title modules');
        const rows = [];

        courses.forEach((course) => {
            (course.modules || []).forEach((mod) => {
                const video = (mod.content || []).find((item) => item.type === 'video' && item.url);
                if (!video) return;

                rows.push({
                    courseId: course._id,
                    courseTitle: course.title,
                    moduleId: mod._id,
                    moduleTitle: mod.title,
                    videoId: video._id,
                    videoTitle: video.title,
                    url: video.url,
                    fileName: video.fileName || video.title,
                    fileSizeBytes: video.fileSizeBytes || inferLocalVideoSize(video.url),
                    uploadedAt: video.uploadedAt || null,
                    storageProvider: video.storageProvider || 'local'
                });
            });
        });

        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Upload/replace module video
// @route   POST /api/admin/videos/upload
// @access  Private/Admin
const uploadModuleVideo = async (req, res) => {
    try {
        const { courseId, moduleId, duration } = req.body;

        if (!courseId || !moduleId) {
            return res.status(400).json({ message: 'courseId and moduleId are required' });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'Video file is required' });
        }

        const course = await Course.findById(courseId);
        if (!course) return res.status(404).json({ message: 'Course not found' });

        const moduleDoc = (course.modules || []).find((mod) => String(mod._id) === String(moduleId));
        if (!moduleDoc) return res.status(404).json({ message: 'Module not found in this course' });

        const uploaded = await uploadVideoFile(req.file);

        const existingVideoIndex = (moduleDoc.content || []).findIndex((item) => item.type === 'video');
        if (existingVideoIndex >= 0) {
            const existingVideo = moduleDoc.content[existingVideoIndex];
            await deleteVideoFile({
                provider: existingVideo.storageProvider,
                key: existingVideo.storageKey,
                url: existingVideo.url
            });

            moduleDoc.content[existingVideoIndex] = {
                ...moduleDoc.content[existingVideoIndex].toObject(),
                type: 'video',
                title: req.body.title || req.file.originalname.replace(/\.[^/.]+$/, ''),
                url: uploaded.url,
                duration: duration || moduleDoc.content[existingVideoIndex].duration || '00:00',
                fileName: uploaded.fileName,
                fileSizeBytes: uploaded.fileSizeBytes,
                storageProvider: uploaded.provider,
                storageKey: uploaded.key,
                uploadedAt: new Date()
            };
        } else {
            moduleDoc.content.push({
                type: 'video',
                title: req.body.title || req.file.originalname.replace(/\.[^/.]+$/, ''),
                url: uploaded.url,
                duration: duration || '00:00',
                fileName: uploaded.fileName,
                fileSizeBytes: uploaded.fileSizeBytes,
                storageProvider: uploaded.provider,
                storageKey: uploaded.key,
                uploadedAt: new Date()
            });
        }

        await course.save();

        res.json({
            message: 'Video uploaded successfully',
            courseId,
            moduleId,
            url: uploaded.url,
            fileName: uploaded.fileName,
            fileSizeBytes: uploaded.fileSizeBytes,
            storageProvider: uploaded.provider
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete module video
// @route   DELETE /api/admin/videos/:courseId/:moduleId
// @access  Private/Admin
const deleteModuleVideo = async (req, res) => {
    try {
        const { courseId, moduleId } = req.params;
        const course = await Course.findById(courseId);
        if (!course) return res.status(404).json({ message: 'Course not found' });

        const moduleDoc = (course.modules || []).find((mod) => String(mod._id) === String(moduleId));
        if (!moduleDoc) return res.status(404).json({ message: 'Module not found in this course' });

        const existingVideoIndex = (moduleDoc.content || []).findIndex((item) => item.type === 'video');
        if (existingVideoIndex < 0) {
            return res.status(404).json({ message: 'No video found in this module' });
        }

        const existingVideo = moduleDoc.content[existingVideoIndex];
        await deleteVideoFile({
            provider: existingVideo.storageProvider,
            key: existingVideo.storageKey,
            url: existingVideo.url
        });

        moduleDoc.content = moduleDoc.content.filter((_, idx) => idx !== existingVideoIndex);
        await course.save();

        res.json({ message: 'Module video deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


// @desc    Get all enrollments
// @route   GET /api/admin/enrollments
// @access  Private/Admin
const getAllEnrollments = async (req, res) => {
    try {
        const enrollments = await Enrollment.find({})
            .populate('userId', 'name email phone collegeName collegeDetails personalAddress')
            .populate('courseId', 'title type price programCode')
            .sort({ createdAt: -1 })
            .lean();

        // Fetch corresponding payments for each enrollment
        const enrichedEnrollments = await Promise.all(enrollments.map(async (enrollment) => {
            const payment = await Payment.findOne({
                userId: enrollment.userId?._id,
                courseId: enrollment.courseId?._id
            }).sort({ createdAt: -1 }).lean();

            return {
                ...enrollment,
                paymentDetails: payment || null,
                completionStatus: enrollment.status === 'completed' ? 'completed' : 'not completed',
                feedback: enrollment.feedback || { submitted: false, rating: null, comments: '' },
                quizTracking: getQuizTrackingSummary(enrollment)
            };
        }));

        res.json(enrichedEnrollments);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get detailed monitoring for a selected enrollment and student's full learning map
// @route   GET /api/admin/enrollments/:id/details
// @access  Private/Admin
const getEnrollmentMonitoringDetails = async (req, res) => {
    try {
        const selectedEnrollment = await Enrollment.findById(req.params.id)
            .populate('userId', 'name email phone collegeName collegeDetails personalAddress')
            .populate('courseId', 'title type level duration modules');

        if (!selectedEnrollment) {
            return res.status(404).json({ message: 'Enrollment not found' });
        }

        const studentEnrollments = await Enrollment.find({ userId: selectedEnrollment.userId._id })
            .populate('courseId', 'title type level duration')
            .sort({ enrolledAt: -1 });

        const courseProgressMap = studentEnrollments.map((enrollment) => ({
            enrollmentId: enrollment._id,
            courseId: enrollment.courseId?._id,
            courseTitle: enrollment.courseId?.title || 'Unknown Course',
            courseType: enrollment.courseId?.type || 'unknown',
            completionPercentage: enrollment.completionPercentage || 0,
            status: enrollment.status,
            completionStatus: enrollment.status === 'completed' ? 'completed' : 'not completed',
            feedbackSubmitted: Boolean(enrollment.feedback?.submitted),
            feedbackRating: enrollment.feedback?.rating || null,
            quizTracking: getQuizTrackingSummary(enrollment)
        }));

        res.json({
            selectedEnrollment: {
                ...selectedEnrollment.toObject(),
                completionStatus: selectedEnrollment.status === 'completed' ? 'completed' : 'not completed',
                feedback: selectedEnrollment.feedback || { submitted: false },
                quizTracking: getQuizTrackingSummary(selectedEnrollment)
            },
            student: selectedEnrollment.userId,
            studentCourseProgress: courseProgressMap
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Export enrollments for a selected course as Excel
// @route   GET /api/admin/enrollments/export/:courseId
// @access  Private/Admin
const exportCourseEnrollments = async (req, res) => {
    try {
        const { courseId } = req.params;
        const course = await Course.findById(courseId).select('title');
        if (!course) {
            return res.status(404).json({ message: 'Course not found' });
        }

        const enrollments = await Enrollment.find({ courseId })
            .populate('userId', 'name email phone collegeName collegeDetails personalAddress')
            .populate('courseId', 'title')
            .sort({ enrolledAt: -1 });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Enrollments');

        worksheet.columns = [
            { header: 'Student Name', key: 'studentName', width: 24 },
            { header: 'Student Email', key: 'studentEmail', width: 32 },
            { header: 'Phone', key: 'phone', width: 18 },
            { header: 'College/Organization', key: 'collegeName', width: 28 },
            { header: 'Course Name', key: 'courseName', width: 30 },
            { header: 'Enrollment Status', key: 'enrollmentStatus', width: 20 },
            { header: 'Progress %', key: 'progressPercentage', width: 14 },
            { header: 'Completion Status', key: 'completionStatus', width: 20 },
            { header: 'Feedback Submitted', key: 'feedbackSubmitted', width: 20 },
            { header: 'Feedback Rating', key: 'feedbackRating', width: 16 },
            { header: 'Feedback Comments', key: 'feedbackComments', width: 50 }
        ];

        enrollments.forEach((enrollment) => {
            worksheet.addRow({
                studentName: enrollment.userId?.name || 'Unknown',
                studentEmail: enrollment.userId?.email || '',
                phone: enrollment.userId?.phone || '',
                collegeName: enrollment.userId?.collegeName || '',
                courseName: enrollment.courseId?.title || course.title,
                enrollmentStatus: enrollment.status,
                progressPercentage: enrollment.completionPercentage || 0,
                completionStatus: enrollment.status === 'completed' ? 'completed' : 'not completed',
                feedbackSubmitted: enrollment.feedback?.submitted ? 'Yes' : 'No',
                feedbackRating: enrollment.feedback?.rating || '',
                feedbackComments: enrollment.feedback?.comments || ''
            });
        });

        worksheet.getRow(1).font = { bold: true };
        worksheet.views = [{ state: 'frozen', ySplit: 1 }];

        const safeTitle = String(course.title || 'course').replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const fileName = `${safeTitle}_enrollments.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all quizzes
// @route   GET /api/admin/quizzes
// @access  Private/Admin
const getAllQuizzes = async (req, res) => {
    try {
        const quizzes = await Quiz.find().populate('courseId', 'title');
        res.json(quizzes);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get dashboard statistics
// @route   GET /api/admin/dashboard-stats
// @access  Private/Admin
const getDashboardStats = async (req, res) => {
    try {
        // 1. Total Students
        const totalStudents = await User.countDocuments({ role: 'student' });

        // 2. Total Enrollments
        const totalEnrollments = await Enrollment.countDocuments({});

        // 3. Enrollments by Type
        const enrollmentsByType = await Enrollment.aggregate([
            {
                $lookup: {
                    from: 'courses',
                    localField: 'courseId',
                    foreignField: '_id',
                    as: 'course'
                }
            },
            { $unwind: '$course' },
            {
                $group: {
                    _id: '$course.type',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Format enrollmentsByType into an easier object
        const enrollmentStats = {
            free: 0,
            certification: 0,
            professional: 0,
            internship: 0
        };
        enrollmentsByType.forEach(stat => {
            if (stat._id) enrollmentStats[stat._id] = stat.count;
        });

        // 4. Total Active & Draft Courses
        const totalActiveCourses = await Course.countDocuments({ isPublished: true });
        const totalDraftCourses = await Course.countDocuments({ isPublished: false });
        const totalCertificates = await Certificate.countDocuments({});


        // 5. Top 5 High Enrollment Courses
        const topCourses = await Enrollment.aggregate([
            {
                $group: {
                    _id: '$courseId',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 5 },
            {
                $lookup: {
                    from: 'courses',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'course'
                }
            },
            { $unwind: '$course' },
            {
                $project: {
                    _id: 0,
                    courseId: '$_id',
                    title: '$course.title',
                    count: 1
                }
            }
        ]);

        // 6. Total Video Hours
        // Fetching all courses to calculate duration in JS as it's safer for mixed formats
        const courses = await Course.find({}, 'videos.duration modules');
        let totalSeconds = 0;

        courses.forEach(course => {
            // Legacy videos
            if (course.videos && course.videos.length > 0) {
                course.videos.forEach(video => {
                    if (video.duration) {
                        const parts = video.duration.split(':').map(Number);
                        if (parts.length === 2) {
                            totalSeconds += parts[0] * 60 + parts[1];
                        } else if (parts.length === 3) {
                            totalSeconds += parts[0] * 3600 + parts[1] * 60 + parts[2];
                        }
                    }
                });
            }

            // New modules
            if (course.modules && course.modules.length > 0) {
                course.modules.forEach(module => {
                    if (module.content && module.content.length > 0) {
                        module.content.forEach(item => {
                            if (item.type === 'video' && item.duration) {
                                const parts = item.duration.split(':').map(Number);
                                if (parts.length === 2) {
                                    totalSeconds += parts[0] * 60 + parts[1];
                                } else if (parts.length === 3) {
                                    totalSeconds += parts[0] * 3600 + parts[1] * 60 + parts[2];
                                }
                            }
                        });
                    }
                });
            }
        });

        const totalHours = Math.round(totalSeconds / 3600);

        res.json({
            totalStudents,
            totalEnrollments,
            enrollmentStats,
            totalActiveCourses,
            totalDraftCourses,
            totalCertificates,
            totalHours,
            topCourses
        });

    } catch (error) {
        console.error("Dashboard stats error:", error);
        res.status(500).json({ message: error.message });
    }
};

// Helper to link quizzes to course
const linkQuizzesToCourse = async (courseId, modules) => {
    if (!modules || modules.length === 0) return;

    const quizIds = [];
    modules.forEach(mod => {
        if (mod.content) {
            mod.content.forEach(item => {
                if (item.type === 'quiz' && item.quizId) {
                    quizIds.push(item.quizId);
                }
            });
        }
    });

    if (quizIds.length > 0) {
        // Bulk update quizzes to set courseId
        await Quiz.updateMany(
            { _id: { $in: quizIds } },
            { $set: { courseId: courseId } }
        );
    }
};

// @desc    Get single quiz by ID
// @route   GET /api/admin/quizzes/:id
// @access  Private/Admin
const getQuizById = async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.id);
        if (!quiz) {
            return res.status(404).json({ message: 'Quiz not found' });
        }
        res.json(quiz);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update a quiz
// @route   PUT /api/admin/quizzes/:id
// @access  Private/Admin
const updateQuiz = async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.id);
        if (!quiz) {
            return res.status(404).json({ message: 'Quiz not found' });
        }

        const updatedQuiz = await Quiz.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
        });

        res.json(updatedQuiz);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update enrollment status (e.g., mark as completed)
// @route   PUT /api/admin/enrollments/:id/status
// @access  Private/Admin
const updateEnrollmentStatus = async (req, res) => {
    try {
        const { status } = req.body;

        // Validate status
        const allowedStatuses = ['enrolled', 'pending', 'completed'];
        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({ message: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}` });
        }

        const enrollment = await Enrollment.findById(req.params.id);

        if (!enrollment) {
            return res.status(404).json({ message: 'Enrollment not found' });
        }

        // Save status first to ensure the database record is updated
        enrollment.status = status;
        await enrollment.save();

        // If status is changed to completed and it wasn't completed before, issue document
        if (status === 'completed') {
            enrollment.completionPercentage = 100;
            enrollment.feedback = {
                ...(enrollment.feedback || {}),
                required: false
            };
            try {
                const course = await Course.findById(enrollment.courseId);
                if (course.type === 'internship') {
                    await issueInternshipCertificate(enrollment.userId, enrollment.courseId);
                } else {
                    await issueCertificate(enrollment.userId, enrollment.courseId);
                }
                
                // Update specific flag if needed, though dynamic generation handles it
                enrollment.certificateIssued = true;
                await enrollment.save();
            } catch (certError) {
                console.error('Document generation failed (non-fatal):', certError.message);
            }
        }

        res.json({
            message: `Enrollment marked as ${status}`,
            enrollment
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all certificates
// @route   GET /api/admin/certificates
// @access  Private/Admin
const getAllCertificates = async (req, res) => {
    try {
        const certificates = await Certificate.find({})
            .populate('userId', 'name email')
            .populate('courseId', 'title')
            .sort({ generatedDate: -1 });
        res.json(certificates);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Download Certificate (Dynamic)
// @route   GET /api/admin/certificates/:id/download
// @access  Private/Admin
const downloadCertificate = async (req, res) => {
    try {
        const certificate = await Certificate.findById(req.params.id);
        
        if (!certificate) {
            return res.status(404).json({ message: 'Certificate not found' });
        }

        // Generate on-the-fly
        console.log(`Dynamic download requested by admin for cert ${req.params.id}. Regenerating...`);
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

// @desc    Get all internship offer letters
// @route   GET /api/admin/internships/offers
// @access  Private/Admin
const getAllInternshipOffers = async (req, res) => {
    try {
        const offers = await InternshipOffer.find({})
            .populate('userId', 'name email phone')
            .populate('courseId', 'title')
            .sort({ issuedDate: -1 });
        res.json(offers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all internship completion certificates
// @route   GET /api/admin/internships/certificates
// @access  Private/Admin
const getAllInternshipCertificates = async (req, res) => {
    try {
        const certificates = await InternshipCertificate.find({})
            .populate('userId', 'name email phone')
            .populate('courseId', 'title')
            .sort({ issuedDate: -1 });
        res.json(certificates);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Download Internship Certificate (Dynamic)
// @route   GET /api/admin/internships/certificates/:id/download
// @access  Private/Admin
const downloadInternshipCertificate = async (req, res) => {
    try {
        const certificate = await InternshipCertificate.findById(req.params.id);
        
        if (!certificate) {
            return res.status(404).json({ message: 'Certificate not found' });
        }

        // Generate on-the-fly
        const { pdfBytes, fileName } = await issueInternshipCertificate(certificate.userId, certificate.courseId);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        res.send(Buffer.from(pdfBytes));

    } catch (error) {
        console.error('Download Error:', error.message);
        res.status(500).json({ message: error.message });
    }
};


module.exports = {
    createCourse,
    updateCourse,
    getAllCourses,
    getCourseById,
    getAllStudents,
    enrollStudent,
    getAllEnrollments,
    getEnrollmentMonitoringDetails,
    exportCourseEnrollments,
    updateEnrollmentStatus,
    getAllCertificates,
    createStudent,
    getStudentCredentials,
    resendStudentCredentials,
    createQuiz,
    getAllQuizzes,
    getQuizById,
    updateQuiz,
    getDashboardStats,
    uploadVideo,
    deleteCourse,
    deleteStudent,
    linkQuizzesToCourse,
    downloadCertificate,
    getAllInternshipOffers,
    getAllInternshipCertificates,
    downloadInternshipCertificate,
    getAdminVideos,
    uploadModuleVideo,
    deleteModuleVideo
};
