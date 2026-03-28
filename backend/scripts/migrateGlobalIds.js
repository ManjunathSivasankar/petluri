const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Course = require('../models/Course');
const Certificate = require('../models/Certificate');
const InternshipCertificate = require('../models/InternshipCertificate');
const Counter = require('../models/Counter');
const MigrationLog = require('../models/MigrationLog');

const migrate = async () => {
    try {
        console.log('--- GLOBAL IDENTITY SYSTEM MIGRATION START ---');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB.');

        // 0. Reset Counters (Optional but safer if starting fresh migration)
        await Counter.deleteMany({});
        await MigrationLog.deleteMany({});

        // 1. Migrate Students
        console.log('Migrating Students...');
        const students = await User.find({ role: 'student' }).sort({ createdAt: 1 });
        
        for (const student of students) {
            const yearStr = student.createdAt ? student.createdAt.getFullYear().toString().slice(-2) : '26';
            const counterKey = `student_${yearStr}`;
            
            const counter = await Counter.findOneAndUpdate(
                { _id: counterKey },
                { $inc: { seq: 1 }, $set: { year: yearStr, type: 'student' } },
                { new: true, upsert: true }
            );
            
            const newId = `PES${yearStr}${counter.seq.toString().padStart(2, '0')}`;
            const oldId = student.studentId || 'None';
            
            await User.updateOne({ _id: student._id }, { $set: { studentId: newId } });
            
            await MigrationLog.create({
                oldId,
                newId,
                entity: 'student',
                originalDocId: student._id
            });
        }
        console.log(`Migrated ${students.length} students.`);

        // 2. Migrate Programs
        console.log('Migrating Programs...');
        const programs = await Course.find({}).sort({ createdAt: 1 });
        const typeMap = {
            'internship': 'I',
            'certification': 'C',
            'free': 'F',
            'professional': 'P'
        };

        for (const program of programs) {
            const typeCode = typeMap[program.type] || 'P';
            const counterKey = `program_${typeCode}`;
            
            const counter = await Counter.findOneAndUpdate(
                { _id: counterKey },
                { $inc: { seq: 1 }, $set: { type: 'program' } },
                { new: true, upsert: true }
            );
            
            const newId = `PE${typeCode}${counter.seq.toString().padStart(2, '0')}`;
            const oldId = program.programId || program.programCode || 'None';
            
            // 3. Migrate Modules/Videos (Structural Numbering)
            const updatedModules = (program.modules || []).map((mod, mIdx) => {
                const updatedContent = (mod.content || []).map((item, cIdx) => {
                    const newItem = { ...item };
                    if (item.type === 'video') {
                        // Count videos in this module
                        const prevVideos = mod.content.slice(0, cIdx).filter(i => i.type === 'video').length;
                        newItem.videoNumber = prevVideos + 1;
                    }
                    if (item.type === 'quiz') {
                        const prevQuizzes = mod.content.slice(0, cIdx).filter(i => i.type === 'quiz').length;
                        newItem.quizNumber = prevQuizzes + 1;
                    }
                    return newItem;
                });
                return { 
                    ...mod, 
                    moduleNumber: mIdx + 1,
                    content: updatedContent 
                };
            });
            
            await Course.updateOne(
                { _id: program._id }, 
                { $set: { programId: newId, modules: updatedModules } }
            );
            
            await MigrationLog.create({
                oldId,
                newId,
                entity: 'program',
                originalDocId: program._id
            });
        }
        console.log(`Migrated ${programs.length} programs and their modules/videos.`);

        // 4. Migrate Certificates
        console.log('Migrating Certificates...');
        const certs = await Certificate.find({});
        for (const cert of certs) {
            const student = await User.findById(cert.userId);
            const program = await Course.findById(cert.courseId);
            
            if (student && program && student.studentId && program.programId) {
                const studentSuffix = student.studentId.slice(-4);
                const newId = `PEC${program.programId}S${studentSuffix}`;
                const oldId = cert.certificateId;
                
                await Certificate.updateOne({ _id: cert._id }, { $set: { certificateId: newId } });
                
                await MigrationLog.create({
                    oldId,
                    newId,
                    entity: 'certificate',
                    originalDocId: cert._id
                });
            }
        }

        const intCerts = await InternshipCertificate.find({});
        for (const cert of intCerts) {
            const student = await User.findById(cert.userId);
            const program = await Course.findById(cert.courseId);
            
            if (student && program && student.studentId && program.programId) {
                const studentSuffix = student.studentId.slice(-4);
                const newId = `PEC${program.programId}S${studentSuffix}`;
                const oldId = cert.certificateId;
                
                await InternshipCertificate.updateOne({ _id: cert._id }, { $set: { certificateId: newId } });
                
                await MigrationLog.create({
                    oldId,
                    newId,
                    entity: 'certificate',
                    originalDocId: cert._id
                });
            }
        }
        console.log('Migrated certificates.');

        console.log('--- MIGRATION COMPLETED SUCCESSFULLY ---');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};

migrate();
