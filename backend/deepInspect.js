require('dotenv').config();
const mongoose = require('mongoose');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');
const Course = require('./models/Course');

function resolveTemplatePath(tp) {
    if (!tp) return null;
    let r = tp;
    if (tp.startsWith('/uploads/')) r = path.join(__dirname, 'public', tp);
    else if (!path.isAbsolute(tp)) r = path.join(__dirname, 'public/templates', path.basename(tp));
    return path.resolve(r);
}

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    const course = await Course.findOne({ type: 'internship' });
    if (!course) { console.log('No internship course found'); process.exit(0); }

    const tPath = resolveTemplatePath(course.internshipOfferTemplate);
    console.log('Template path:', tPath);
    console.log('File exists:', fs.existsSync(tPath));

    const bytes = fs.readFileSync(tPath);
    
    // 1. pdf-parse text
    const parsed = await pdfParse(bytes);
    console.log('\n--- FULL TEXT FROM pdf-parse ---');
    console.log(parsed.text);
    
    // 2. Raw stream scan for placeholder patterns
    const raw = bytes.toString('latin1');
    const placeholders = ['student_name', 'offer_id', 'year&dept', 'college_name', 'name', 'college'];
    console.log('\n--- RAW STREAM SCAN ---');
    for (const p of placeholders) {
        const idx = raw.toLowerCase().indexOf(p.toLowerCase());
        if (idx >= 0) {
            const context = raw.substring(Math.max(0, idx - 30), idx + p.length + 30);
            console.log(`FOUND "${p}" at byte ${idx}:`);
            console.log('  Context:', JSON.stringify(context));
        } else {
            console.log(`NOT FOUND: "${p}"`);
        }
    }
    
    await mongoose.disconnect();
    process.exit(0);
}
main().catch(e => { console.error(e.message, e.stack); process.exit(1); });
