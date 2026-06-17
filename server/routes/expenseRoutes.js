import express from "express";
import { checkBudgetThresholds } from "../utils/budgetAlertEngine.js";
import multer from "multer";
import ExcelJS from "exceljs";
import { addExpense, getExpenses, scanReceiptAndProcess } from "../controllers/expenseController.js"; 
import Expense from "../models/Expense.js";
import User from "../models/User.js";
import sendEmail from "../utils/sendemail.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import mammoth from "mammoth"; // 🚀 Imported for MS Word documents parsing
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB Limit
});

// ==========================================
// 🧼 NATIVE RTF TAGS AND METADATA CLEANER
// ==========================================
function cleanRTFToText(rtfStr) {
  // Removes internal RTF layout tags, control words, and backslashes safely
  let text = rtfStr.replace(/\\([a-z]{1,32})(-?\d+)? ?/g, "");
  text = text.replace(/\{[^}]*\}/g, "");
  text = text.replace(/[\r\n\t]/g, " ");
  return text.trim();
}

// ==========================================
// 🧠 STRICT EXACT STANDARD CATEGORIZATION
// ==========================================
const autoCategorize = (description) => {
  const desc = (description || "").toLowerCase().trim();
  
  if (/interest expense|interest/i.test(desc)) {
    return "Other";
  }
  
  if (/groceries|grocery|smith\'s|smiths/i.test(desc)) {
    return "Groceries"; 
  }

  if (/credit|beginning balance|balance|account balance/i.test(desc)) {
    return "Bills & Utilities";
  }

  if (/zomato|swiggy|restaurant|hotel|food|cafe|mcdonald|starbucks|blinkit|zepto|instamart|eat|canteen|dinner|lunch|breakfast|bakery|diner|dining/i.test(desc)) {
    return "Food & Drinks";
  }
  
  if (/uber|ola|rapido|irctc|flight|metro|petrol|fuel|shell|diesel|train|bus|cab|travel|transport|automart|car|bike|garage|auto|jay\'s auto mart/i.test(desc)) {
    return "Travel & Transport";
  }
  
  if (/amazon|flipkart|myntra|zara|h&m|mall|shopping|clothing|electronics|shoes|apparel|store|walmart|target|boutique/i.test(desc)) {
    return "Shopping";
  }
  
  if (/jio|airtel|electricity|water|gas|broadband|recharge|rent|netflix|spotify|prime|bill|utilities|phone|cell|insurance|tax/i.test(desc)) {
    return "Bills & Utilities";
  }
  
  if (/movie|pvr|inox|gaming|pub|club|bar|concert|theater|booking|fun|entertainment|show|ticket|resort/i.test(desc)) {
    return "Entertainment";
  }
  
  return "Other";
};

// ==========================================
// 🧼 UNIVERSAL AMOUNT CLEANER & EXTRACTOR
// ==========================================
const cleanAmount = (amtStr) => {
  if (amtStr === undefined || amtStr === null) return 0;
  if (typeof amtStr === 'object' && amtStr.result !== undefined) {
    amtStr = amtStr.result;
  }

  let str = amtStr.toString().replace(/,/g, "").trim();
  const matched = str.match(/[-+]?[0-9]*\.?[0-9]+/);
  if (!matched) return 0;

  const parsed = parseFloat(matched[0]);
  return isNaN(parsed) ? 0 : Math.abs(parsed);
};

// ==========================================
// 🧼 DESCRIPTION CLEANER & ENHANCER
// ==========================================
const cleanDescription = (text) => {
  let clean = text.replace(/^[^a-zA-Z0-9]*|[^a-zA-Z0-9]*$/g, '').trim();
  if (/^food$/i.test(clean)) return "Food & Drinks Expense";
  if (/^travel$/i.test(clean)) return "Travel & Transport";
  if (/^bill$/i.test(clean)) return "Utilities Bill";
  return clean;
};

// ==========================================
// 🚀 UNIVERSAL SMART SCANNER ENDPOINT
// ==========================================
router.post("/scan", verifyToken, upload.single("file"), async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Accept either multipart uploads via req.file or JSON/base64 payloads via req.body.imageBuffer.
    if (!req.file && req.body && req.body.imageBuffer) {
      const buffer = Buffer.from(req.body.imageBuffer, "base64");
      const fileName = req.body.scannedDocumentName || `upload.${(req.body.mimeType || "application/octet-stream").split("/").pop()}`;
      req.file = {
        buffer,
        mimetype: req.body.mimeType || "application/octet-stream",
        originalname: fileName,
        size: buffer.length,
      };
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded or payload data provided." });
    }

    const mimeType = req.file.mimetype;
    const fileName = req.file.originalname.toLowerCase();
    let rawTransactions = [];
    let extractedText = "";

    // 📸 OPTION A: IMAGE SCANNER
    if (mimeType.startsWith("image/")) {
      const base64String = req.file.buffer.toString("base64");
      req.body.imageBuffer = base64String;
      req.body.mimeType = mimeType;
      return scanReceiptAndProcess(req, res);
    }

    // 📊 OPTION B: EXCEL / CSV DYNAMIC COLUMNS PARSER
    else if (mimeType.includes("sheet") || mimeType.includes("excel") || mimeType.includes("csv") || fileName.endsWith(".xlsx") || fileName.endsWith(".xls") || fileName.endsWith(".csv")) {
      try {
        const workbook = new ExcelJS.Workbook();
        if (fileName.endsWith(".csv") || mimeType.includes("csv")) {
          await workbook.csv.load(req.file.buffer);
        } else {
          await workbook.xlsx.load(req.file.buffer);
        }

        const worksheet = workbook.getWorksheet(1) || workbook.worksheets[0];
        if (!worksheet) {
          return res.status(400).json({ success: false, message: "Sheet dynamic error: Active sheet not resolved." });
        }

        let descColIndex = -1;
        let amtColIndex = -1;
        let dateColIndex = -1;

        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
          const rowValues = Array.isArray(row.values) ? row.values : Object.values(row.values || {});
          
          if (descColIndex === -1 || amtColIndex === -1) {
            for (let i = 0; i < rowValues.length; i++) {
              const valStr = (rowValues[i] || "").toString().toLowerCase().trim();
              if (/description|details|particulars|item|payee|title|narration/i.test(valStr)) {
                descColIndex = i;
              }
              if (/expense|amount|money out|debit|cost|price|paid/i.test(valStr)) {
                amtColIndex = i;
              }
              if (/date|time|transaction date/i.test(valStr)) {
                dateColIndex = i;
              }
            }
            return; 
          }

          const title = rowValues[descColIndex] ? rowValues[descColIndex].toString().trim() : "";
          const amount = cleanAmount(rowValues[amtColIndex]);

          if (!title || amount === 0 || /subtotal|summary|total income|total expense|percent|salary/i.test(title.toLowerCase())) {
            return;
          }

          let expenseDate = new Date();
          if (dateColIndex !== -1 && rowValues[dateColIndex]) {
            const potentialDate = rowValues[dateColIndex];
            if (potentialDate instanceof Date) {
              expenseDate = potentialDate;
            } else {
              const parsedDate = new Date(potentialDate.toString());
              if (!isNaN(parsedDate.getTime())) expenseDate = parsedDate;
            }
          }

          rawTransactions.push({ description: cleanDescription(title), amount: amount, date: expenseDate });
        });
      } catch (excelErr) {
        console.error("🚨 Excel Core Parser Fault:", excelErr);
        return res.status(400).json({ success: false, message: "Failed to parse spreadsheet matrix dynamically." });
      }
    }
    
    // 📄 OPTION C: ADVANCED HYBRID PDF PARSER
    else if (mimeType.includes("pdf") || fileName.endsWith(".pdf")) {
      try {
        const pdfData = await pdfParse(req.file.buffer);
        
        if (!pdfData || !pdfData.text || pdfData.text.trim().length === 0) {
          console.log("⚠️ Scanned PDF detected, diverting to AI OCR Engine...");
          const base64String = req.file.buffer.toString("base64");
          req.body.imageBuffer = base64String;
          req.body.mimeType = "application/pdf";
          return scanReceiptAndProcess(req, res);
        }

        const textLines = pdfData.text.split("\n");

        textLines.forEach((line) => {
          const cleanLine = line.trim();
          if (!cleanLine || cleanLine.length < 3) return;

          const allNumbers = cleanLine.match(/[\d,]+\.\d{2}|[\d,]+/g);

          if (allNumbers && allNumbers.length > 0) {
            const rawAmt = allNumbers[allNumbers.length - 1];
            const amount = cleanAmount(rawAmt);

            let descStr = cleanLine.replace(rawAmt, "").replace(/[₹$$,]/g, "").trim();
            descStr = cleanDescription(descStr);

            const lowerDesc = descStr.toLowerCase();

            if (descStr && amount > 0 && !/salary|percent|subtotal|page|statement|summary|total income|total expense|line item|example|budget/i.test(lowerDesc)) {
              rawTransactions.push({ 
                description: descStr, 
                amount: amount, 
                date: new Date() 
              });
            }
          }
        });

      } catch (pdfErr) {
        console.error("🚨 PDF Native Error, switching to OCR mode:", pdfErr);
        const base64String = req.file.buffer.toString("base64");
        req.body.imageBuffer = base64String;
        req.body.mimeType = "application/pdf";
        return scanReceiptAndProcess(req, res);
      }
    }

    // 📝 🚀 OPTION D: MULTI-DOCUMENT TEXT ENGINE FOR SEPARATE LOGS (.txt, .docx, .rtf)
    else if (
      mimeType.includes("text") || 
      mimeType.includes("word") || 
      mimeType.includes("rtf") ||
      fileName.endsWith(".txt") || 
      fileName.endsWith(".docx") || 
      fileName.endsWith(".doc") || 
      fileName.endsWith(".rtf")
    ) {
      try {
        // Isolated Block 1: Word Processing files (.docx / .doc)
        if (fileName.endsWith(".docx") || fileName.endsWith(".doc") || mimeType.includes("word")) {
          console.log("Processing independent .docx word stream variables...");
          const docxResult = await mammoth.extractRawText({ buffer: req.file.buffer });
          extractedText = docxResult.value;
        } 
        // Isolated Block 2: Rich Text Format (.rtf) using Built-in native cleaner function
        else if (fileName.endsWith(".rtf") || mimeType.includes("rtf")) {
          console.log("Processing independent .rtf natively without 404 libraries...");
          const rtfRawString = req.file.buffer.toString("utf-8");
          extractedText = cleanRTFToText(rtfRawString);
        } 
        // Isolated Block 3: Plain Notepad files (.txt)
        else if (fileName.endsWith(".txt") || mimeType.includes("text")) {
          console.log("Processing independent .txt native string conversion...");
          extractedText = req.file.buffer.toString("utf-8");
        }

        // Content validation guard
        if (!extractedText || extractedText.trim().length === 0) {
          return res.status(400).json({ success: false, message: "Uploaded document appears empty or corrupt." });
        }

        // Convert clean raw text block variables into base64 format for safe AI processing stream
        const textBase64 = Buffer.from(extractedText).toString("base64");
        req.body.imageBuffer = textBase64;
        req.body.mimeType = "text/plain"; 

        console.log(`🚀 Isolated text document (${fileName}) parsed successfully. Relaying straight to AI controller payload.`);
        return scanReceiptAndProcess(req, res);

      } catch (docErr) {
        console.error("🚨 Text Document Component Core Error:", docErr);
        return res.status(400).json({ success: false, message: "Structural extraction failed on text document parser." });
      }
    } 
    
    // EXCEPTION TRAP
    else {
      return res.status(400).json({ success: false, message: "Unsupported file layout format uploaded." });
    }

    if (rawTransactions.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Could not map structural columns or valid transactions." 
      });
    }

    const bulkPayload = rawTransactions.map((tx) => ({
      userId,
      description: tx.description,
      amount: tx.amount,
      category: autoCategorize(tx.description), 
      date: tx.date
    }));

    const savedTransactions = await Expense.insertMany(bulkPayload);
    savedTransactions.forEach((tx) => {
      checkBudgetThresholds(userId, tx.category, tx.amount);
    });
    return res.status(201).json({
      success: true,
      message: `Successfully processed file layout! Imported ${savedTransactions.length} expenses. 🎉`,
      count: savedTransactions.length
    });

  } catch (err) {
    console.error("Universal Scanner Architecture Crash:", err);
    return res.status(500).json({ success: false, message: "Pipeline error resolving file layout rules parameters." });
  }
});

// ==========================================
// 🛠️ TRADITIONAL CRUD PIPELINES
// ==========================================
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const expenseId = req.params.id;
    const deletedExpense = await Expense.findByIdAndDelete(expenseId);
    if (!deletedExpense) {
      return res.status(404).json({ success: false, msg: "Expense record not found in system logs." });
    }
    return res.status(200).json({ success: true, msg: "Expense log successfully deleted!" });
  } catch (err) {
    console.error("🚨 Delete Route Architecture Error:", err);
    return res.status(500).json({ success: false, msg: "Database exception occurred." });
  }
});

router.get("/:userId", verifyToken, getExpenses);
router.post("/", verifyToken, addExpense);
router.post("/add", verifyToken, addExpense);

export default router;