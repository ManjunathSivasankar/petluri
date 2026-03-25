require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Course = require('./models/Course');
const { PDFDocument, PDFArray, PDFName, PDFStream } = require('pdf-lib');

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
    const tPath = resolveTemplatePath(course.internshipOfferTemplate);
    console.log('Template:', tPath, '| exists:', fs.existsSync(tPath));

    const bytes = fs.readFileSync(tPath);
    
    // Simple raw grep for text strings
    const raw = bytes.toString('latin1');
    
    // Look for BT...ET blocks (PDF text blocks) 
    const btBlocks = raw.match(/BT[\s\S]{0,500}?ET/g) || [];
    console.log(`\nFound ${btBlocks.length} BT...ET text block(s) in PDF stream\n`);
    btBlocks.slice(0, 10).forEach((block, i) => {
        // Print a compact version removing binary chars
        const clean = block.replace(/[^\x20-\x7E\n]/g, '?');
        console.log(`Block ${i+1}:`, clean.substring(0, 200));
    });
    
    // Also look for any string containing words from our placeholders
    const keywords = ['student', 'offer', 'year', 'dept', 'college', 'name'];
    console.log('\n--- Keyword scan ---');
    for (const kw of keywords) {
        const indices = [];
        let idx = raw.toLowerCase().indexOf(kw);
        while (idx !== -1 && indices.length < 3) {
            indices.push(idx);
            idx = raw.toLowerCase().indexOf(kw, idx + 1);
        }
        if (indices.length > 0) {
            for (const i of indices) {
                const ctx = raw.substring(Math.max(0, i-20), i + kw.length + 30);
                const clean = ctx.replace(/[^\x20-\x7E]/g, '·');
                console.log(`"${kw}" at ${i}: ${JSON.stringify(clean)}`);
            }
        } else {
            console.log(`"${kw}": NOT FOUND in raw stream`);
        }
    }
    
    await mongoose.disconnect();
    process.exit(0);
}
main().catch(e => { console.error('Error:', e.message); process.exit(1); });
