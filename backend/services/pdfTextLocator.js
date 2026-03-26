const fs = require('fs');
const pdf = require('pdf-parse');

async function findTextCoordinates(pdfPath) {
    const dataBuffer = fs.readFileSync(pdfPath);
    let items = [];
    
    // Custom render page function to extract text coordinates
    function render_page(pageData) {
        return pageData.getTextContent().then(function(textContent) {
            for (let item of textContent.items) {
                if (item.str.trim().length > 0) {
                    items.push({
                        text: item.str,
                        x: item.transform[4],
                        y: item.transform[5],
                        width: item.width,
                        height: item.height,
                        fontName: item.fontName
                    });
                }
            }
            return '';
        });
    }

    const options = {
        pagerender: render_page
    };

    await pdf(dataBuffer, options);
    return items;
}

module.exports = { findTextCoordinates };

if (require.main === module) {
    const tmplDir = './public/uploads/templates';
    const files = fs.readdirSync(tmplDir).filter(f => f.endsWith('.pdf'));
    if (files.length > 0) {
        findTextCoordinates(`${tmplDir}/${files[0]}`).then(items => {
            const targets = ['student_name', 'course_name', 'college_name', 'completion_date', 'certificate_id'];
            const found = items.filter(i => targets.some(t => i.text.toLowerCase().includes(t)));
            console.log('Found targets:', JSON.stringify(found, null, 2));
        });
    }
}
