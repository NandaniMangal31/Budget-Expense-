import express from "express";
import multer from "multer";
import ExcelJS from "exceljs";
import mammoth from "mammoth";
import { createRequire } from "module";

// Controller & Service Layer Hookups
import { addExpense, getExpenses, scanReceiptAndProcess } from "../controllers/expenseController.js"; 
import { checkBudgetThresholds } from "../utils/budgetAlertEngine.js";
import { verifyToken } from "../middleware/authMiddleware.js"; // 🎯 FIX: Corrected plural folder path references
import Expense from "../models/Expense.js";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

const router = express.Router();

// Define a unified, secure memory stream allocation profile
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // Locked down at a maximum of 25MB
});

// ==========================================
// 🧼 NATIVE RTF TAGS AND METADATA CLEANER
// ==========================================
function cleanRTFToText(rtfStr) {
  if (!rtfStr || typeof rtfStr !== "string") return "";
  let text = rtfStr;
  text = text.replace(/\\'([0-9a-fA-F]{2})/g, (m, hex) => {
    try { return String.fromCharCode(parseInt(hex, 16)); } catch { return ""; }
  });
  text = text.replace(/\\par[d]?/g, "\n").replace(/\\tab/g, "\t");
  text = text.replace(/\\[a-zA-Z]+-?\d*\s?/g, "").replace(/[{}]/g, "");
  return text.replace(/\s+/g, " ").trim();
}

// ==========================================
// 🧠 STRICT EXACT STANDARD CATEGORIZATION
// ==========================================
const autoCategorize = (description) => {
  const desc = (description || "").toLowerCase().trim();
  if (/interest expense|interest/i.test(desc)) return "Other";
  if (/groceries|grocery|smith\'s|smiths/i.test(desc)) return "Groceries"; 
  if (/credit|beginning balance|balance|account balance/i.test(desc)) return "Bills & Utilities";
  if (/zomato|swiggy|restaurant|hotel|food|cafe|mcdonald|starbucks|blinkit|zepto|instamart|eat|canteen|dinner|lunch|breakfast|bakery|diner|dining/i.test(desc)) return "Food & Drinks";
  if (/uber|ola|rapido|irctc|flight|metro|petrol|fuel|shell|diesel|train|bus|cab|travel|transport|automart|car|bike|garage|auto|jay\'s auto mart/i.test(desc)) return "Travel & Transport";
  if (/amazon|flipkart|myntra|zara|h&m|mall|shopping|clothing|electronics|shoes|apparel|store|walmart|target|boutique/i.test(desc)) return "Shopping";
  if (/jio|airtel|electricity|water|gas|broadband|recharge|rent|netflix|spotify|prime|bill|utilities|phone|cell|insurance|tax/i.test(desc)) return "Bills & Utilities";
  if (/movie|pvr|inox|gaming|pub|club|bar|concert|theater|booking|fun|entertainment|show|ticket|resort/i.test(desc)) return "Entertainment";
  return "Other";
};

// ==========================================
// 🧼 UNIVERSAL AMOUNT CLEANER & EXTRACTOR
// ==========================================
const cleanAmount = (amtStr) => {
  if (amtStr === undefined || amtStr === null) return 0;
  if (typeof amtStr === 'object' && amtStr.result !== undefined) amtStr = amtStr.result;
  let str = amtStr.toString().replace(/,/g, "").trim();
  const matched = str.match(/[-+]?[0-9]*\.?[0-9]+/);
  if (!matched) return 0;
  const parsed = parseFloat(matched[0]);
  return isNaN(parsed) ? 0 : Math.abs(parsed);
};

const cleanDescription = (text) => {
  let clean = text.replace(/^[^a-zA-Z0-9]*|[^a-zA-Z0-9]*$/g, '').trim();
  if (/^food$/i.test(clean)) return "Food & Drinks Expense";
  if (/^travel$/i.test(clean)) return "Travel & Transport";
  if (/^bill$/i.test(clean)) return "Utilities Bill";
  return clean;
};

/* ==========================================
   🚀 UNIVERSAL SMART SCANNER ENDPOINT
   ========================================== */
router.post("/scan", verifyToken, upload.single("file"), async (req, res, next) => {
  try {
    const userId = req.user ? req.user._id : null;
    req.body = req.body || {};

    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded!" });
    }

    const mimeType = req.file.mimetype || "";
    const fileName = (req.file.originalname || "unknown").toLowerCase();
    let rawTransactions = [];
    let extractedText = "";

    // 📸 OPTION A: IMAGE SCANNER
    if (mimeType.startsWith("image/")) {
      const base64String = req.file.buffer.toString("base64");
      req.body.imageBuffer = base64String;
      req.body.mimeType = mimeType;
      if (userId) req.body.userId = userId.toString();

      console.log("🚀 Mapping dynamic base64 frames. Handing over execution to AI scanning controller...");
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
          return res.status(400).json({ success: false, message: "Active spreadsheet sheet framework could not be resolved." });
        }

        let descColIndex = -1;
        let amtColIndex = -1;
        let dateColIndex = -1;

        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
          const rowValues = Array.isArray(row.values) ? row.values : Object.values(row.values || {});
          
          if (descColIndex === -1 || amtColIndex === -1) {
            for (let i = 0; i < rowValues.length; i++) {
              const valStr = (rowValues[i] || "").toString().toLowerCase().trim();
              if (/description|details|particulars|item|payee|title|narration/i.test(valStr)) descColIndex = i;
              if (/expense|amount|money out|debit|cost|price|paid/i.test(valStr)) amtColIndex = i;
              if (/date|time|transaction date/i.test(valStr)) dateColIndex = i;
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
        console.error("🚨 Excel Core Parser Fault:", excelErr.message);
        
        if (fileName.endsWith(".csv") || mimeType.includes("csv")) {
          try {
            const text = req.file.buffer.toString("utf-8");
            const lines = text.split(/\r?\n/).filter((l) => l.trim());
            if (lines.length > 0) {
              const headers = lines[0].split(/,|\t/).map((h) => h.toString().toLowerCase().trim());
              let dIdx = headers.findIndex((h) => /description|details|particulars|item|payee|title|narration/.test(h));
              let aIdx = headers.findIndex((h) => /expense|amount|money out|debit|cost|price|paid/.test(h));
              if (dIdx === -1) dIdx = 0;
              if (aIdx === -1) aIdx = Math.max(0, headers.length - 1);

              for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(/,|\t/);
                const title = (cols[dIdx] || "").toString().trim();
                const amount = cleanAmount(cols[aIdx] || "");
                if (!title || amount === 0) continue;
                rawTransactions.push({ description: cleanDescription(title), amount: amount, date: new Date() });
              }
            }
          } catch {
            return res.status(500).json({ success: false, message: "Failed parsing structured system database logs from file entries." });
          }
        } else {
          return res.status(500).json({ success: false, message: "Failed parsing structured system database logs from file entries." });
        }
      }
    }
    
    // 📄 OPTION C: ADVANCED HYBRID PDF PARSER
    else if (mimeType.includes("pdf") || fileName.endsWith(".pdf")) {
      try {
        const pdfData = await pdfParse(req.file.buffer);
        
        if (!pdfData || !pdfData.text || pdfData.text.trim().length === 0) {
          req.body.imageBuffer = req.file.buffer.toString("base64");
          req.body.mimeType = "application/pdf";
          if (userId) req.body.userId = userId.toString();
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

            if (descStr && amount > 0 && !/salary|percent|subtotal|page|statement|summary|total income|total expense|line item|example|budget/i.test(descStr.toLowerCase())) {
              rawTransactions.push({ description: descStr, amount: amount, date: new Date() });
            }
          }
        });
      } catch (pdfErr) {
        req.body.imageBuffer = req.file.buffer.toString("base64");
        req.body.mimeType = "application/pdf";
        if (userId) req.body.userId = userId.toString();
        return scanReceiptAndProcess(req, res);
      }
    }

    // 📝 OPTION D: TEXT DOCUMENTS (DOCX, RTF, TXT)
    else if (fileName.endsWith(".rtf") || fileName.endsWith(".txt") || fileName.endsWith(".docx") || fileName.endsWith(".doc") || mimeType.includes("text") || mimeType.includes("word") || mimeType.includes("rtf") || mimeType.includes("octet-stream")) {
      try {
        if (fileName.endsWith(".rtf") || mimeType.includes("rtf")) {
          const rtfRawString = req.file.buffer.toString("utf-8");
          extractedText = cleanRTFToText(rtfRawString);
        } else if (fileName.endsWith(".docx") || fileName.endsWith(".doc") || mimeType.includes("word")) {
          const docxResult = await mammoth.extractRawText({ buffer: req.file.buffer });
          extractedText = docxResult.value;
        } else {
          extractedText = req.file.buffer.toString("utf-8");
        }

        if (!extractedText || extractedText.trim().length === 0) {
          return res.status(400).json({ success: false, message: "Uploaded document appears empty or corrupt." });
        }

        req.body.imageBuffer = Buffer.from(extractedText).toString("base64");
        req.body.mimeType = "text/plain";
        if (userId) req.body.userId = userId.toString();

        return scanReceiptAndProcess(req, res);
      } catch (docErr) {
        return res.status(400).json({ success: false, message: "Structural text extraction sequence failed." });
      }
    } else {
      return res.status(400).json({ success: false, message: "Unsupported file layout format uploaded." });
    }

    if (rawTransactions.length === 0) {
      return res.status(400).json({ success: false, message: "Could not map structural columns or track valid transactions inside file entries." });
    }

    const bulkPayload = rawTransactions.map((tx) => ({
      userId: userId ? userId.toString() : "",
      description: tx.description,
      amount: tx.amount,
      category: autoCategorize(tx.description), 
      date: tx.date
    }));

    // Perform atomic ledger insertions
    const savedTransactions = await Expense.insertMany(bulkPayload);
    
    // 🎯 FIX: Wrapped async background alert iterations securely inside an atomic Promise handler to kill crash vectors
    if (typeof checkBudgetThresholds === "function" && savedTransactions.length > 0) {
      const backgroundNotificationAlerts = savedTransactions.map((tx) => 
        checkBudgetThresholds(userId, tx.category, tx.amount).catch((alertErr) => 
          console.error(`⚠️ Budget Engine background error tracking: ${alertErr.message}`)
        )
      );
      // Let checks process concurrently in the background safely
      Promise.allSettled(backgroundNotificationAlerts);
    }

    return res.status(201).json({
      success: true,
      message: `Successfully processed file layout! Imported ${savedTransactions.length} expenses. 🎉`,
      count: savedTransactions.length
    });

  } catch (err) {
    console.error("🚨 Universal Scanner Architecture Crash Log Trace:", err);
    return res.status(500).json({ success: false, message: "An internal pipeline error occurred while processing this file." });
  }
});

/* ==========================================
   🛠️ TRADITIONAL CRUD ENDPOINTS
   ========================================== */
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const deletedExpense = await Expense.findByIdAndDelete(req.params.id);
    if (!deletedExpense) {
      return res.status(404).json({ success: false, msg: "Expense record not found in system logs." });
    }
    return res.status(200).json({ success: true, msg: "Expense log successfully deleted!" });
  } catch (err) {
    console.error("🚨 Delete Route Architecture Error:", err);
    return res.status(500).json({ success: false, msg: "Database exception occurred." });
  }
});

router.get("/user/:userId", verifyToken, getExpenses);
router.post("/add", verifyToken, addExpense);

export default router;