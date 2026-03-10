const Enrollment = require('../models/Enrollment');
const Course = require('../models/Course');

/**
 * Middleware to check if a student has active access to a course
 */
const courseAccess = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const courseId = req.params.id || req.body.courseId;

        if (!courseId) {
            return res.status(400).json({ message: 'Course ID is required for access check' });
        }

        const course = await Course.findById(courseId);
        if (!course) {
            return res.status(404).json({ message: 'Course not found' });
        }

        // Admins have access to everything
        if (req.user.role === 'admin') {
            return next();
        }

        // Check enrollment
        const enrollment = await Enrollment.findOne({ userId, courseId });

        if (!enrollment) {
            return res.status(403).json({ 
                message: 'Access denied. You are not enrolled in this course.',
                notEnrolled: true 
            });
        }

        // Additional checks can be added here (e.g., status must be 'active')
        if (enrollment.status === 'blocked') {
            return res.status(403).json({ message: 'Access denied. Your enrollment is currently blocked.' });
        }

        req.enrollment = enrollment; // Attach enrollment to request for further use
        next();
    } catch (error) {
        res.status(500).json({ message: 'Error checking course access', error: error.message });
    }
};

module.exports = courseAccess;
