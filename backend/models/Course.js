const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
    title: { type: String, required: true },
    videoUrl: { type: String, required: true },
    order: { type: Number, required: true },
    duration: { type: String, required: true } // e.g., "10:30"
});

const courseSchema = new mongoose.Schema({
    programId: {
        type: String,
        unique: true,
        index: true
    },
    programCode: {
        type: String,
        unique: true,
        sparse: true
    },
    title: {
        type: String,
        required: [true, 'Please add a course title'],
        trim: true,
        maxlength: 100
    },
    description: {
        type: String,
        maxlength: 1000
    },
    type: {
        type: String,
        required: true,
        enum: ['free', 'certification', 'professional', 'internship']
    },
    level: {
        type: String,
        required: true,
        enum: ['Beginner', 'Intermediate', 'Advanced']
    },
    duration: {
        type: String
    },
    price: {
        type: Number,
        default: 0
    },
    image: {
        type: String, // URL to course banner
        default: ''
    },
    certificateTemplate: {
        type: String, // URL to certificate background
        default: ''
    },
    internshipTemplate: {
        type: String, // Deprecated: URL to internship letter/certificate template
        default: ''
    },
    internshipOfferTemplate: {
        type: String, // URL to internship offer letter template PDF
        default: ''
    },
    internshipCertificateTemplate: {
        type: String, // URL to internship completion certificate template PDF
        default: ''
    },
    startDate: {
        type: Date, // Internship start date
        default: null
    },
    endDate: {
        type: Date, // Internship end date
        default: null
    },
    modules: [{
        moduleNumber: { type: Number },
        title: { type: String, required: true },
        description: { type: String }, // Optional for drafts
        content: [{
            videoNumber: { type: Number },
            quizNumber: { type: Number },
            type: { type: String, enum: ['video', 'quiz'], required: true },
            title: { type: String, required: true },
            url: { type: String }, // For video
            duration: { type: String }, // For video
            fileName: { type: String },
            fileSizeBytes: { type: Number, default: 0 },
            storageProvider: { type: String, enum: ['local', 'backblaze'], default: 'local' },
            storageKey: { type: String, default: '' },
            uploadedAt: { type: Date, default: null },
            videoId: { type: String, default: '' }, // Structured ID e.g. PROG-M1-V1
            quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz' } // For quiz
        }]
    }],
    videos: [videoSchema], // Deprecated but kept for backward compatibility
    quizzes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Quiz'
    }], // Deprecated but kept for backward compatibility
    status: {
        type: String,
        enum: ['draft', 'published', 'archived'],
        default: 'draft'
    },
    isPublished: {
        type: Boolean,
        default: false
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

courseSchema.pre('save', async function () {
    // Generate Program ID for new courses
    if (this.isNew && !this.programId) {
        try {
            const { generateProgramId } = require('../services/idService');
            this.programId = await generateProgramId(this.type);
        } catch (error) {
            throw error;
        }
    }

    // Force structural numbering for all modules and content items
    if (this.modules) {
        this.modules.forEach((mod, mIdx) => {
            mod.moduleNumber = mIdx + 1;
            if (mod.content) {
                let vCount = 1;
                let qCount = 1;
                mod.content.forEach((item) => {
                    if (item.type === 'video') item.videoNumber = vCount++;
                    if (item.type === 'quiz') item.quizNumber = qCount++;
                });
            }
        });
    }
});

module.exports = mongoose.model('Course', courseSchema);
