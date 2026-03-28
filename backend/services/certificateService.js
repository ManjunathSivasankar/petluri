const Certificate = require("../models/Certificate");
const User = require("../models/User");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const QRCode = require("qrcode");
const {
  PDFDocument,
  PDFArray,
  PDFName,
  PDFDict,
  PDFString,
  PDFHexString,
  rgb,
  StandardFonts,
} = require("pdf-lib");
const fontkit = require("@pdf-lib/fontkit");
const idService = require("./idService");

const drawFallbackCertificateText = async (pdfDoc, student, course, certificateId, completionDate, verificationUrl) => {
  const page = pdfDoc.getPages()[0] || pdfDoc.addPage([1190, 842]);
  const { width, height } = page.getSize();
  const titleFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const bodyFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  page.drawText("PETLURI EDUTECH", {
    x: width / 2 - 165,
    y: height - 120,
    size: 34,
    font: titleFont,
    color: rgb(0.08, 0.2, 0.45),
  });

  page.drawText("Certificate of Completion", {
    x: width / 2 - 180,
    y: height - 175,
    size: 28,
    font: titleFont,
    color: rgb(0.12, 0.12, 0.12),
  });

  page.drawText("This is to certify that", {
    x: width / 2 - 110,
    y: height - 245,
    size: 18,
    font: bodyFont,
    color: rgb(0.2, 0.2, 0.2),
  });

  page.drawText(student.name || "Student Name", {
    x: width / 2 - 220,
    y: height - 300,
    size: 42,
    font: titleFont,
    color: rgb(0.05, 0.18, 0.4),
  });

  page.drawText(`from ${student.collegeName || "-"}`, {
    x: width / 2 - 180,
    y: height - 340,
    size: 16,
    font: bodyFont,
    color: rgb(0.26, 0.26, 0.26),
  });

  page.drawText(`has successfully completed ${course.title || "the program"}`, {
    x: width / 2 - 255,
    y: height - 390,
    size: 18,
    font: bodyFont,
    color: rgb(0.2, 0.2, 0.2),
  });

  page.drawText(`Completion Date: ${completionDate}`, {
    x: 95,
    y: 105,
    size: 13,
    font: bodyFont,
    color: rgb(0.35, 0.35, 0.35),
  });

  page.drawText(`Certificate ID: ${certificateId}`, {
    x: width - 365,
    y: 105,
    size: 13,
    font: bodyFont,
    color: rgb(0.35, 0.35, 0.35),
  });

  page.drawText(`Verify: ${verificationUrl}`, {
    x: 95,
    y: 80,
    size: 10,
    font: bodyFont,
    color: rgb(0.42, 0.42, 0.42),
  });
};

const { generateCertificateId: getGlobalCertId } = require("./idService");

/**
 * Read a PDF string value from a PDFDict entry.
 */
function readPDFString(val) {
  if (!val) return "";
  const name = val.constructor.name;
  if (name === "PDFString") return val.asString();
  if (name === "PDFHexString") return val.decodeText();
  return val.toString().replace(/^\(|\)$/g, "");
}

/**
 * Scan ALL page widget annotations in the PDF and return a map of
 * { fieldName -> { x, y, width, height, pageIndex } }
 *
 * This works even for PDFs whose AcroForm root has no 'Fields' array.
 */
async function scanWidgetAnnotations(doc) {
  const fieldMap = {};
  const pages = doc.getPages();

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    const page = pages[pageIndex];
    const { height: pageHeight } = page.getSize();
    const node = page.node;

    const annotsRef = node.get(PDFName.of("Annots"));
    if (!annotsRef) continue;

    const annots = doc.context.lookupMaybe(annotsRef, PDFArray);
    if (!annots) continue;

    for (let i = 0; i < annots.size(); i++) {
      const annotRef = annots.get(i);
      const annot = doc.context.lookupMaybe(annotRef, PDFDict);
      if (!annot) continue;

      const subtypeRaw = annot.get(PDFName.of("Subtype"));
      if (!subtypeRaw || subtypeRaw.toString() !== "/Widget") continue;

      // Field name: /T key
      const tVal = annot.get(PDFName.of("T"));
      const fieldName = readPDFString(tVal).trim().toLowerCase();
      if (!fieldName) continue;

      // Rect: [x1, y1, x2, y2] in PDF coordinate space (bottom-left origin)
      const rectRef = annot.get(PDFName.of("Rect"));
      const rectArr = doc.context.lookupMaybe(rectRef, PDFArray);
      if (!rectArr || rectArr.size() < 4) continue;

      const x1 = parseFloat(rectArr.get(0).toString());
      const y1 = parseFloat(rectArr.get(1).toString());
      const x2 = parseFloat(rectArr.get(2).toString());
      const y2 = parseFloat(rectArr.get(3).toString());

      fieldMap[fieldName] = {
        x: x1,
        y: y1, // bottom of field rect in PDF space
        width: x2 - x1,
        height: y2 - y1,
        pageIndex,
      };
    }
  }

  return fieldMap;
}

/**
 * Generate certificate using predefined coordinate mapping.
 * This guarantees perfect placement on the user's specific template.
 */
const issueCertificate = async (userId, courseId) => {
  try {
    const student = await User.findById(userId);
    const course = await Course.findById(courseId);

    if (!student || !course) throw new Error("Student or Course not found");

    const enrollment = await Enrollment.findOne({ userId, courseId });
    if (!enrollment || enrollment.status !== "completed") {
      throw new Error(
        "Certificate can only be issued for completed enrollments",
      );
    }

    let templatePath = course.certificateTemplate;

    // Ensure templatePath exists
    if (templatePath) {
      // Check if it's an external URL
      if (templatePath.startsWith("http")) {
        // Do nothing, will likely fail later if we don't have download logic
      }
      // Check if it's a web-relative path starting with /uploads
      else if (templatePath.startsWith("/uploads/")) {
        templatePath = path.join(__dirname, "../public", templatePath);
      }
      // If it's a relative path and not root-relative
      else if (!path.isAbsolute(templatePath)) {
        templatePath = path.join(
          __dirname,
          "../public/uploads/templates",
          path.basename(templatePath),
        );
      }
      // If it's already an absolute file system path (e.g. C:\... or /home/...), keep it as is

      // Normalize path
      templatePath = path.resolve(templatePath);
    }

    let pdfDoc;
    let usingTemplate = false;
    if (templatePath && fs.existsSync(templatePath)) {
      try {
        const templateBytes = fs.readFileSync(templatePath);
        pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true });
        usingTemplate = true;
        console.log(`Using template: ${templatePath}`);
      } catch (templateError) {
        console.error(`Template load failed, using fallback certificate: ${templateError.message}`);
      }
    }

    if (!pdfDoc) {
      pdfDoc = await PDFDocument.create();
      pdfDoc.addPage([1190, 842]);
    }

    // Delete existing missing certificate record to cleanly regenerate
    let existingCert = await Certificate.findOne({ userId, courseId });
    if (existingCert) {
      const oldFilePath = path.join(
        __dirname,
        "../public",
        existingCert.pdfUrl,
      );
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }

    // Reuse existing certificateId if it exists to avoid breaking links
    let certificateId = existingCert
      ? existingCert.certificateId
      : getGlobalCertId(course.programId, student.studentId);

    const verificationUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/verify-certificate/${certificateId}`;

    const completionDate = new Date(
      enrollment.updatedAt || Date.now(),
    ).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const form = pdfDoc.getForm();

    // Mapped field names based on the user's requirement (4 items total: Name, College, ID, QR)
    // QR is drawn as an image. These are the text fields.
    const fieldMapOrdered = [
      { field: "name", value: student.name }, // Student Name
      { field: "college_name", value: student.collegeName || "" }, // College Name
      { field: "certificate_id", value: certificateId }, // Certificate ID
      // User's Latest Template IDs (Verified via scan)
      { field: "text_1msei", value: student.name },
      { field: "text_2wxoi", value: student.collegeName || "" },
      { field: "text_3xaky", value: certificateId },
      // Legacy / Technical IDs support if they use the old template
      { field: "text_1vgsm", value: student.name },
      { field: "text_2ihzt", value: student.collegeName || "" },
      { field: "text_5hntj", value: certificateId },
    ];

    let filledFieldCount = 0;
    for (const { field: fieldName, value } of fieldMapOrdered) {
      try {
        const field = form.getTextField(fieldName);
        if (field) {
          field.setText(value);
          filledFieldCount += 1;

          // Increase font size for College Name to make it more prominent
          if (
            ["college_name", "text_2wxoi", "text_2ihzt"].includes(fieldName)
          ) {
            field.setFontSize(14);
          }
        } else {
          // console.warn(`Field ${fieldName} not found in template.`);
        }
      } catch (err) {
        if (usingTemplate) {
          console.warn(`Error setting field ${fieldName}:`, err.message);
        }
      }
    }

    // If no form field is mapped, draw the core values directly.
    if (filledFieldCount === 0) {
      await drawFallbackCertificateText(
        pdfDoc,
        student,
        course,
        certificateId,
        completionDate,
        verificationUrl,
      );
    } else {
      // Flatten the form to make it non-editable
      form.flatten();
    }

    // Add QR code
    const pages = pdfDoc.getPages();
    const page = pages[0]; // Assuming QR code goes on the first page
    const { width, height } = page.getSize();

    // Combine scannable link with requested credentials
    const qrContent = [
      "Digital Petluri Verification Service",
      verificationUrl,
      `ID: ${certificateId}`,
      `Name: ${student.name}`,
      `College: ${student.collegeName || ""}`,
      `Course: ${course.title}`,
    ].join("\n");

    const qrDataUrl = await QRCode.toDataURL(qrContent, {
      margin: 4,
      width: 200, // Higher resolution for better clarity
      color: { dark: "#000000", light: "#ffffff" },
    });
    const qrImageBytes = Buffer.from(
      qrDataUrl.replace(/^data:image\/png;base64,/, ""),
      "base64",
    );
    const qrImage = await pdfDoc.embedPng(qrImageBytes);

    page.drawImage(qrImage, {
      x: width - 115,
      y: height - 115,
      width: 100,
      height: 100,
    });

    // Save
    const outDir = path.join(__dirname, "../public/certificates");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const outFileName = `${certificateId}.pdf`;
    const outPath = path.join(outDir, outFileName);
    const finalPdfBytes = await pdfDoc.save();
    fs.writeFileSync(outPath, finalPdfBytes);

    const pdfUrl = `/certificates/${outFileName}`;

    if (existingCert) {
      existingCert.certificateId = certificateId;
      existingCert.pdfUrl = pdfUrl;
      existingCert.studentName = student.name;
      existingCert.courseTitle = course.title;
      existingCert.verificationUrl = verificationUrl;
      existingCert.generatedDate = new Date();
      await existingCert.save();
    } else {
      await Certificate.create({
        certificateId,
        userId,
        courseId,
        pdfUrl,
        studentName: student.name,
        courseTitle: course.title,
        verificationUrl,
      });
    }

    return {
      pdfBytes: finalPdfBytes,
      certificateId,
      fileName: outFileName,
      pdfUrl,
    };
  } catch (error) {
    console.error("Error issuing certificate:", error.message);
    throw error;
  }
};

module.exports = { issueCertificate, generateCertificateId: idService.generateCertificateId };
