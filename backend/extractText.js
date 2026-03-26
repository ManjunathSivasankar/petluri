const fs = require('fs');
const pdf = require('pdf-parse');

const pdfPath = 'd:/petluri-1/backend/public/uploads/templates/template-1773725846923-458382386.pdf';
const dataBuffer = fs.readFileSync(pdfPath);

let extractedItems = [];

function render_page(pageData) {
    let render_options = {
        //replaces all occurrences of whitespace with single space
        normalizeWhitespace: false,
        //do not attempt to combine same line TextItem's
        disableCombineTextItems: false
    }

    return pageData.getTextContent(render_options)
    .then(function(textContent) {
        let lastY, text = '';
        for (let item of textContent.items) {
           extractedItems.push({
               text: item.str,
               x: item.transform[4],
               y: item.transform[5],
               width: item.width,
               height: item.height
           });
           
            if (lastY == item.transform[5] || !lastY){
                text += item.str;
            }  
            else{
                text += '\n' + item.str;
            }    
            lastY = item.transform[5];
        }
        return text;
    });
}

let options = {
    pagerender: render_page
}

pdf(dataBuffer, options).then(function(data) {
    const targets = ['student_name', 'course_name', 'college_name', 'completion_date', 'certificate_id'];
    
    // Look through extractedItems to find exact or partial matches
    const found = extractedItems.filter(i => {
        const lower = i.text.toLowerCase();
        return targets.some(t => lower.includes(t) || t.includes(lower));
    });
    
    console.log(JSON.stringify(found, null, 2));
}).catch(e => {
    console.error('Error parsing PDF:', e);
});
