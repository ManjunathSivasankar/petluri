const Counter = require('../models/Counter');

/**
 * Generates an atomic, sequential Student ID: PES<YY><NN>
 * @returns {Promise<string>} e.g., "PES2601"
 */
const generateStudentId = async () => {
    const year = new Date().getFullYear().toString().slice(-2); // "26"
    const counterKey = `student_${year}`;
    
    const counter = await Counter.findOneAndUpdate(
        { _id: counterKey },
        { 
            $inc: { seq: 1 },
            $set: { year, type: 'student' }
        },
        { new: true, upsert: true }
    );
    
    const seqStr = counter.seq.toString().padStart(2, '0');
    return `PES${year}${seqStr}`;
};

/**
 * Generates an atomic, sequential Program ID: PE<TYPE><NN>
 * @param {string} courseType - 'internship', 'certification', 'free', 'professional'
 * @returns {Promise<string>} e.g., "PEI01"
 */
const generateProgramId = async (courseType) => {
    const typeMap = {
        'internship': 'I',
        'certification': 'C',
        'free': 'F',
        'professional': 'P'
    };
    const typeCode = typeMap[courseType] || 'P'; // Default to P if unknown
    const counterKey = `program_${typeCode}`;
    
    const counter = await Counter.findOneAndUpdate(
        { _id: counterKey },
        { 
            $inc: { seq: 1 },
            $set: { type: 'program' }
        },
        { new: true, upsert: true }
    );
    
    const seqStr = counter.seq.toString().padStart(2, '0');
    return `PE${typeCode}${seqStr}`;
};

/**
 * Derives a Certificate ID from Program and Student IDs
 * Format: PEC<PROGRAM_ID>S<STUDENT_ID_SUFFIX>
 * @param {string} programId - e.g., "PEI01"
 * @param {string} studentId - e.g., "PES2601"
 * @returns {string} e.g., "PECPEI01S2601"
 */
const generateCertificateId = (programId, studentId) => {
    if (!programId || !studentId) return '';
    // Use last 4 digits of student ID (e.g., 2601 from PES2601)
    const studentSuffix = studentId.slice(-4);
    return `PEC${programId}S${studentSuffix}`;
};

module.exports = {
    generateStudentId,
    generateProgramId,
    generateCertificateId
};
