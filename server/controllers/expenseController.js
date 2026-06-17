import axios from "axios";
import { GoogleGenerativeAI } from "@google/generative-ai"; 
import mongoose from "mongoose";
import ExcelJS from "exceljs"; // 📊 Native Spreadsheet Decoder Engine
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

    // Isolate stream packets coming from standard multi-part form data uploads
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

    let extractedTextContent = "";
    let isDocumentFile = false;
    const fileName = req.file?.originalname || "";

    // 📊 STRATEGY 1: Decode spreadsheet layout arrays using your ExcelJS library
    if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType.includes("csv") || fileName.match(/\.(xlsx|xls|csv)$/i)) {
      isDocumentFile = true;
      try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(finalBuffer);
        
        workbook.eachSheet((worksheet) => {
          extractedTextContent += `\n--- Sheet: ${worksheet.name} ---\n`;
          worksheet.eachRow((row) => {
            const rowValues = Array.isArray(row.values) 
              ? row.values.slice(1).map(v => (v && typeof v === 'object' ? v.result || JSON.stringify(v) : v)) 
              : [];
            extractedTextContent += rowValues.join(", ") + "\n";
          });
        });
        console.log("📊 ExcelJS: Spreadsheet grid converted into readable tracking rows.");
      } catch (excelErr) {
        console.error("ExcelJS processing failed, using text fallback:", excelErr.message);
        extractedTextContent = finalBuffer.toString("utf-8").replace(/[^\x20-\x7E\n\r\t]/g, " ");
      }
    } 
    // 📝 STRATEGY 2: Decode native Microsoft Word document parameters via Mammoth
    else if (mimeType.includes("officedocument.wordprocessingml") || fileName.match(/\.docx$/i)) {
      isDocumentFile = true;
      try {
        const result = await mammoth.extractRawText({ buffer: finalBuffer });
        extractedTextContent = result.value;
        console.log("📝 Mammoth: Extracted pure text strings from .docx format safely!");
      } catch (docxErr) {
        console.error("Mammoth .docx extraction failed, using fallback:", docxErr.message);
        extractedTextContent = finalBuffer.toString("utf-8").replace(/[^\x20-\x7E\n\r\t]/g, " ");
      }
    }
    // 📄 STRATEGY 3: Strip non-printable formatting artifacts from basic .rtf and text logs
    else if (mimeType.includes("msword") || mimeType.includes("rtf") || mimeType.includes("text/plain") || fileName.match(/\.(rtf|txt)$/i)) {
      isDocumentFile = true;
      const cleanString = finalBuffer.toString("utf-8");
      extractedTextContent = cleanString.replace(/[^\x20-\x7E\n\r\t]/g, " ");
      console.log("📄 Sanitized layout plain text / RTF logs extracted successfully.");
    }

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

    let modelInputContent = [];
    if (isDocumentFile) {
      modelInputContent = [
        prompt,
        `Document Contents:\n\n${extractedTextContent}`
      ];
    } else {
      // Images & PDFs map cleanly via multimodal binary parameters
      modelInputContent = [
        prompt,
        {
          inlineData: {
            data: imageBuffer,
            mimeType: mimeType
          }
        }
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

    if (!responsePayload) {
      return res.status(500).json({ msg: "Gemini Model Engine Handling failure.", error: lastError?.message });
    }

    let rawTextOutput = responsePayload.response.text().trim();
    let extractedPayload;

    try {
      let sanitizedText = rawTextOutput.replace(/```json|```/g, "").trim();
      extractedPayload = JSON.parse(sanitizedText);
    } catch {
      const jsonMatch = rawTextOutput.match(/{[\s\S]*"transactions"[\s\S]*}/);
      if (jsonMatch) {
        extractedPayload = JSON.parse(jsonMatch[0]);
      } else {
        return res.status(500).json({ msg: "Structured data parsing error. Output did not return cleanly." });
      }
    }

    if (!extractedPayload.transactions || !Array.isArray(extractedPayload.transactions)) {
      return res.status(400).json({ msg: "Invalid target array container layout." });
    }

    // 💾 DB PLACEMENT LOOPS
    const savedExpenses = [];
    for (const transaction of extractedPayload.transactions) {
      try {
        let rawAmount = String(transaction.amount).replace(/[^0-9.]/g, "");
        const finalAmount = Number(rawAmount);
        if (!finalAmount || isNaN(finalAmount)) continue;

        const allowedCategories = ["Groceries", "Food & Drinks", "Travel & Transport", "Shopping", "Bills & Utilities", "Entertainment", "Other"];
        let cat = allowedCategories.includes(transaction.category) ? transaction.category : "Other";

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