const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    // Create transporter (using Ethereal for testing or env vars)
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_PORT === "465",
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    const message = {
        from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
        to: options.email,
        subject: options.subject,
        text: options.message,
        html: options.html // Optional
    };

    console.log(`DEBUG: Sending email to ${options.email} with subject: ${options.subject}`);
    const info = await transporter.sendMail(message);

    console.log('Message sent: %s', info.messageId);
};

const sendOtpEmail = async (email, otp) => {
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
            <h2 style="color: #333; text-align: center;">Your Login OTP</h2>
            <p>Hello,</p>
            <p>You requested a one-time password (OTP) to log in to Petluri Edutech LMS.</p>
            <div style="background-color: #f4f4f4; padding: 15px; text-align: center; border-radius: 5px; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #007bff;">
                ${otp}
            </div>
            <p>This OTP is valid for <strong>10 minutes</strong>. If you did not request this, please ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #777 text-align: center;">&copy; 2026 Petluri Edutech LMS. All rights reserved.</p>
        </div>
    `;

    await sendEmail({
        email,
        subject: 'Your Petluri Edutech Login OTP',
        html,
        message: `Your OTP is ${otp}. It is valid for 10 minutes.`
    });
};

module.exports = sendEmail;
module.exports.sendOtpEmail = sendOtpEmail;
