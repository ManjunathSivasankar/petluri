/**
 * Internship Document Service
 * ──────────────────────────────────────────────────────────────────────
 * Offer Letter:
 *  - Fills form fields by matching their current VALUE to placeholder keys
 *  - Draws a formal letter paragraph on the PDF after field replacement
 *  - NO QR code
 *  - Clean "ID: XXXXXX" format (no "OFFER-" prefix shown to user)
 *
 * Completion Certificate:
 *  - Fills form fields by value-matching
 *  - QR code embedded at top-right
 */

const InternshipOffer       = require("../models/InternshipOffer");
const InternshipCertificate = require("../models/InternshipCertificate");
const User       = require("../models/User");
const Course     = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const sendEmail  = require("./emailService");
const crypto = require("crypto");
const path   = require("path");
const fs     = require("fs");
const QRCode = require("qrcode");
const {
  PDFDocument, PDFName, rgb, StandardFonts,
} = require("pdf-lib");

// ─── Utilities ─────────────────────────────────────────────────────────

const generateDocId = (prefix = "INT") =>
  `${prefix}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

/** Resolve stored URL path → absolute FS path */
function resolveTemplatePath(tp) {
  if (!tp) return null;
  let r = tp;
  if (tp.startsWith("/uploads/"))  r = path.join(__dirname, "../public", tp);
  else if (!path.isAbsolute(tp))   r = path.join(__dirname, "../public/uploads/templates", path.basename(tp));
  r = path.resolve(r);
  return fs.existsSync(r) ? r : null;
}

/** Friendly date formatter: "18 March 2026" */
function fmtDate(d) {
  if (!d) return "TBD";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function parseStudentId(collegeDetails = "") {
  const m = String(collegeDetails).match(/(?:Reg\s*No|Register\s*No|Student\s*ID|ID)\s*[:\-]\s*([^,\n]+)/i);
  return m ? m[1].trim() : "";
}

function makeReadableId(source = "") {
  const v = String(source || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (!v) return "";
  return v.slice(-8);
}

/** Internship duration string: "18 March 2026 to 30 April 2026" */
function durationStr(startDate, endDate) {
  const s = fmtDate(startDate);
  const e = fmtDate(endDate);
  if (s === "TBD" && e === "TBD") return "the stipulated period";
  return `${s} to ${e}`;
}

/**
 * Fill PDF form fields by matching their CURRENT DISPLAYED VALUE against
 * the placeholder map.
 * Example: field "text_2tuqd" has value "offer_id" → replaced with real ID.
 */
async function fillByFieldValue(pdfDoc, dataMap) {
  const form   = pdfDoc.getForm();
  const fields = form.getFields();
  console.log(`[PDF] ${fields.length} form field(s) found`);

  const lookup = {};
  for (const [k, v] of Object.entries(dataMap)) {
    lookup[k.toLowerCase().trim()] = String(v == null ? "" : v);
  }

  let filled = 0;
  for (const field of fields) {
    try {
      const tf  = form.getTextField(field.getName());
      if (!tf) continue;
      const cur = (tf.getText() || "").toLowerCase().trim();
      if (cur && lookup.hasOwnProperty(cur)) {
        tf.setText(lookup[cur]);
        console.log(`  Filled "${field.getName()}" ("${cur}") → "${lookup[cur]}"`);
        filled++;
      }
    } catch {/* non-text field – skip */}
  }

  if (filled === 0) {
    console.warn("[PDF] No fields matched. Field dump:");
    fields.forEach(f => {
      try { console.warn(`  "${f.getName()}" = "${form.getTextField(f.getName())?.getText() || ''}"`); }
      catch {}
    });
  }

  form.flatten();
  return filled;
}

/**
 * Draw a centered offer title and internship details block in the middle section.
 * Kept compact so it does not collide with signature/footer graphics in template.
 */
async function drawFormalOfferBody(
  pdfDoc,
  studentName,
  studentId,
  courseName,
  startDate,
  endDate,
  offerId,
  collegeName,
  yearDept
) {
  const page        = pdfDoc.getPages()[0];
  const { width } = page.getSize();
  const font        = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont    = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const lineH       = 16;
  const margin      = 57;
  const textSize    = 11;
  const maxWidth    = width - margin * 2;
  // Keep top header/banner area protected from dynamic text drawing.
  const headerBottomY = 648;
  let y               = headerBottomY;

  const drawCentered = (text, isBold = false, size = 16, color = rgb(0.1, 0.1, 0.1)) => {
    const textWidth = (isBold ? boldFont : font).widthOfTextAtSize(text, size);
    page.drawText(text, {
      x: (width - textWidth) / 2,
      y,
      size,
      font: isBold ? boldFont : font,
      color,
    });
    y -= (lineH * 1.6);
  };

  const draw = (text, x, isBold = false, size = 11, color = rgb(0.1, 0.1, 0.1)) => {
    if (y < 170) return;
    page.drawText(text, {
      x, y,
      size, font: isBold ? boldFont : font,
      color,
    });
  };

  const wrapText = (text, currentFont, size, widthLimit) => {
    const words = String(text || "").split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      const candidateWidth = currentFont.widthOfTextAtSize(candidate, size);
      if (candidateWidth <= widthLimit) {
        line = candidate;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    return lines;
  };

  const drawParagraph = (text, isBold = false) => {
    const useFont = isBold ? boldFont : font;
    const lines = wrapText(text, useFont, textSize, maxWidth);
    for (const line of lines) {
      draw(line, margin, isBold, textSize, rgb(0.12, 0.12, 0.12));
      y -= lineH;
    }
    y -= lineH;
  };

  // Recipient block starts only after header section ends.
  draw("To", margin, true, 12, rgb(0.1, 0.1, 0.1));
  y -= lineH;
  draw(studentName, margin, true, 12, rgb(0.1, 0.1, 0.1));
  y -= lineH;
  draw(`ID: ${studentId || "NA"}`, margin, false, 11, rgb(0.12, 0.12, 0.12));
  y -= lineH;
  draw(yearDept || "-", margin, false, 11, rgb(0.12, 0.12, 0.12));
  y -= lineH;
  draw(collegeName || "-", margin, false, 11, rgb(0.12, 0.12, 0.12));
  y -= (lineH + 30);

  // Title comes after the To section.
  drawCentered("INTERNSHIP OFFER LETTER", true, 18);
  y -= 6;

  drawParagraph(`Dear ${studentName},`, true);

  drawParagraph(
    `We Petluri Edu-Tech India Pvt. Ltd. are very pleased to offer you an internship in ` +
    `\"${courseName}\" in our organization. This confirmation specifies your internship details ` +
    `for ${collegeName || "your institution"}${yearDept ? ` (${yearDept})` : ""}.`
  );

  const drawKeyValue = (key, value) => {
    draw(`${key}:`, margin, false, 11, rgb(0.12, 0.12, 0.12));
    draw(`${value}`, margin + 140, true, 11, rgb(0.1, 0.1, 0.1));
    y -= lineH;
  };

  y -= 8;
  drawKeyValue("Position Title", "Technical Intern");
  drawKeyValue("Start Date", fmtDate(startDate));
  drawKeyValue("End Date", fmtDate(endDate));

  y -= 12;
  drawParagraph("Wish you all the best.", false);
  drawParagraph("For any queries, reach the undersigned.", false);
  drawParagraph("For Petluri Edu-Tech India Pvt. Ltd", true);

  // Keep offer ID reference just above footer/contact strip.
  y = 126;
  draw(`ID: ${offerId.replace(/^[A-Z]+-/, "")}`, margin, false, 10, rgb(0.4, 0.4, 0.4));
}

/**
 * Embed QR code at the top-right corner of the first page.
 */
async function embedQrTopRight(pdfDoc, page, content) {
  const { width, height } = page.getSize();
  const qrSize = 90;
  const png = Buffer.from(
    (await QRCode.toDataURL(content, { margin: 1, width: 200 }))
      .replace(/^data:image\/png;base64,/, ""),
    "base64"
  );
  const img = await pdfDoc.embedPng(png);
  page.drawImage(img, {
    x: width - qrSize - 10,
    y: height - qrSize - 10,
    width: qrSize,
    height: qrSize,
  });
}

function parseYearDept(details = "") {
  const yearM = details.match(/Year[:\s]+([^,\n]+)/i);
  const deptM = details.match(/(?:Dept|Department|Branch)[:\s]+([^,\n]+)/i);
  if (yearM || deptM) {
    const parts = [];
    if (yearM) parts.push(`${yearM[1].trim()} Year`);
    if (deptM) parts.push(deptM[1].trim());
    return parts.join(", ");
  }
  return details.trim();
}

// ════════════════════════════════════════════════════════════════════════
//  issueInternshipOffer
// ════════════════════════════════════════════════════════════════════════
const issueInternshipOffer = async (userId, courseId, emailCredentials = null, options = {}) => {
  try {
    const shouldSendEmail = options.sendEmail !== false;
    const student = await User.findById(userId);
    const course  = await Course.findById(courseId);
    const enrollment = await Enrollment.findOne({ userId, courseId }).select("_id");
    if (!student || !course) throw new Error("Student or Course not found");
    if (course.type !== "internship") return null;

    const templatePath = resolveTemplatePath(course.internshipOfferTemplate);
    if (!templatePath) {
      console.warn(`[Offer] No template for: ${course.title}`);
      return null;
    }

    let existing = await InternshipOffer.findOne({ userId, courseId });
    const offerId   = existing ? existing.offerId : generateDocId("OFFER");
    const cleanId   = offerId.replace(/^[A-Z]+-/, "");   // "C2304EC8" without prefix
    const yearDept  = parseYearDept(student.collegeDetails);
    const parsedStudentId = parseStudentId(student.collegeDetails);
    const fallbackId = makeReadableId(student._id || enrollment?._id || cleanId);
    const studentId = parsedStudentId || fallbackId;

    // Placeholder value map (PDF fields whose VALUE matches key → replaced with value)
    const dataMap = {
      "student_name": student.name,
      "offer_id":     `ID: ${cleanId}`,
      "year&dept":    yearDept,
      "college_name": student.collegeName || "",
      // common alias variants
      "student name":  student.name,
      "offer id":      `ID: ${cleanId}`,
      "year&dept":     yearDept,
      "college name":  student.collegeName || "",
      "date":          fmtDate(new Date()),
    };

    console.log(`[Offer] student="${student.name}" college="${student.collegeName}" dates="${durationStr(course.startDate, course.endDate)}"`);

    const bytes  = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });

    const filled = await fillByFieldValue(pdfDoc, dataMap);

    // Draw formal letter body (no QR in offer letter)
    await drawFormalOfferBody(
      pdfDoc,
      student.name,
      studentId,
      course.title,
      course.startDate,
      course.endDate,
      offerId,
      student.collegeName,
      yearDept
    );

    const outDir = path.join(__dirname, "../public/internships/offers");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outFile    = `${offerId}-${Date.now()}.pdf`;
    const finalBytes = await pdfDoc.save();
    fs.writeFileSync(path.join(outDir, outFile), finalBytes);
    const pdfUrl = `/internships/offers/${outFile}`;

    console.log(`[Offer] Saved: ${pdfUrl} (${filled} field(s) filled)`);

    if (existing) {
      Object.assign(existing, { pdfUrl, studentName: student.name, courseTitle: course.title, issuedDate: new Date() });
      await existing.save();
    } else {
      await InternshipOffer.create({ offerId, userId, courseId, pdfUrl, studentName: student.name, courseTitle: course.title });
    }

    // Email — attach PDF with credentials
    if (shouldSendEmail) {
      try {
        const cred = emailCredentials || {};
        const credRow = cred.password
          ? `<tr><td style="padding:4px 12px;color:#555;">Password</td><td style="padding:4px 12px;font-weight:bold;">${cred.password}</td></tr>` : "";
        await sendEmail({
          email:   student.email,
          subject: `🎉 Internship Offer – ${course.title}`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;padding:24px;border:1px solid #e0e0e0;border-radius:10px;">
              <h2 style="color:#007bff;text-align:center;">Congratulations, ${student.name}!</h2>
              <p>Your <strong>Internship Offer Letter</strong> for <strong>${course.title}</strong> is attached below.</p>
              <p>Internship period: <strong>${durationStr(course.startDate, course.endDate)}</strong></p>
              <table style="width:100%;background:#f8f8f8;border-radius:6px;margin-top:12px;">
                <tr><td style="padding:4px 12px;color:#555;">Email</td><td style="padding:4px 12px;font-weight:bold;">${student.email}</td></tr>
                ${credRow}
              </table>
              <p style="margin-top:12px;color:#555;font-size:12px;">Reference ID: ${cleanId}</p>
            </div>`,
          message: `Internship Offer Letter attached. ID: ${cleanId}`,
          attachments: [{ filename: `OfferLetter_${cleanId}.pdf`, content: Buffer.from(finalBytes), contentType: "application/pdf" }],
        });
        console.log(`[Offer] Email sent to ${student.email}`);
      } catch (e) {
        console.error("[Offer] Email failed (non-fatal):", e.message);
      }
    } else {
      console.log(`[Offer] Email skipped for ${student.email} (batch regeneration mode)`);
    }

    return { pdfUrl, offerId, pdfBytes: Buffer.from(finalBytes) };
  } catch (err) {
    console.error("[Offer] Error:", err.message);
    throw err;
  }
};

// ════════════════════════════════════════════════════════════════════════
//  issueInternshipCertificate
// ════════════════════════════════════════════════════════════════════════
const issueInternshipCertificate = async (userId, courseId) => {
  try {
    const student    = await User.findById(userId);
    const course     = await Course.findById(courseId);
    const enrollment = await Enrollment.findOne({ userId, courseId });

    if (!student || !course) throw new Error("Student or Course not found");
    if (course.type !== "internship") return null;
    if (!enrollment || enrollment.status !== "completed")
      throw new Error("Certificate only issued for completed internship enrollments");

    const templatePath = resolveTemplatePath(course.internshipCertificateTemplate);
    if (!templatePath) {
      console.warn(`[Cert] No template for: ${course.title}`);
      return null;
    }

    let existing = await InternshipCertificate.findOne({ userId, courseId });
    const certId    = existing ? existing.certificateId : generateDocId("INT-CERT");
    const verifyUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/verify-internship/${certId}`;
    const completedOn = fmtDate(enrollment.updatedAt || Date.now());

    const dataMap = {
      "student_name":   student.name,
      "college_name":   student.collegeName || "",
      "student_id":     String(userId),
      "certificate_id": certId,
      "Certificate_id": certId,
      "student name":   student.name,
      "college name":   student.collegeName || "",
      "course name":    course.title,
      "COURSE NAME":    course.title,
      "completion_date": completedOn,
      "Date/Month/Year": completedOn,
    };

    console.log(`[Cert] student="${student.name}" college="${student.collegeName}"`);

    const bytes  = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const filled = await fillByFieldValue(pdfDoc, dataMap);

    // QR code → top-right of certificate page
    await embedQrTopRight(pdfDoc, pdfDoc.getPages()[0], [
      "Petluri Edutech Internship Certificate",
      verifyUrl,
      `Cert ID: ${certId}`,
      `Student: ${student.name}`,
      `College: ${student.collegeName || ""}`,
      `Course: ${course.title}`,
    ].join("\n"));

    const outDir = path.join(__dirname, "../public/internships/certificates");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outFile    = `${certId}-${Date.now()}.pdf`;
    const finalBytes = await pdfDoc.save();
    fs.writeFileSync(path.join(outDir, outFile), finalBytes);
    const pdfUrl = `/internships/certificates/${outFile}`;

    console.log(`[Cert] Saved: ${pdfUrl} (${filled} field(s) filled)`);

    if (existing) {
      Object.assign(existing, { pdfUrl, studentName: student.name, courseTitle: course.title, verificationUrl: verifyUrl, issuedDate: new Date() });
      await existing.save();
    } else {
      await InternshipCertificate.create({
        certificateId: certId, userId, courseId, pdfUrl,
        studentName: student.name, courseTitle: course.title, verificationUrl: verifyUrl,
      });
    }

    return { pdfUrl, certificateId: certId, pdfBytes: Buffer.from(finalBytes), fileName: outFile };
  } catch (err) {
    console.error("[Cert] Error:", err.message);
    throw err;
  }
};

module.exports = { issueInternshipOffer, issueInternshipCertificate };
