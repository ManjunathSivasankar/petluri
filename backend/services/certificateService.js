const Certificate = require('../models/Certificate');
const crypto = require('crypto');

/**
 * Generate a unique certificate ID
 */
const generateCertificateId = () => {
    return `CERT-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
};

/**
 * Issue a certificate to a student for a course
 */
const issueCertificate = async (userId, courseId) => {
    try {
        // Check if certificate already exists
        const existingCert = await Certificate.findOne({ userId, courseId });
        if (existingCert) return existingCert;

        const certificateId = generateCertificateId();

        // In a real app, you'd use a library like jspdf or pdf-lib here to generate a PDF
        // and upload it to a storage bucket (S3/Cloudinary).
        // For now, we mock the PDF URL.
        const pdfUrl = `https://petluri-lms-certificates.s3.amazonaws.com/${certificateId}.pdf`;

        const certificate = await Certificate.create({
            certificateId,
            userId,
            courseId,
            pdfUrl
        });

        return certificate;
    } catch (error) {
        console.error('Error issuing certificate:', error);
        throw error;
    }
};

module.exports = { issueCertificate, generateCertificateId };
