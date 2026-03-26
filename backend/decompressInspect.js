require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const Course = require('./models/Course');
const { PDFDocument, PDFName, PDFDict, PDFStream, PDFArray } = require('pdf-lib');

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
    console.log('Template:', tPath);

    const bytes = fs.readFileSync(tPath);
    const doc   = await PDFDocument.load(bytes, { ignoreEncryption: true });
    
    // Iterate all objects and look for content streams
    const context = doc.context;
    let allDecompressedText = '';
    
    for (const [ref, obj] of context.enumerateIndirectObjects()) {
        if (!(obj instanceof PDFStream)) continue;
        try {
            const streamBytes = obj.getContents();
            // Try to decompress with zlib (FlateDecode)
            try {
                const decompressed = zlib.inflateSync(Buffer.from(streamBytes));
                const text = decompressed.toString('latin1');
                // If it contains BT/ET markers it's likely a content stream
                if (text.includes('BT') || text.includes('Tj') || text.includes('TJ')) {
                    allDecompressedText += text + '\n\n';
                }
            } catch {
                // Not zlib compressed, try raw
                const text = Buffer.from(streamBytes).toString('latin1');
                if (text.includes('BT') || text.includes('Tj')) {
                    allDecompressedText += text + '\n\n';
                }
            }
        } catch {}
    }
    
    if (!allDecompressedText) {
        console.log('No content streams found. Trying alternate extraction...');
        // Save with pdf-lib (which re-encodes) then check
        const savedBytes = await doc.save({ useObjectStreams: false });
        const raw = Buffer.from(savedBytes).toString('latin1');
        const btBlocks = raw.match(/BT[\s\S]{0,1000}?ET/g) || [];
        console.log(`After re-save: Found ${btBlocks.length} BT blocks`);
        btBlocks.slice(0, 5).forEach((b, i) => {
            console.log(`Block ${i+1}:`, b.replace(/[^\x20-\x7E\n]/g, '·').substring(0, 300));
        });
    } else {
        // Print text operator lines
        const lines = allDecompressedText.split('\n').filter(l => 
            l.includes('Tj') || l.includes('TJ') || l.trim().startsWith('(')
        );
        console.log(`\nContent stream text lines (${lines.length}):`);
        lines.slice(0, 30).forEach(l => {
            const clean = l.replace(/[^\x20-\x7E]/g, '·');
            console.log(' ', clean.substring(0, 200));
        });
    }
    
    await mongoose.disconnect();
    process.exit(0);
}
main().catch(e => { console.error('Error:', e.message); process.exit(1); });
