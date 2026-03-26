/**
 * Diagnostic: Inspect a PDF template for AcroForm fields.
 * Run this to see what field names exist in the uploaded internship template.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const { PDFDocument, PDFArray, PDFName, PDFDict, PDFString, PDFHexString } = require('pdf-lib');
const Course = require('./models/Course');

function readPDFString(val) {
    if (!val) return '';
    const n = val.constructor.name;
    if (n === 'PDFString')    return val.asString();
    if (n === 'PDFHexString') return val.decodeText();
    return val.toString().replace(/^\(|\)$/g, '');
}

function resolveTemplatePath(tp) {
    if (!tp) return null;
    let r = tp;
    if (tp.startsWith('/uploads/')) r = path.join(__dirname, 'public', tp);
    else if (!path.isAbsolute(tp)) r = path.join(__dirname, 'public/templates', path.basename(tp));
    return path.resolve(r);
}

async function inspectPdf(templatePath, label) {
    console.log(`\n====== ${label} ======`);
    console.log(`Path: ${templatePath}`);
    if (!fs.existsSync(templatePath)) {
        console.log('❌ FILE NOT FOUND ON DISK');
        return;
    }

    const bytes = fs.readFileSync(templatePath);
    const doc   = await PDFDocument.load(bytes, { ignoreEncryption: true });

    // --- Scan AcroForm fields ---
    const form   = doc.getForm();
    const fields = form.getFields();
    console.log(`\nAcroForm fields (${fields.length}):`);
    if (fields.length === 0) {
        console.log('  ⚠  No AcroForm fields found via form.getFields()');
    } else {
        fields.forEach(f => console.log(`  • "${f.getName()}"  [${f.constructor.name}]`));
    }

    // --- Scan Widget Annotations (low-level) ---
    const pages = doc.getPages();
    const annotFields = [];
    for (let pi = 0; pi < pages.length; pi++) {
        const node      = pages[pi].node;
        const annotsRef = node.get(PDFName.of('Annots'));
        if (!annotsRef) continue;
        const annots = doc.context.lookupMaybe(annotsRef, PDFArray);
        if (!annots) continue;
        for (let i = 0; i < annots.size(); i++) {
            const annot = doc.context.lookupMaybe(annots.get(i), PDFDict);
            if (!annot) continue;
            const sub = annot.get(PDFName.of('Subtype'));
            if (!sub || sub.toString() !== '/Widget') continue;
            const rawName = readPDFString(annot.get(PDFName.of('T'))).trim();
            if (rawName) annotFields.push({ page: pi + 1, name: rawName });
        }
    }
    console.log(`\nWidget annotations (${annotFields.length}):`);
    if (annotFields.length === 0) {
        console.log('  ⚠  No Widget annotations found – template has NO form fields');
        console.log('  ℹ  The PDF uses static text, not fillable fields.');
        console.log('  ℹ  You need to create a fillable PDF with form fields named:');
        console.log('     student_name, offer_id, year&dept, college_name');
    } else {
        annotFields.forEach(f => console.log(`  • Page ${f.page}: "${f.name}"`));
    }
}

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    const courses = await Course.find({ type: 'internship' });
    console.log(`Found ${courses.length} internship course(s)`);

    for (const c of courses) {
        console.log(`\nCourse: "${c.title}"`);
        console.log(`  internshipOfferTemplate:       ${c.internshipOfferTemplate || '(not set)'}`);
        console.log(`  internshipCertificateTemplate: ${c.internshipCertificateTemplate || '(not set)'}`);

        if (c.internshipOfferTemplate) {
            await inspectPdf(resolveTemplatePath(c.internshipOfferTemplate), 'OFFER LETTER TEMPLATE');
        }
        if (c.internshipCertificateTemplate) {
            await inspectPdf(resolveTemplatePath(c.internshipCertificateTemplate), 'CERTIFICATE TEMPLATE');
        }
    }

    await mongoose.disconnect();
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
