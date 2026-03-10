const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Generate JWT
const generateToken = (id, role) => {
    return jwt.sign({ id, role }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email }).select('+password');

        if (user && (await user.matchPassword(password))) {
            res.json({
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                token: generateToken(user._id, user.role),
            });
        } else {
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Register a new user (Internal/Admin use mostly, or public if allowed)
// @route   POST /api/auth/register (NOT EXPOSED publicly based on rules, keeping generic)
// @access  Public (for dev) / Admin
const registerUser = async (req, res) => {
    const { name, email, password, role } = req.body;

    try {
        const userExists = await User.findOne({ email });

        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const user = await User.create({
            name,
            email,
            password,
            role: role || 'student' // Default to student
        });

        if (user) {
            res.status(201).json({
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                token: generateToken(user._id, user.role),
            });
        } else {
            res.status(400).json({ message: 'Invalid user data' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Check if email exists and return details (excluding password)
// @route   POST /api/auth/check-email
// @access  Public
const checkEmail = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email }).select('-password');
        if (user) {
            res.json({ exists: true, user });
        } else {
            res.json({ exists: false });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const Otp = require('../models/Otp');
const { sendOtpEmail } = require('../services/emailService');

// @desc    Send OTP to email
// @route   POST /api/auth/send-otp
// @access  Public
const sendOtp = async (req, res) => {
    const email = req.body.email.toLowerCase();
    console.log(`DEBUG: Received send-otp request for ${email}`);

    try {
        // Check if user exists and is a student
        const user = await User.findOne({ email });

        if (!user) {
            console.log(`DEBUG: User not found for email: ${email}`);
            return res.status(404).json({ message: 'User not found. Please enroll in a course first.' });
        }

        console.log(`DEBUG: User found: ${user._id}, role: ${user.role}`);

        if (user.role !== 'student') {
            return res.status(403).json({ message: 'OTP login is currently only for student accounts.' });
        }

        // Generate 6 digit OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

        // Clear existing OTPs for this email
        await Otp.deleteMany({ email });

        // Save new OTP to DB
        await Otp.create({ email, otp: otpCode });

        // Log OTP to console for development testing
        console.log(`DEBUG: process.env.NODE_ENV = ${process.env.NODE_ENV}`);
        console.log(`[DEV] OTP for ${email}: ${otpCode}`);

        // Send Email (Don't let email failure block login for dev)
        try {
            console.log('DEBUG: Attempting to send OTP email...');
            await sendOtpEmail(email, otpCode);
            console.log('DEBUG: sendOtpEmail resolved successfully');
        } catch (emailError) {
            console.error('DEBUG: Email sending failed:', emailError.message);
            // In development, we still want to return success so the user can enter the OTP from console
            if (process.env.NODE_ENV !== 'production') {
                return res.json({
                    success: true,
                    message: 'OTP logged to console (Email sending failed)',
                    devNote: 'Check your backend terminal for the OTP code.'
                });
            }
            throw emailError;
        }

        res.json({ success: true, message: 'OTP sent to email' });
    } catch (error) {
        console.error('OTP Send Error:', error);
        res.status(500).json({ message: 'Failed to send OTP' });
    }
};

// @desc    Verify OTP & Login/Register
// @route   POST /api/auth/verify-otp
// @access  Public
const verifyOtp = async (req, res) => {
    const { email, otp } = req.body;

    try {
        const otpRecord = await Otp.findOne({ email, otp });

        if (!otpRecord) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        // Check if user exists
        let user = await User.findOne({ email });

        if (!user) {
            // Special case: If user doesn't exist, we might want to return a flag 
            // OR auto-register if it's a known email from pre-enrollment.
            // For now, let's assume login only for existing users via OTP.
            return res.status(404).json({ message: 'User not found. Please register first or enroll in a course.' });
        }

        // Delete OTP after successful verification
        await Otp.deleteOne({ _id: otpRecord._id });

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            phone: user.phone,
            collegeName: user.collegeName,
            collegeDetails: user.collegeDetails,
            personalAddress: user.personalAddress,
            token: generateToken(user._id, user.role),
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { loginUser, registerUser, getMe, checkEmail, sendOtp, verifyOtp };
