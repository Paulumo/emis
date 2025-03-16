const functions = require('firebase-functions');
const express = require('express');
const path = require('path');
const multer = require('multer');
const { PDFExtract } = require('pdf.js-extract');
const { v4: uuidv4 } = require('uuid');
const JSZip = require('jszip');
const fs = require('fs');
const os = require('os');

// Initialize the Express app
const app = express();

// Setup temporary file storage for uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempDir = path.join(os.tmpdir(), 'uploads');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const { PDFExtract } = require('pdf.js-extract');
const { v4: uuidv4 } = require('uuid');
const JSZip = require('jszip');

// Initialize PDF extractor
const pdfExtract = new PDFExtract();

// Setup Express app
const app = express();
const port = process.env.PORT || 3000;

// Serve static files
app.use(express.static('public'));

// Configure file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// Ensure directories exist
['uploads', 'outputs', 'public'].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
});

// Helper function to convert to Chinese numerals
function getChineseNumeral(num) {
  const chineseNumerals = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  
  if (num <= 10) {
    return chineseNumerals[num - 1];
  } else if (num > 10 && num <= 19) {
    return '十' + (num > 10 ? chineseNumerals[num - 11] : '');
  } else {
    return chineseNumerals[Math.floor(num / 10) - 1] + '十' + (num % 10 > 0 ? chineseNumerals[num % 10 - 1] : '');
  }
}

// Helper function to extract document number from string like "海力航字第2025030018號"
function extractDocNumber(docString) {
  const matches = docString && docString.match(/字第(\d+)號/);
  if (matches) {
    const fullNumber = matches[1];
    // Extract year and sequence number
    const year = fullNumber.substring(0, 3);
    const sequenceNumber = fullNumber.substring(3);
    return { year, sequenceNumber };
  }
  return { year: '', sequenceNumber: '' };
}

// Function to generate DI file content from form data without XML library
function generateDIContentFromForm(formData, filename, attachments) {
  console.log("Generating DI content for:", filename);
  console.log("Attachments:", attachments);
  
  try {
    // Generate DOCTYPE declarations
    let doctypeEntities = `<!ENTITY 表單 SYSTEM "${filename}.sw" NDATA DI>\n`;
    
    // Add attachments to DOCTYPE
    if (attachments && attachments.length > 0) {
      attachments.forEach((attachment, index) => {
        doctypeEntities += `<!ENTITY ATTACH${index + 1} SYSTEM "${attachment}" NDATA _X>\n`;
      });
    }
    
    // Add notations
    doctypeEntities += `<!NOTATION _X SYSTEM "">\n<!NOTATION DI SYSTEM "">`;
    
    // XML declaration and DOCTYPE
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<!DOCTYPE 函 SYSTEM "104_2_utf8.dtd" [\n${doctypeEntities}\n]>\n`;
    
    // Extract explanation items
    const explanationItems = [];
    try {
      if (formData.explanation) {
        const parsed = JSON.parse(formData.explanation);
        if (Array.isArray(parsed)) {
          explanationItems.push(...parsed);
        }
      }
    } catch (e) {
      console.warn("Error parsing explanation items:", e);
    }
    
    // Extract document number details
    const { year, sequenceNumber } = extractDocNumber(formData.documentNumber);
    
    // Start main XML content
    xml += '<函>\n';
    
    // 發文機關 section
    xml += '  <發文機關>\n';
    xml += `    <全銜>${formData.orgName || ''}</全銜>\n`;
    xml += '    <機關代碼>EB88387577</機關代碼>\n';
    xml += '  </發文機關>\n';
    
    // 函類別 section
    xml += '  <函類別 代碼="函"/>\n';
    
    // Address and contact info
    xml += `  <地址>${formData.address || ''}</地址>\n`;
    xml += `  <聯絡方式>承辦人：${formData.contact || ''}</聯絡方式>\n`;
    xml += `  <聯絡方式>聯絡方式：${formData.contactMethod || ''}</聯絡方式>\n`;
    xml += `  <聯絡方式>傳真：${formData.fax || ''}</聯絡方式>\n`;
    
    // 受文者 section
    xml += '  <受文者>\n';
    xml += `    <交換表 交換表單="表單">${formData.recipient || ''}</交換表>\n`;
    xml += '  </受文者>\n';
    
    // 發文日期 section
    xml += '  <發文日期>\n';
    xml += `    <年月日>${formData.documentDate || ''}</年月日>\n`;
    xml += '  </發文日期>\n';
    
    // 發文字號 section
    xml += '  <發文字號>\n';
    xml += `    <字>${(formData.documentNumber || '').split('字第')[0]}</字>\n`;
    xml += '    <文號>\n';
    xml += `      <年度>${year || ''}</年度>\n`;
    xml += `      <流水號>${sequenceNumber || ''}</流水號>\n`;
    xml += '    </文號>\n';
    xml += '  </發文字號>\n';
    
    // 速別 section
    const priority = formData.priority === '普通件' ? '普通件' : (formData.priority === '最速件' ? '最速件' : '速件');
    xml += `  <速別 代碼="${priority}"/>\n`;
    
    // 密等及解密條件或保密期限 section
    xml += '  <密等及解密條件或保密期限>\n';
    xml += '    <密等></密等>\n';
    xml += `    <解密條件或保密期限>${formData.securityLevel || ''}</解密條件或保密期限>\n`;
    xml += '  </密等及解密條件或保密期限>\n';
    
    // 附件 section
    xml += '  <附件>\n';
    xml += `    <文字>${formData.attachment || '如文'}</文字>\n`;
    xml += '    <附件檔名 附件名="ATTACH1"/>\n';
    xml += '  </附件>\n';
    
    // 主旨 section
    xml += '  <主旨>\n';
    xml += `    <文字>${formData.subject || ''}</文字>\n`;
    xml += '  </主旨>\n';
    
    // 段落 (explanation) section
    xml += '  <段落 段名="說明：">\n';
    
    // Add explanation points
    if (explanationItems && explanationItems.length > 0) {
      explanationItems.forEach((point, index) => {
        // Extract the number marker (e.g., "一、", "二、")
        const numberMatch = point.match(/^([一二三四五六七八九十]+、)/);
        const marker = numberMatch ? numberMatch[1] : `${getChineseNumeral(index + 1)}、`;
        const content = point.replace(/^[一二三四五六七八九十]+、/, '').trim();
        
        xml += `    <條列 序號="${marker}">\n`;
        xml += `      <文字>${content}</文字>\n`;
        xml += '    </條列>\n';
      });
    }
    
    xml += '  </段落>\n';
    
    // 正本 section
    xml += '  <正本>\n';
    xml += `    <全銜>${formData.primaryRecipient || ''}</全銜>\n`;
    xml += '  </正本>\n';
    
    // 副本 section
    xml += `  <副本>${formData.copyRecipient || ''}</副本>\n`;
    
    // 署名 section
    xml += '  <署名> </署名>\n';
    
    // Close main tag
    xml += '</函>\n';
    
    return xml;
  } catch (error) {
    console.error("Error in generateDIContentFromForm:", error);
    throw error;
  }
}

// Function to generate SW file content without XML library
function generateSWContent(formData, filename) {
  try {
    // XML declaration and DOCTYPE
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<!DOCTYPE 交換表單 SYSTEM "104_roster_utf8.dtd">\n`;
    
    // Start main XML content
    xml += '<交換表單>\n';
    
    // Add content
    xml += `  <全銜>${typeof formData === 'object' ? (formData.recipient || '') : (formData || '')}</全銜>\n`;
    xml += '  <機關代碼>A15060000H</機關代碼>\n';
    xml += '  <含附件>含附件</含附件>\n';
    xml += '  <本別>\n';
    xml += '    <收發處理本別 代碼="正本"/>\n';
    xml += '  </本別>\n';
    
    // Close main tag
    xml += '</交換表單>\n';
    
    return xml;
  } catch (error) {
    console.error("Error in generateSWContent:", error);
    throw error;
  }
}

// Function to extract text content sections from PDF text
function extractContentSections(text) {
  const sections = {};
  
  // Regular expressions to match different sections
  const regexPatterns = {
    issuer: /(.+)\s*函/,
    documentDate: /發文日期：(中華民國\d+年\d+月\d+日)/,
    documentNumber: /發文字號：(.+)號/,
    attachment: /附件：(.+)/,
    subject: /主旨：(.+?)(?=說明：|$)/s,
    explanation: /說明：([\s\S]+?)(?=正本：|$)/,
    recipient: /正本：(.+?)(?=副本：|$)/,
    copyTo: /副本：(.+?)(?=地址：|$)/,
    address: /地址：(.+?)(?=承辦人|$)/,
    contact: /承辦人：(.+?)(?=聯絡方式|$)/,
    contactMethod: /聯絡方式：(.+?)(?=傳真|$)/,
    fax: /傳真：(.+?)(?=$)/
  };
  
  // Extract each section
  for (const [key, regex] of Object.entries(regexPatterns)) {
    const match = text.match(regex);
    if (match) {
      sections[key] = match[1].trim();
    }
  }
  
  // Process explanation section to extract numbered points
  if (sections.explanation) {
    const explanationPoints = [];
    const lines = sections.explanation.split('\n');
    let currentPoint = '';
    
    lines.forEach(line => {
      // Check if this is a new numbered point
      if (/^[一二三四五六七八九十]+、/.test(line)) {
        // If we already have a point in progress, save it
        if (currentPoint) {
          explanationPoints.push(currentPoint);
        }
        currentPoint = line;
      } else if (currentPoint) {
        // Add this line to the current point
        currentPoint += line;
      }
    });
    
    // Don't forget to add the last point
    if (currentPoint) {
      explanationPoints.push(currentPoint);
    }
    
    sections.explanationPoints = explanationPoints;
  }
  
  return sections;
}

// Function to generate DI file content from PDF extraction
function generateDIContentFromPDF(sections, filename) {
  try {
    // Generate DOCTYPE declarations
    let doctypeEntities = `<!ENTITY 表單 SYSTEM "${filename}.sw" NDATA DI>\n`;
    doctypeEntities += `<!ENTITY ATTACH1 SYSTEM "${filename}_ATTACH1.pdf" NDATA _X>\n`;
    doctypeEntities += `<!NOTATION _X SYSTEM "">\n<!NOTATION DI SYSTEM "">`;
    
    // XML declaration and DOCTYPE
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<!DOCTYPE 函 SYSTEM "104_2_utf8.dtd" [\n${doctypeEntities}\n]>\n`;
    
    // Extract document number details
    const { year, sequenceNumber } = extractDocNumber(sections.documentNumber);
    
    // Start main XML content
    xml += '<函>\n';
    
    // 發文機關 section
    xml += '  <發文機關>\n';
    xml += `    <全銜>${sections.issuer || ''}</全銜>\n`;
    xml += '    <機關代碼>EB88387577</機關代碼>\n';
    xml += '  </發文機關>\n';
    
    // 函類別 section
    xml += '  <函類別 代碼="函"/>\n';
    
    // Address and contact info
    xml += `  <地址>${sections.address || ''}</地址>\n`;
    xml += `  <聯絡方式>承辦人：${sections.contact || ''}</聯絡方式>\n`;
    xml += `  <聯絡方式>聯絡方式：${sections.contactMethod || ''}</聯絡方式>\n`;
    xml += `  <聯絡方式>傳真：${sections.fax || ''}</聯絡方式>\n`;
    
    // 受文者 section
    xml += '  <受文者>\n';
    xml += `    <交換表 交換表單="表單">${sections.recipient || ''}</交換表>\n`;
    xml += '  </受文者>\n';
    
    // 發文日期 section
    xml += '  <發文日期>\n';
    xml += `    <年月日>${sections.documentDate || ''}</年月日>\n`;
    xml += '  </發文日期>\n';
    
    // 發文字號 section
    xml += '  <發文字號>\n';
    xml += `    <字>${sections.documentNumber ? sections.documentNumber.split('字第')[0] : ''}</字>\n`;
    xml += '    <文號>\n';
    xml += `      <年度>${year || ''}</年度>\n`;
    xml += `      <流水號>${sequenceNumber || ''}</流水號>\n`;
    xml += '    </文號>\n';
    xml += '  </發文字號>\n';
    
    // 速別 section
    xml += '  <速別 代碼="普通件"/>\n';
    
    // 密等及解密條件或保密期限 section
    xml += '  <密等及解密條件或保密期限>\n';
    xml += '    <密等></密等>\n';
    xml += '    <解密條件或保密期限></解密條件或保密期限>\n';
    xml += '  </密等及解密條件或保密期限>\n';
    
    // 附件 section
    xml += '  <附件>\n';
    xml += `    <文字>${sections.attachment || '如文'}</文字>\n`;
    xml += '    <附件檔名 附件名="ATTACH1"/>\n';
    xml += '  </附件>\n';
    
    // 主旨 section
    xml += '  <主旨>\n';
    xml += `    <文字>${sections.subject || ''}</文字>\n`;
    xml += '  </主旨>\n';
    
    // 段落 (explanation) section
    xml += '  <段落 段名="說明：">\n';
    
    // Add explanation points
    if (sections.explanationPoints && sections.explanationPoints.length > 0) {
      sections.explanationPoints.forEach((point, index) => {
        // Extract the number marker (e.g., "一、", "二、")
        const numberMatch = point.match(/^([一二三四五六七八九十]+、)/);
        const marker = numberMatch ? numberMatch[1] : `${index + 1}、`;
        const content = point.replace(/^[一二三四五六七八九十]+、/, '').trim();
        
        xml += `    <條列 序號="${marker}">\n`;
        xml += `      <文字>${content}</文字>\n`;
        xml += '    </條列>\n';
      });
    }
    
    xml += '  </段落>\n';
    
    // 正本 section
    xml += '  <正本>\n';
    xml += `    <全銜>${sections.recipient || ''}</全銜>\n`;
    xml += '  </正本>\n';
    
    // 副本 section
    xml += `  <副本>${sections.copyTo || ''}</副本>\n`;
    
    // 署名 section
    xml += '  <署名> </署名>\n';
    
    // Close main tag
    xml += '</函>\n';
    
    return xml;
  } catch (error) {
    console.error("Error in generateDIContentFromPDF:", error);
    throw error;
  }
}

// API endpoint to generate files from form data
app.post('/generate', upload.any(), async (req, res) => {
  try {
    console.log("Generate endpoint called");
    console.log("Request body:", JSON.stringify(req.body));
    console.log("Files received:", req.files ? req.files.length : 0);
    
    const outputDir = path.join('outputs', uuidv4());
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Generate a unique document number if not provided
    let baseFilename;
    if (req.body.documentNumber) {
      const { year, sequenceNumber } = extractDocNumber(req.body.documentNumber);
      baseFilename = `${year}${sequenceNumber.padStart(7, '0')}`;
    } else {
      // Generate a random document number
      const today = new Date();
      const rocYear = today.getFullYear() - 1911;
      const month = (today.getMonth() + 1).toString().padStart(2, '0');
      const day = today.getDate().toString().padStart(2, '0');
      const randomNum = Math.floor(Math.random() * 9000) + 1000;
      baseFilename = `${rocYear}${month}${day}${randomNum}`;
    }
    console.log("Generated baseFilename:", baseFilename);
    
    // Process PDF attachments
    const attachmentFiles = [];
    const attachmentFilenames = [];
    
    if (req.files && req.files.length > 0) {
      console.log("Processing files:", req.files.length);
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        console.log("Processing file:", file.originalname);
        
        // Only process files that have 'pdfAttachment' in the fieldname
        if (file.fieldname.includes('pdfAttachment')) {
          const attachmentFilename = `${baseFilename}_ATTACH${attachmentFiles.length + 1}.pdf`;
          const attachmentPath = path.join(outputDir, attachmentFilename);
          
          console.log(`Copying file from ${file.path} to ${attachmentPath}`);
          fs.copyFileSync(file.path, attachmentPath);
          
          attachmentFiles.push(attachmentPath);
          attachmentFilenames.push(attachmentFilename);
        }
      }
    }
    
    console.log("Attachment filenames:", attachmentFilenames);
    
    // Generate DI and SW files
    console.log("Generating DI content");
    const diContent = generateDIContentFromForm(req.body, baseFilename, attachmentFilenames);
    console.log("Generating SW content");
    const swContent = generateSWContent(req.body, baseFilename);
    
    // Write the files
    try {
      const diPath = path.join(outputDir, `${baseFilename}.di`);
      const swPath = path.join(outputDir, `${baseFilename}.sw`);
      
      console.log("Writing DI file to:", diPath);
      fs.writeFileSync(diPath, diContent);
      console.log("Writing SW file to:", swPath);
      fs.writeFileSync(swPath, swContent);
      
      // Create a ZIP file with all the output files
      console.log("Creating ZIP file");
      const zip = new JSZip();
      zip.file(`${baseFilename}.di`, fs.readFileSync(diPath));
      zip.file(`${baseFilename}.sw`, fs.readFileSync(swPath));
      
      // Add all attachments to the ZIP
      for (let i = 0; i < attachmentFilenames.length; i++) {
        console.log(`Adding ${attachmentFilenames[i]} to ZIP`);
        zip.file(attachmentFilenames[i], fs.readFileSync(attachmentFiles[i]));
      }
      
      console.log("Generating ZIP buffer");
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
      const zipPath = path.join(outputDir, `${baseFilename}.zip`);
      console.log("Writing ZIP file to:", zipPath);
      fs.writeFileSync(zipPath, zipBuffer);
      
      // Prepare response with file paths
      const responseFiles = {
        di: `/download/${path.basename(outputDir)}/${baseFilename}.di`,
        sw: `/download/${path.basename(outputDir)}/${baseFilename}.sw`,
        zip: `/download/${path.basename(outputDir)}/${baseFilename}.zip`
      };
      
      // Add paths for each attachment if they exist
      if (attachmentFilenames.length > 0) {
        responseFiles.attachments = attachmentFilenames.map((filename, index) => ({
          name: `附件 ${index + 1}`,
          path: `/download/${path.basename(outputDir)}/${filename}`
        }));
      }
      
      console.log("Sending success response");
      // Send the files back to the client
      res.status(200).json({
        message: 'Generation successful',
        files: responseFiles
      });
    } catch (error) {
      console.error("Error in writing files:", error);
      res.status(500).json({
        error: true,
        message: `Error writing files: ${error.message}`,
        stack: error.stack
      });
    }
  } catch (error) {
    console.error('Error generating files:', error);
    // Send a more detailed error response
    res.status(500).json({
      error: true,
      message: `Error generating files: ${error.message}`,
      stack: error.stack
    });
  }
});

// API endpoint to process a PDF file
app.post('/convert', upload.single('pdfFile'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: true, message: 'No file uploaded' });
  }
  
  try {
    console.log("Convert endpoint called");
    const pdfPath = req.file.path;
    console.log("PDF path:", pdfPath);
    
    const outputDir = path.join('outputs', uuidv4());
    console.log("Output directory:", outputDir);
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Extract text from PDF
    console.log("Extracting text from PDF");
    const pdfData = await pdfExtract.extract(pdfPath, {});
    const pdfText = pdfData.pages.map(page => page.content.map(item => item.str).join(' ')).join('\n');
    
    // Extract content sections
    console.log("Extracting content sections");
    const sections = extractContentSections(pdfText);
    
    // Generate base filename from document number
    const { year, sequenceNumber } = extractDocNumber(sections.documentNumber || '');
    const baseFilename = year && sequenceNumber ? 
      `${year}${sequenceNumber.padStart(7, '0')}` : 
      `${Date.now().toString().substring(0, 10)}`;
    
    console.log("Generated baseFilename:", baseFilename);
    
    // Generate DI and SW files
    console.log("Generating DI content");
    const diContent = generateDIContentFromPDF(sections, baseFilename);
    console.log("Generating SW content");
    const swContent = generateSWContent(sections, baseFilename);
    
    // Write the files
    try {
      const diPath = path.join(outputDir, `${baseFilename}.di`);
      const swPath = path.join(outputDir, `${baseFilename}.sw`);
      const pdfOutputPath = path.join(outputDir, `${baseFilename}_ATTACH1.pdf`);
      
      console.log("Writing DI file to:", diPath);
      fs.writeFileSync(diPath, diContent);
      console.log("Writing SW file to:", swPath);
      fs.writeFileSync(swPath, swContent);
      console.log("Copying PDF to:", pdfOutputPath);
      fs.copyFileSync(pdfPath, pdfOutputPath);
      
      // Create a ZIP file with all the output files
      console.log("Creating ZIP file");
      const zip = new JSZip();
      zip.file(`${baseFilename}.di`, fs.readFileSync(diPath));
      zip.file(`${baseFilename}.sw`, fs.readFileSync(swPath));
      zip.file(`${baseFilename}_ATTACH1.pdf`, fs.readFileSync(pdfOutputPath));
      
      console.log("Generating ZIP buffer");
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
      const zipPath = path.join(outputDir, `${baseFilename}.zip`);
      console.log("Writing ZIP file to:", zipPath);
      fs.writeFileSync(zipPath, zipBuffer);
      
      // Send the files back to the client
      console.log("Sending success response");
      res.status(200).json({
        message: 'Conversion successful',
        files: {
          di: `/download/${path.basename(outputDir)}/${baseFilename}.di`,
          sw: `/download/${path.basename(outputDir)}/${baseFilename}.sw`,
          pdf: `/download/${path.basename(outputDir)}/${baseFilename}_ATTACH1.pdf`,
          zip: `/download/${path.basename(outputDir)}/${baseFilename}.zip`
        }
      });
    } catch (error) {
      console.error("Error in writing files:", error);
      res.status(500).json({
        error: true,
        message: `Error writing files: ${error.message}`,
        stack: error.stack
      });
    }
  } catch (error) {
    console.error('Error processing PDF:', error);
    res.status(500).json({
      error: true,
      message: `Error processing PDF: ${error.message}`,
      stack: error.stack
    });
  }
});

// Endpoint to download generated files
app.get('/download/:dir/:file', (req, res) => {
  const filePath = path.join('outputs', req.params.dir, req.params.file);
  
  if (fs.existsSync(filePath)) {
    return res.download(filePath);
  } else {
    return res.status(404).send('File not found');
  }
});

// Serve the main HTML page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Visit http://localhost:${port} in your browser`);
});

// Cleanup function for old files (called periodically)
function cleanupOldFiles() {
  const uploadDir = path.join(__dirname, 'uploads');
  const outputDir = path.join(__dirname, 'outputs');
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  
  // Clean uploads directory
  if (fs.existsSync(uploadDir)) {
    fs.readdirSync(uploadDir).forEach(file => {
      const filePath = path.join(uploadDir, file);
      const stats = fs.statSync(filePath);
      if (now - stats.mtime.getTime() > maxAge) {
        fs.unlinkSync(filePath);
      }
    });
  }
  
  // Clean outputs directory
  if (fs.existsSync(outputDir)) {
    fs.readdirSync(outputDir).forEach(dir => {
      const dirPath = path.join(outputDir, dir);
      const stats = fs.statSync(dirPath);
      if (now - stats.mtime.getTime() > maxAge) {
        fs.rmSync(dirPath, { recursive: true, force: true });
      }
    });
  }
}

// Run cleanup every 6 hours
setInterval(cleanupOldFiles, 6 * 60 * 60 * 1000);

// Make sure to serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Export the Express app as a Firebase Function
exports.app = functions.https.onRequest(app);