const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a name']
    },
    email: {
        type: String,
        required: [true, 'Please add an email'],
        unique: true,
        lowercase: true,
        match: [
            /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
            'Please add a valid email'
        ]
    },
    password: {
        type: String,
        required: [true, 'Please add a password'],
        minlength: 6,
        select: false // Do not return password by default
    },
    tempPassword: {
        type: String,
        select: false // Only used for admin viewing initial credentials
    },
    phone: {
        type: String,
        required: [true, 'Please add a phone number'],
        match: [
            /^[0-9]{10}$/,
            'Please add a valid 10-digit phone number'
        ]
    },
    collegeName: {
        type: String,
        required: [true, 'Please add a college name']
    },
    collegeDetails: {
        type: String,
        required: [true, 'Please add college details (degree, year, etc.)']
    },
    personalAddress: {
        type: String,
        required: [true, 'Please add a personal address']
    },
    role: {
        type: String,
        enum: ['student', 'admin'],
        default: 'student'
    },
    program: {
        type: String,
        default: 'General'
    },
    programType: {
        type: String,
        default: 'Certification Course'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Encrypt password using bcrypt
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        next();
    }

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
