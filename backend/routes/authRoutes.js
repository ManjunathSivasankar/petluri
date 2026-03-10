const express = require('express');
const router = express.Router();
const { loginUser, registerUser, getMe, sendOtp, verifyOtp, checkEmail } = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');

router.post('/login', loginUser);
router.post('/register', registerUser); // Optional/Admin usage
router.post('/check-email', checkEmail);
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.get('/me', protect, getMe);

module.exports = router;
