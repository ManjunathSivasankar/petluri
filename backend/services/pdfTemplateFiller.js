/**
 * PDF Template Utility - Determines coordinates for known fields.
 * Since PDF forms can vary or be unreadable by standard parsers,
 * we will scan the document's raw text to approximate coordinates,
 * or use a predefined layout map based on common PETLURI certificates.
 */

const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');

async function fillTemplate(templatePath, data, outputPath) {
    const templateBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(templateBytes);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { width, height } = firstPage.getSize();

    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const normalFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Common approximate coordinates for the PETLURI certificate
    // (Based on 842 x 595 landscape A4 PDF)
    const coordinates = {
        student_name: { x: width / 2, y: 320, size: 24, font: font, align: 'center' },
        course_name: { x: width / 2, y: 250, size: 18, font: font, align: 'center' },
        college_name: { x: width / 2, y: 190, size: 16, font: normalFont, align: 'center' },
        completion_date: { x: 260, y: 110, size: 12, font: normalFont, align: 'center' },
        certificate_id: { x: 600, y: 110, size: 12, font: normalFont, align: 'center' },
    };

    const drawTextCentered = (text, config) => {
        if (!text) return;
        const textWidth = config.font.widthOfTextAtSize(text, config.size);
        let xPos = config.x;
        if (config.align === 'center') xPos = config.x - textWidth / 2;

        firstPage.drawText(text, {
            x: xPos,
            y: config.y,
            size: config.size,
            font: config.font,
            color: rgb(0.1, 0.1, 0.1),
        });
    };

    // Before drawing text, we need to hide the original placeholder text if it exists.
    // The safest way is to draw a white box over the approximate coordinates.
    // However, if the template just has blank spaces, we don't need to.
    // Let's draw the new text.
    
    drawTextCentered(data.student_name, coordinates.student_name);
    drawTextCentered(data.course_name, coordinates.course_name);
    drawTextCentered(data.college_name, coordinates.college_name);
    drawTextCentered(data.completion_date, coordinates.completion_date);
    drawTextCentered(data.certificate_id, coordinates.certificate_id);

    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, pdfBytes);
}

module.exports = { fillTemplate };
