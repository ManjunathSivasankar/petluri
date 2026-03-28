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

    // Support PDF/file attachments
    if (options.attachments && options.attachments.length > 0) {
        message.attachments = options.attachments;
    }

    console.log(`DEBUG: Sending email to ${options.email} with subject: ${options.subject}`);
    const info = await transporter.sendMail(message);

    console.log('Message sent: %s', info.messageId);
};

const sendOtpEmail = async (email, otp) => {
    const html = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: auto; padding: 40px; border: 1px solid #f0f0f0; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #007bff; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">Petluri Edutech</h1>
                <p style="color: #6c757d; margin: 5px 0 0 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Learning Management System</p>
            </div>
            <div style="background-color: #f8f9fa; padding: 30px; border-radius: 12px; text-align: center; border: 1px dashed #dee2e6;">
                <p style="color: #495057; margin-bottom: 20px; font-size: 16px;">Hello student,</p>
                <p style="color: #495057; font-size: 15px;">Use the following 6-digit code to securely log in to your dashboard:</p>
                <div style="background-color: #ffffff; padding: 20px; text-align: center; border-radius: 8px; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #007bff; margin: 25px 0; border: 1px solid #e9ecef; font-family: monospace;">
                    ${otp}
                </div>
                <p style="color: #dc3545; font-size: 13px; font-weight: 600;">⚠️ Valid for 10 minutes only</p>
            </div>
            <div style="margin-top: 30px; text-align: center;">
                <p style="color: #6c757d; font-size: 14px;">If you didn't request this code, you can safely ignore this email.</p>
                <hr style="border: none; border-top: 1px solid #f0f0f0; margin: 25px 0;">
                <p style="font-size: 12px; color: #adb5bd;">&copy; 2026 Petluri Edutech. Professional Learning Platform.</p>
            </div>
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
