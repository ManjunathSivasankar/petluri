const fs = require('fs');
const PDFParser = require('pdf2json');

const pdfParser = new PDFParser();

pdfParser.on('pdfParser_dataError', errData => console.error(errData.parserError));
pdfParser.on('pdfParser_dataReady', pdfData => {
    const targets = ['student_name', 'course_name', 'college_name', 'completion_date', 'certificate_id'];
    const found = [];
    
    // pdf2json returns coordinates in its own units (approx 1/4 inch per unit or something similar)
    // We need to convert them to points (1/72 inch). 
    // pdf2json x, y are roughly based on a 4.5 ratio to PDF points, but let's just grab the raw values first.
    
    pdfData.Pages.forEach(page => {
        page.Texts.forEach(textObj => {
            const rawText = decodeURIComponent(textObj.R[0].T);
            const lowerText = rawText.toLowerCase();
            
            if (targets.some(t => lowerText.includes(t) || t.includes(lowerText))) {
                found.push({
                    text: rawText,
                    x_pdf2json: textObj.x,
                    y_pdf2json: textObj.y,
                    w_pdf2json: textObj.w
                });
            }
        });
    });
    
    console.log(JSON.stringify(found, null, 2));
});

const pdfPath = 'd:/petluri-1/backend/public/uploads/templates/template-1773725846923-458382386.pdf';
pdfParser.loadPDF(pdfPath);
