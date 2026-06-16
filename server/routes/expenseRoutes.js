import express from "express";
import { checkBudgetThresholds } from "../utils/budgetAlertEngine.js";
import multer from "multer";
import ExcelJS from "exceljs";
import { addExpense, getExpenses, scanReceiptAndProcess } from "../controllers/expenseController.js"; 
import Expense from "../models/Expense.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import mammoth from "mammoth";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB Limit
});

// ==========================================
// 🧠 STRICT CATEGORY ENUM ALIGNMENT
// ==========================================
const autoCategorize = (description) => {
  const desc = (description || "").toLowerCase().trim();

  if (/zomato|swiggy|restaurant|hotel|food|cafe|mcdonald|starbucks|blinkit|zepto|instamart|eat|canteen|dinner|lunch|breakfast|bakery|diner|dining|groceries|grocery/i.test(desc)) {
    return "Food & Drinks";
  }
  if (/uber|ola|rapido|irctc|flight|metro|petrol|fuel|shell|diesel|train|bus|cab|travel|transport|car|bike|garage|auto/i.test(desc)) {
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
// 🧼 AMOUNT CLEANER
// ==========================================
const cleanAmount = (amtStr) => {
  if (!amtStr) return 0;
  let str = amtStr.toString().replace(/,/g, "").trim();
  const matched = str.match(/[-+]?[0-9]*\.?[0-9]+/);
  if (!matched) return 0;
  const parsed = parseFloat(matched[0]);
  return isNaN(parsed) ? 0 : Math.abs(parsed);
};

// ==========================================
// 🚀 UNIVERSAL SMART SCANNER ENDPOINT
// ==========================================
router.post("/scan", verifyToken, upload.single("file"), async (req, res) => {
  try {
    const userId = req.user._id;
    
    // ✅ Handle JSON payload with base64 imageBuffer (from client)
    if (req.body.imageBuffer && req.body.mimeType) {
      return scanReceiptAndProcess(req, res);
    }
    
    // ✅ Handle multipart file upload
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded!" });
    }

    const mimeType = req.file.mimetype;
    const fileName = req.file.originalname.toLowerCase();
    let rawTransactions = [];

    // IMAGE → OCR
    if (mimeType.startsWith("image/")) {
      const base64String = req.file.buffer.toString("base64");
      req.body.imageBuffer = base64String;
      req.body.mimeType = mimeType;
      return scanReceiptAndProcess(req, res);
    }

    // EXCEL / CSV
    else if (mimeType.includes("sheet") || mimeType.includes("excel") || mimeType.includes("csv") || fileName.endsWith(".xlsx") || fileName.endsWith(".xls") || fileName.endsWith(".csv")) {
      try {
        const workbook = new ExcelJS.Workbook();
        if (fileName.endsWith(".csv") || mimeType.includes("csv")) {
          await workbook.csv.load(req.file.buffer);
        } else {
          await workbook.xlsx.load(req.file.buffer);
        }
        const worksheet = workbook.getWorksheet(1) || workbook.worksheets[0];
        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
          const rowValues = Array.isArray(row.values) ? row.values : Object.values(row.values || {});
          if (rowNumber === 1) return; // skip header
          const title = rowValues[1]?.toString().trim() || "";
          const amount = cleanAmount(rowValues[2]);
          if (!title || amount === 0) return;
          rawTransactions.push({ description: title, amount, date: new Date() });
        });
      } catch (err) {
        return res.status(400).json({ success: false, message: "Failed to parse spreadsheet." });
      }
    }

    // PDF
    else if (mimeType.includes("pdf") || fileName.endsWith(".pdf")) {
      try {
        const pdfData = await pdfParse(req.file.buffer);
        const textLines = pdfData.text.split("\n");
        textLines.forEach((line) => {
          const cleanLine = line.trim();
          if (!cleanLine) return;
          const allNumbers = cleanLine.match(/[\d,]+\.\d{2}|[\d,]+/g);
          if (allNumbers) {
            const rawAmt = allNumbers[allNumbers.length - 1];
            const amount = cleanAmount(rawAmt);
            let descStr = cleanLine.replace(rawAmt, "").replace(/[₹$]/g, "").trim();
            if (descStr && amount > 0) {
              rawTransactions.push({ description: descStr, amount, date: new Date() });
            }
          }
        });
      } catch (err) {
        const base64String = req.file.buffer.toString("base64");
        req.body.imageBuffer = base64String;
        req.body.mimeType = "application/pdf";
        return scanReceiptAndProcess(req, res);
      }
    }

    // TXT / DOCX / RTF
    else {
      const extractedText = req.file.buffer.toString("utf-8");
      if (!extractedText.trim()) {
        return res.status(400).json({ success: false, message: "Uploaded document appears empty." });
      }
      req.body.imageBuffer = Buffer.from(extractedText).toString("base64");
      req.body.mimeType = "text/plain";
      return scanReceiptAndProcess(req, res);
    }

    if (rawTransactions.length === 0) {
      return res.status(400).json({ success: false, message: "No valid transactions found." });
    }

    // ✅ Normalize to model schema
    const bulkPayload = rawTransactions.map((tx) => ({
      userId,
      description: tx.description,
      amount: Number(tx.amount),
      category: autoCategorize(tx.description),
      date: tx.date,
    }));

    const savedTransactions = await Expense.insertMany(bulkPayload);
    savedTransactions.forEach((tx) => {
      checkBudgetThresholds(userId, tx.category, tx.amount);
    });

    return res.status(201).json({
      success: true,
      message: `Imported ${savedTransactions.length} expenses successfully 🎉`,
      count: savedTransactions.length,
    });
  } catch (err) {
    console.error("🚨 Scanner Error:", err);
    return res.status(500).json({ success: false, message: "Internal pipeline error." });
  }
});

// ==========================================
// 🛠️ CRUD PIPELINES
// ==========================================
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const expenseId = req.params.id;
    const deletedExpense = await Expense.findByIdAndDelete(expenseId);
    if (!deletedExpense) {
      return res.status(404).json({ success: false, msg: "Expense not found." });
    }
    return res.status(200).json({ success: true, msg: "Expense deleted!" });
  } catch (err) {
    return res.status(500).json({ success: false, msg: "Database error." });
  }
});

router.get("/:userId", verifyToken, getExpenses);
router.post("/", verifyToken, addExpense);
router.post("/add", verifyToken, addExpense);

export default router;
