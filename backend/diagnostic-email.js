const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
dotenv.config();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const mailOptions = {
    from: `"Email Test" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_USER, // Send to self
    subject: 'SMTP Diagnostic Test - REAL CREDENTIALS',
    text: 'If you see this, your SMTP configuration is working correctly with the new App Password.'
};

console.log('Testing SMTP connection...');
transporter.verify((error, success) => {
    if (error) {
        console.error('SMTP Connection Error:', error);
    } else {
        console.log('SMTP Server is ready to take our messages');
        
        console.log('Sending test email to:', process.env.EMAIL_USER);
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Send Error:', error);
            } else {
                console.log('Email sent successfully!');
                console.log('Message ID:', info.messageId);
                console.log('Response:', info.response);
            }
            process.exit();
        });
    }
});
