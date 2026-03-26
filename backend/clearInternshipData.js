const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const InternshipOffer       = require('./models/InternshipOffer');
const InternshipCertificate = require('./models/InternshipCertificate');

async function clearAllInternshipData() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // --- Delete all InternshipOffer records ---
        const offerResult = await InternshipOffer.deleteMany({});
        console.log(`Deleted ${offerResult.deletedCount} InternshipOffer record(s).`);

        // --- Delete all InternshipCertificate records ---
        const certResult = await InternshipCertificate.deleteMany({});
        console.log(`Deleted ${certResult.deletedCount} InternshipCertificate record(s).`);

        // --- Remove generated PDF files from disk ---
        const offerDir = path.join(__dirname, 'public/internships/offers');
        const certDir  = path.join(__dirname, 'public/internships/certificates');

        let removedFiles = 0;
        for (const dir of [offerDir, certDir]) {
            if (fs.existsSync(dir)) {
                const files = fs.readdirSync(dir).filter(f => f.endsWith('.pdf'));
                for (const file of files) {
                    fs.unlinkSync(path.join(dir, file));
                    removedFiles++;
                }
                console.log(`Cleared ${files.length} PDF(s) from ${dir}`);
            } else {
                console.log(`Directory does not exist (skipped): ${dir}`);
            }
        }

        console.log(`\nDone. MongoDB records and ${removedFiles} disk PDF(s) cleared.`);
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

clearAllInternshipData();
