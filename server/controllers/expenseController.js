import axios from "axios";
import { GoogleGenerativeAI } from "@google/generative-ai";
import mongoose from "mongoose";
import ExcelJS from "exceljs"; // 📊 Native Spreadsheet Decoder Engine
import XLSX from "xlsx";
import { Readable } from "stream"; // feeds CSV buffers into ExcelJS's csv reader
import mammoth from "mammoth"; // 📝 Native Word Document (.docx) Decoder Engine
import Expense from "../models/Expense.js";
import { checkBudgetThresholds } from "../utils/budgetAlertEngine.js";

// 🧱 SECURE KEY RESOLUTION LAYER
const getGeminiKey = () => {
  if (
    process.env.GEMINI_API_KEY &&
    !process.env.GEMINI_API_KEY.includes("YourActual")
  ) {
    return process.env.GEMINI_API_KEY;
  }

  console.error(
    "⚠️ Gemini API Key missing or placeholder. Set a valid GEMINI_API_KEY in .env.",
  );
  return null;
};

const isValidGeminiKey = (key) => {
  return (
    typeof key === "string" &&
    key.length > 20 &&
    !key.includes("YourActual") &&
    !key.includes("PLACEHOLDER")
  );
};

const listAvailableModels = async (apiKey) => {
  try {
    const url = "https://generativelanguage.googleapis.com/v1beta/models";
    const response = await axios.get(url, {
      params: { key: apiKey },
      timeout: 15000,
    });
    if (!response.data || !Array.isArray(response.data.models)) return [];
    return response.data.models.map((model) => model.name || model);
  } catch (err) {
    console.warn("Could not list available models natively:", err.message);
    return [];
  }
};

// 🧼 DYNAMIC CATEGORIZATION ENGINE UTILITY HELPER
const autoCategorize = (description) => {
  const desc = (description || "").toLowerCase().trim();
  if (/interest expense|interest/i.test(desc)) return "Other";
  if (/groceries|grocery|smith\'s|smiths/i.test(desc)) return "Groceries";
  if (/credit|beginning balance|balance|account balance/i.test(desc)) return "Bills & Utilities";
  if (/zomato|swiggy|restaurant|hotel|food|cafe|mcdonald|starbucks|blinkit|zepto|instamart|eat|canteen|dinner|lunch|breakfast|bakery|diner|dining/i.test(desc)) return "Food & Drinks";
  if (/uber|ola|rapido|irctc|flight|metro|petrol|fuel|shell|diesel|train|bus|cab|travel|transport|automart|car|bike|garage|auto/i.test(desc)) return "Travel & Transport";
  if (/amazon|flipkart|myntra|zara|h&m|mall|shopping|clothing|electronics|shoes|apparel|store|walmart|target/i.test(desc)) return "Shopping";
  if (/jio|airtel|electricity|water|gas|broadband|recharge|rent|netflix|spotify|prime|bill|utilities/i.test(desc)) return "Bills & Utilities";
  if (/movie|pvr|inox|gaming|pub|club|bar|concert|theater|booking/i.test(desc)) return "Entertainment";
  return "Other";
};

const selectSupportedModels = (availableModels) => {
  const preferredOrder = [
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-2.0-flash",
    "gemini-flash-latest",
    "gemini-pro-latest",
  ];
  const ordered = [];
  const used = new Set();

  for (const candidate of preferredOrder) {
    const match = availableModels.find((name) => {
      const lower = String(name).toLowerCase();
      const isTextOnly = lower.includes("embedding") || lower.includes("aqa") || lower.includes("imagen") || lower.includes("veo") || lower.includes("gemma");
      return !isTextOnly && lower.includes(candidate);
    });
    if (match && !used.has(match)) {
      ordered.push(match);
      used.add(match);
    }
  }
  return ordered.length ? ordered : ["models/gemini-2.5-flash"];
};

// 🧮 LOCAL FALLBACK — scan extracted text line-by-line and build transactions.
// Used when Gemini is unavailable / rate-limited / returns nothing usable, so
// docx, txt, xlsx, xls, and csv uploads keep working with proper categorization
// even without the AI step.
const parseTransactionsFromRawText = (text) => {
  const lines = text.split(/\r?\n/);
  const transactions = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || /^---\s*Sheet:/i.test(line)) continue;

    // Grab every number-looking token in the line (handles "1,250.50", "250", etc.)
    const numberMatches = line.match(/-?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|-?\d+(?:\.\d{1,2})?/g);
    if (!numberMatches || numberMatches.length === 0) continue;

    const amountToken = numberMatches[numberMatches.length - 1];
    const amount = Number(amountToken.replace(/,/g, ""));
    if (!amount || isNaN(amount) || amount <= 0) continue;

    let description = line.replace(amountToken, "").replace(/[,;|]+/g, " ").trim();
    description = description.replace(/\s{2,}/g, " ") || "Transaction";

    transactions.push({
      category: autoCategorize(description),
      description,
      amount,
      itemCount: 1,
    });
  }

  return transactions;
};

// 📂 Extract readable text from a non-image/non-pdf document buffer.
// Returns { text, isDocumentFile }. Spreadsheets, docx, txt/rtf are all
// converted to plain text here; images/PDFs fall through untouched and
// get sent to Gemini as binary (inlineData) instead.
const extractDocumentText = async (finalBuffer, mimeType, fileName) => {
  const lowerFileName = String(fileName || "").toLowerCase();
  const isXls = /\.xls$/i.test(lowerFileName);
  const isXlsx = /\.xlsx$/i.test(lowerFileName);
  const isCsv = /\.csv$/i.test(lowerFileName);
  const isDoc = /\.doc$/i.test(lowerFileName);

  const isSpreadsheet =
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    mimeType.includes("csv") ||
    isXlsx ||
    isXls ||
    isCsv;

  const isDocx =
    mimeType.includes("officedocument.wordprocessingml") || /\.docx$/i.test(fileName);

  const isPlainText =
    mimeType.includes("msword") ||
    mimeType.includes("rtf") ||
    mimeType.includes("text/plain") ||
    /\.(rtf|txt)$/i.test(fileName) ||
    isDoc;

  if (isSpreadsheet) {
    const isCsvFile = mimeType.includes("csv") || isCsv;

    // STRATEGY A — real, modern OOXML .xlsx (and many files saved with a
    // .xls extension that are actually xlsx under the hood — common from
    // newer Excel/Sheets exports). Skip this for genuine .csv files since
    // xlsx.load() always throws on plain delimited text and just wastes time.
    if (!isCsvFile) {
      try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(finalBuffer);
        let text = "";
        workbook.eachSheet((worksheet) => {
          text += `\n--- Sheet: ${worksheet.name} ---\n`;
          worksheet.eachRow((row) => {
            const rowValues = Array.isArray(row.values)
              ? row.values.slice(1).map((v) => (v && typeof v === "object" ? v.result ?? v.text ?? JSON.stringify(v) : v))
              : [];
            text += rowValues.join(", ") + "\n";
          });
        });
        if (text.trim()) {
          console.log("📊 ExcelJS: Parsed as native XLSX workbook.");
          return { text, isDocumentFile: true };
        }
      } catch (xlsxErr) {
        console.warn("ExcelJS xlsx.load failed, trying CSV reader:", xlsxErr.message);
      }
    }

    // STRATEGY B — true CSV / tab-delimited text, via ExcelJS's own csv
    // reader (it needs a stream, so we wrap the buffer in a Readable).
    try {
      const workbook = new ExcelJS.Workbook();
      const csvStream = Readable.from(finalBuffer.toString("utf-8"));
      const worksheet = await workbook.csv.read(csvStream);
      let text = `\n--- Sheet: ${worksheet.name || "CSV"} ---\n`;
      worksheet.eachRow((row) => {
        const rowValues = Array.isArray(row.values) ? row.values.slice(1) : [];
        text += rowValues.join(", ") + "\n";
      });
      if (text.trim().length > 15) {
        console.log("📊 ExcelJS: Parsed as CSV stream.");
        return { text, isDocumentFile: true };
      }
    } catch (csvErr) {
      console.warn("ExcelJS csv.read failed, trying HTML/raw-text fallback:", csvErr.message);
    }

    // STRATEGY C — many bank/web-app "xls" exports are actually HTML tables
    // wearing an .xls extension. Strip markup so the rows read as plain text.
    const rawString = finalBuffer.toString("utf-8");
    if (/<table/i.test(rawString) || /<html/i.test(rawString)) {
      const text = rawString
        .replace(/<\/(tr|p|div|br)>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/[ \t]{2,}/g, " ");
      console.log("📊 Detected HTML-formatted spreadsheet export, stripped markup.");
      return { text, isDocumentFile: true };
    }

    // STRATEGY D — last resort, raw decode. Note: genuine legacy binary
    // .xls (Excel 97-2003 BIFF format) cannot be reliably read this way —
    // ExcelJS doesn't support that format at all, so this will only recover
    // something usable if the file is actually CSV/HTML/plain text in
    // disguise, not a true binary .xls.
    const text = rawString.replace(/[^\x20-\x7E\n\r\t]/g, " ");
    if (text.trim().length > 15) {
      return { text, isDocumentFile: true };
    }

    // STRATEGY E — parse with SheetJS to support true legacy .xls and edge files.
    try {
      const workbook = XLSX.read(finalBuffer, {
        type: "buffer",
        cellText: true,
        cellDates: true,
        raw: false,
      });

      let sheetText = "";
      for (const sheetName of workbook.SheetNames || []) {
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });
        sheetText += `\n--- Sheet: ${sheetName} ---\n`;
        for (const row of rows) {
          if (!Array.isArray(row)) continue;
          sheetText += row.map((cell) => (cell == null ? "" : String(cell))).join(", ") + "\n";
        }
      }

      if (sheetText.trim().length > 15) {
        console.log("📊 Parsed spreadsheet with SheetJS fallback.");
        return { text: sheetText, isDocumentFile: true };
      }
    } catch (sheetErr) {
      console.warn("SheetJS fallback parse failed:", sheetErr.message);
    }

    return { text: "", isDocumentFile: true };
  }

  if (isDocx) {
    try {
      const result = await mammoth.extractRawText({ buffer: finalBuffer });
      console.log("📝 Mammoth: Extracted pure text strings from .docx format safely!");
      return { text: result.value, isDocumentFile: true };
    } catch (err) {
      console.warn("Mammoth .docx extraction failed, using fallback:", err.message);
      const text = finalBuffer.toString("utf-8").replace(/[^\x20-\x7E\n\r\t]/g, " ");
      return { text, isDocumentFile: true };
    }
  }

  if (isPlainText) {
    const charset = isDoc ? "latin1" : "utf-8";
    const text = finalBuffer.toString(charset).replace(/[^\x20-\x7E\n\r\t]/g, " ");
    console.log("📄 Sanitized layout plain text / RTF logs extracted successfully.");
    return { text, isDocumentFile: true };
  }

  // Not a recognized document type — treat as image/PDF (binary path)
  return { text: "", isDocumentFile: false };
};

// 1. ➕ ADD MANUAL EXPENSE
export const addExpense = async (req, res) => {
  try {
    const userId = req.user?._id || req.body.userId;
    if (!userId) return res.status(400).json({ msg: "User identification missing!" });

    const expenseData = { ...req.body, userId: userId, amount: Number(req.body.amount) };
    const expense = await Expense.create(expenseData);
    res.status(201).json(expense);
  } catch (err) {
    res.status(500).json({ msg: "Server error saving expense.", error: err.message });
  }
};

// 2. 🔍 GET EXPENSES
export const getExpenses = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ msg: "User ID parameter required." });
    const expenses = await Expense.find({ userId }).sort({ date: -1 });
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ msg: "Database query error.", error: err.message });
  }
};

// 3. 📸 AI SCAN RECEIPT & PROCESS
export const scanReceiptAndProcess = async (req, res) => {
  try {
    const safeBody = req.body || {};
    let imageBuffer = safeBody.imageBuffer || null;
    let mimeType = safeBody.mimeType || null;
    const userId = req.user?._id || safeBody.userId;

    let finalBuffer;
    if (req.file) {
      finalBuffer = req.file.buffer;
      mimeType = req.file.mimetype;
      imageBuffer = req.file.buffer.toString("base64");
    } else if (imageBuffer) {
      finalBuffer = Buffer.from(imageBuffer, "base64");
    }

    if (!finalBuffer || !mimeType) {
      return res.status(400).json({ msg: "Document stream content data is completely empty!" });
    }

    if (!userId) {
      return res.status(401).json({ msg: "Session validation expired or User ID missing." });
    }

    const activeApiKey = getGeminiKey();
    if (!activeApiKey) {
      return res.status(500).json({ msg: "Configuration Error: GEMINI_API_KEY is missing." });
    }

    const fileName = req.file?.originalname || "";
    const { text: extractedTextContent, isDocumentFile } = await extractDocumentText(
      finalBuffer,
      mimeType,
      fileName,
    );

    if (isDocumentFile && !extractedTextContent.trim()) {
      return res.status(400).json({
        msg: "Could not read any text from this file. It may be empty, corrupted, or password-protected.",
      });
    }

    // Cap text size sent to the model to avoid token-limit related failures on large files
    const MAX_CHARS = 60000;
    const trimmedTextContent =
      extractedTextContent.length > MAX_CHARS
        ? extractedTextContent.slice(0, MAX_CHARS) + "\n...[truncated]"
        : extractedTextContent;

    // Configure Context Payload Rules
    const genAI = new GoogleGenerativeAI(activeApiKey);
    const prompt = `ANALYZE TRANSACTION DATA AND EXTRACT INDIVIDUAL EXPENSES.
Group expenses cleanly into these exact categories: "Groceries", "Food & Drinks", "Travel & Transport", "Shopping", "Bills & Utilities", "Entertainment", "Other".

You must output valid JSON following this format EXACTLY:
{
  "transactions": [
    {
      "category": "Food & Drinks",
      "description": "Zomato dinner spend",
      "amount": 250.50,
      "itemCount": 1
    }
  ]
}
Do not add markdown formatting or wrappers. Return ONLY raw JSON.`;

    let modelInputContent;
    if (isDocumentFile) {
      modelInputContent = [
        prompt,
        `Document Contents:\n\n${trimmedTextContent}`,
      ];
    } else {
      // Images & PDFs map cleanly via multimodal binary parameters
      modelInputContent = [
        prompt,
        {
          inlineData: {
            data: imageBuffer,
            mimeType: mimeType,
          },
        },
      ];
    }

    // Model orchestration mapping loop
    let availableModels = await listAvailableModels(activeApiKey);
    const supportedModels = selectSupportedModels(availableModels);

    let responsePayload;
    let lastError = null;

    for (const modelName of supportedModels) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        responsePayload = await model.generateContent(modelInputContent);
        break;
      } catch (err) {
        lastError = err;
        console.warn(`Model ${modelName} failed, executing runtime shift...`);
      }
    }

    let extractedPayload = null;

    if (responsePayload) {
      try {
        const response = responsePayload.response;
        const hasContent =
          response && Array.isArray(response.candidates) && response.candidates.length > 0;

        if (hasContent) {
          const rawTextOutput = response.text().trim();
          const sanitizedText = rawTextOutput.replace(/```json|```/g, "").trim();
          try {
            extractedPayload = JSON.parse(sanitizedText);
          } catch {
            const jsonMatch = rawTextOutput.match(/{[\s\S]*"transactions"[\s\S]*}/);
            if (jsonMatch) extractedPayload = JSON.parse(jsonMatch[0]);
          }
        } else {
          console.warn("Gemini returned no candidates (likely blocked by safety filters).");
        }
      } catch (parseErr) {
        console.warn("Failed to read/parse Gemini response:", parseErr.message);
      }
    } else {
      console.warn("All Gemini models failed:", lastError?.message);
    }

    // 🛟 LOCAL LINE-SCAN FALLBACK — only possible for text-based documents,
    // not images/PDFs (those genuinely need the AI's vision capability).
    // Keeps docx/txt/xlsx/xls/csv uploads working even if Gemini is down,
    // rate-limited, or returns something we can't parse.
    if (
      (!extractedPayload || !Array.isArray(extractedPayload.transactions) || extractedPayload.transactions.length === 0) &&
      isDocumentFile
    ) {
      const localTransactions = parseTransactionsFromRawText(trimmedTextContent);
      if (localTransactions.length > 0) {
        console.log("🧮 Falling back to local line-scan categorization engine.");
        extractedPayload = { transactions: localTransactions };
      }
    }

    if (!extractedPayload || !Array.isArray(extractedPayload.transactions) || extractedPayload.transactions.length === 0) {
      return res.status(500).json({
        msg: "Could not extract any transactions from this file.",
        error: lastError?.message || "No usable content was returned.",
      });
    }

    // 💾 DB PLACEMENT LOOPS
    const savedExpenses = [];
    for (const transaction of extractedPayload.transactions) {
      try {
        let rawAmount = String(transaction.amount).replace(/[^0-9.]/g, "");
        const finalAmount = Number(rawAmount);
        if (!finalAmount || isNaN(finalAmount)) continue;

        const allowedCategories = ["Groceries", "Food & Drinks", "Travel & Transport", "Shopping", "Bills & Utilities", "Entertainment", "Other"];
        let cat = allowedCategories.includes(transaction.category) ? transaction.category : autoCategorize(transaction.description);

        // If the model shrugged and said "Other", give the regex engine a second opinion
        if (cat === "Other") {
          const guess = autoCategorize(transaction.description);
          if (guess !== "Other") cat = guess;
        }

        const automatedExpense = new Expense({
          userId,
          description: transaction.description || `${cat} Transaction`,
          amount: finalAmount,
          category: cat,
          date: new Date(),
        });

        const saved = await automatedExpense.save();
        savedExpenses.push(saved);

        if (typeof checkBudgetThresholds === "function") {
          await checkBudgetThresholds(userId, saved.category, saved.amount).catch(() => {});
        }
      } catch (dbErr) {
        console.error("DB Save Item Failure:", dbErr.message);
      }
    }

    if (savedExpenses.length === 0) {
      return res.status(400).json({ msg: "No valid expense parameters could be parsed from this document asset." });
    }

    // 📊 RECALCULATE MONTHLY PROGRESS BUDGET METRICS
    const monthlyBudgetCap = 10000;
    const objectId = new mongoose.Types.ObjectId(userId);
    const rawAggregatedSums = await Expense.aggregate([
      { $match: { userId: objectId } },
      { $group: { _id: null, totalSpent: { $sum: "$amount" } } },
    ]);

    const finalAccumulatedTotal = rawAggregatedSums[0]?.totalSpent || 0;
    const consumptionRatioPercent = (finalAccumulatedTotal / monthlyBudgetCap) * 100;

    let systemAlertNotification = null;
    if (consumptionRatioPercent >= 100) {
      systemAlertNotification = `🛑 Alert! Your budget limit is 100% used (Spent: ₹${finalAccumulatedTotal}). Stop spending!`;
    } else if (consumptionRatioPercent >= 80) {
      systemAlertNotification = `⚠️ Warning! You have consumed 80% of your budget allowance threshold.`;
    }

    return res.status(200).json({
      msg: "Document processed completely and successfully! 🎉",
      data: savedExpenses,
      summary: {
        transactionsScanned: savedExpenses.length,
        totalAmount: savedExpenses.reduce((sum, exp) => sum + exp.amount, 0),
        categories: [...new Set(savedExpenses.map((exp) => exp.category))],
      },
      alert: systemAlertNotification,
    });

  } catch (error) {
    console.error("Pipeline Engine Critical Crash:", error);
    return res.status(500).json({ msg: "Internal application handler scanning failure.", error: error.message });
  }
};