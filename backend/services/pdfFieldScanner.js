/**
 * PDF Form Field Scanner using raw binary parsing + zlib decompression.
 * Handles both standard object streams and cross-reference streams.
 */
const fs = require('fs');
const zlib = require('zlib');

/**
 * Parse all objects from a PDF buffer, including those inside compressed
 * object streams (/ObjStm), and return a Map<string, parsedContent>.
 */
function parsePDFObjectsRaw(buf) {
    const raw = buf.toString('binary');
    const objs = new Map();

    // Pass 1: Extract uncompressed top-level objects
    const topLevel = [...raw.matchAll(/(\d+) 0 obj\s*([\s\S]*?)(?=\d+ 0 obj|\s*%%EOF)/g)];
    for (const match of topLevel) {
        const id = match[1] + ' 0 obj';
        const body = match[2];
        objs.set(id, body);
    }

    // Pass 2: Handle ObjStm (compressed object streams)
    for (const [id, body] of objs) {
        if (!body.includes('/ObjStm') && !body.includes('/Type /ObjStm')) continue;
        
        const streamMatch = body.match(/stream\s([\s\S]*?)endstream/);
        if (!streamMatch) continue;
        
        const streamBuf = Buffer.from(streamMatch[1], 'binary');
        try {
            const decompressed = zlib.inflateSync(streamBuf).toString('latin1');
            // ObjStm format: "num offset num offset ...\n\nobject content..."
            const headerMatch = decompressed.match(/^([\d ]+)\n/);
            if (!headerMatch) continue;
            
            const headerPairs = headerMatch[1].trim().split(/\s+/);
            const first = parseInt(decompressed.split('\n')[0].split(' ').pop());
            const pairs = [];
            for (let i = 0; i < headerPairs.length; i += 2) {
                pairs.push({
                    num: parseInt(headerPairs[i]),
                    offset: parseInt(headerPairs[i + 1])
                });
            }
            
            for (let i = 0; i < pairs.length; i++) {
                const { num, offset } = pairs[i];
                const nextOffset = pairs[i + 1] ? first + pairs[i + 1].offset : decompressed.length;
                const objContent = decompressed.substring(first + offset, nextOffset);
                objs.set(`${num} 0 obj`, objContent);
            }
        } catch (e) {
            // Not compressible or different encoding
        }
    }

    return objs;
}

/**
 * Main function: Scan a PDF file and extract form field positions.
 * Returns { fieldName: { x, y, width, height } }
 */
function extractFieldRects(pdfPath) {
    const buf = fs.readFileSync(pdfPath);
    const objs = parsePDFObjectsRaw(buf);
    
    const fieldRects = {};
    const fieldNames = ['student_name', 'course_name', 'college_name', 'completion_date', 'certificate_id'];

    // Pass 1: Find field parent objects (those with /T = field name)
    const fieldParentIds = {};
    for (const [id, body] of objs) {
        const tMatch = body.match(/\/T\s*\(([^)]+)\)/);
        if (!tMatch) continue;
        const name = tMatch[1].trim().toLowerCase();
        if (fieldNames.includes(name)) {
            fieldParentIds[id] = name;
            
            // Check if this object also has a Rect
            const rectMatch = body.match(/\/Rect\s*\[([^\]]+)\]/);
            if (rectMatch) {
                const vals = rectMatch[1].trim().split(/\s+/).map(Number);
                if (vals.length >= 4) {
                    fieldRects[name] = { x: vals[0], y: vals[1], width: vals[2] - vals[0], height: vals[3] - vals[1] };
                }
            }
        }
    }

    // Pass 2: Find widget annotations that reference these field parents
    for (const [id, body] of objs) {
        const parentMatch = body.match(/\/Parent\s+(\d+ 0 R)/);
        if (!parentMatch) continue;
        
        const parentId = parentMatch[1].replace(' R', ' obj');
        const fieldName = fieldParentIds[parentId];
        if (!fieldName) continue;
        
        const rectMatch = body.match(/\/Rect\s*\[([^\]]+)\]/);
        if (rectMatch) {
            const vals = rectMatch[1].trim().split(/\s+/).map(Number);
            if (vals.length >= 4) {
                fieldRects[fieldName] = { x: vals[0], y: vals[1], width: vals[2] - vals[0], height: vals[3] - vals[1] };
            }
        }
    }

    return fieldRects;
}

module.exports = { extractFieldRects, parsePDFObjectsRaw };

// Test when run directly
if (require.main === module) {
    const tmplDir = './public/uploads/templates';
    const files = fs.readdirSync(tmplDir).filter(f => f.endsWith('.pdf'));
    if (files.length > 0) {
        const result = extractFieldRects(`${tmplDir}/${files[0]}`);
        console.log('Extracted field rects:', JSON.stringify(result, null, 2));
    }
}
