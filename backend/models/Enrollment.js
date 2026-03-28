const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema({
    enrollmentId: {
        type: String,
        unique: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true
    },
    enrolledAt: {
        type: Date,
        default: Date.now
    },
    progress: {
        completedVideos: [{ type: String }], // Store video IDs or URLs unique to video
        videoProgress: [{
            moduleId: { type: String, required: true },
            videoId: { type: String, required: true },
            watchedDuration: { type: Number, default: 0 },
            totalDuration: { type: Number, default: 0 },
            lastPosition: { type: Number, default: 0 },
            completed: { type: Boolean, default: false },
            playbackRate: { type: Number, default: 1 },
            accessCount: { type: Number, default: 0 },
            firstAccessedAt: { type: Date, default: null },
            lastWatchedAt: { type: Date, default: Date.now }
        }],
        quizAttempts: [{
            quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz' },
            score: Number,
            totalQuestions: Number,
            correctAnswers: Number,
            passed: Boolean,
            answers: { type: mongoose.Schema.Types.Mixed },
            attemptedAt: { type: Date, default: Date.now }
        }]
    },
    completionPercentage: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['enrolled', 'pending', 'completed'],
        default: 'enrolled'
    },
    certificateIssued: {
        type: Boolean,
        default: false
    },
    feedback: {
        required: {
            type: Boolean,
            default: false
        },
        submitted: {
            type: Boolean,
            default: false
        },
        rating: {
            type: Number,
            min: 1,
            max: 5,
            default: null
        },
        comments: {
            type: String,
            default: ''
        },
        submittedAt: {
            type: Date,
            default: null
        }
    }
});

// Prevent duplicate enrollment
enrollmentSchema.index({ userId: 1, courseId: 1 }, { unique: true });

module.exports = mongoose.model('Enrollment', enrollmentSchema);
