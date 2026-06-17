import { GoogleGenerativeAI } from "@google/generative-ai";
import Expense from "../models/Expense.js";
import { checkBudgetThresholds } from "../utils/budgetAlertEngine.js";
import mongoose from "mongoose";

const normalizeText = (rawText) => {
  if (!rawText || typeof rawText !== "string") return "";
  return rawText
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, " ")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const parseTransactionsFromText = (rawText) => {
  const normalized = normalizeText(rawText);
  const lines = normalized.split("\n").map((line) => line.trim()).filter(Boolean);
  const transactions = [];

  for (const line of lines) {
    const matches = line.match(/[-+]?[0-9]{1,3}(?:[.,][0-9]{3})*(?:\.[0-9]+)?|[-+]?[0-9]+(?:\.[0-9]+)?/g);
    if (!matches) continue;

    const amountText = matches[matches.length - 1];
    const amountValue = parseFloat(amountText.replace(/,/g, ""));
    if (!amountValue || isNaN(amountValue)) continue;

    let description = line.replace(amountText, "").replace(/[₹$]/g, "").replace(/[-:–—]+$/g, "").trim();
    if (!description) description = "Expense";
    
    if (/subtotal|total|amount due|balance|page|statement|summary|invoice|tax/i.test(description)) {
      continue;
    }

    transactions.push({ description, amount: amountValue, date: new Date() });
  }
  return transactions;
};

const categorizeTextDescription = (description) => {
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

const saveParsedTransactions = async (transactions, userId) => {
  const savedExpenses = [];

  for (const transaction of transactions) {
    // 🎯 FIX: Wrapped loop logic inside an independent try/catch block to prevent crash states
    try {
      const finalAmount = Number(String(transaction.amount).replace(/[^0-9.]/g, ""));
      if (!finalAmount || isNaN(finalAmount)) continue;

      const expense = new Expense({
        userId: String(userId),
        description: transaction.description || "Expense",
        amount: finalAmount,
        category: transaction.category || categorizeTextDescription(transaction.description),
        date: transaction.date || new Date(),
      });

      const saved = await expense.save();
      savedExpenses.push(saved);
      
      if (typeof checkBudgetThresholds === "function") {
        await checkBudgetThresholds(userId, saved.category, saved.amount).catch(err => 
          console.error(`⚠️ Budget Alert Engine Engine Engine Error: ${err.message}`)
        );
      }
    } catch (loopErr) {
      console.error("🚨 Failed processing single ledger transaction row item:", loopErr.message);
    }
  }
  return savedExpenses;
};

export const addExpense = async (req, res) => {
  try {
    const userId = req.user?._id || req.body.userId;
    if (!userId) {
      return res.status(400).json({ msg: "User identification mapping trace missing!" });
    }

    const expense = await Expense.create({
      ...req.body,
      userId: String(userId),
      amount: Number(req.body.amount),
    });
    
    return res.status(201).json(expense);
  } catch (err) {
    console.error("Manual Add Error Trace:", err);
    return res.status(500).json({ msg: "Database storage error saving transactional ledger details." });
  }
};

export const getExpenses = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ msg: "User validation mapping trace required!" });
    }

    const expenses = await Expense.find({ userId: String(userId) }).sort({ date: -1 });
    return res.json(expenses);
  } catch (err) {
    console.error("Fetch Expenses Error Trace:", err);
    return res.status(500).json({ msg: "Failed querying backend user expense collection repositories." });
  }
};


export const scanReceiptAndProcess = async (req, res) => {
  try {
    const safeBody = req.body || {};
    let imageBuffer = safeBody.imageBuffer || null;
    let mimeType = safeBody.mimeType || null;
    
    // Resolve accounting identifiers safely
    const userId = req.user?._id || (safeBody.userId && safeBody.userId !== "test-user-1" ? safeBody.userId : null);

    if ((!imageBuffer || !mimeType) && req.file) {
      imageBuffer = req.file.buffer.toString("base64");
      mimeType = req.file.mimetype;
    }

    if (!imageBuffer || !mimeType) {
      return res.status(400).json({ success: false, msg: "Document parameter structure unreadable or stream missing." });
    }
    if (!userId) {
      return res.status(401).json({ success: false, msg: "Authentication profile parameter reference missing." });
    }

    const activeApiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
    const isTextBasedFallback = mimeType === "text/plain";

    // 📝 TEXT FALLBACK ENGINE BACKUP OPERATION ROUTINE
    if (!activeApiKey && isTextBasedFallback) {
      const rawText = Buffer.from(imageBuffer, "base64").toString("utf-8");
      // Fallback helper call parsing logic (Ensure this helper utility exists in your file)
      const fallbackTransactions = typeof parseTransactionsFromText === "function" ? parseTransactionsFromText(rawText) : [];

      if (fallbackTransactions.length === 0) {
        return res.status(400).json({ msg: "No translatable transactions tracked inside text content document streams." });
      }

      // Local storage loop execution fallback
      const savedExpenses = [];
      for (const tx of fallbackTransactions) {
        const automatedExpense = new Expense({
          userId: userId,
          description: tx.description || "Manual Extraction",
          amount: Number(tx.amount) || 0,
          category: tx.category || "Other",
          date: tx.date || new Date()
        });
        const saved = await automatedExpense.save();
        savedExpenses.push(saved);
      }

      return res.status(200).json({
        success: true,
        msg: "Text document logs parsed locally via backup regex system.",
        data: savedExpenses,
        summary: {
          transactionsScanned: savedExpenses.length,
          totalAmount: savedExpenses.reduce((sum, exp) => sum + exp.amount, 0),
          categories: [...new Set(savedExpenses.map((exp) => exp.category))],
        },
      });
    }

    if (!activeApiKey) {
      return res.status(503).json({ msg: "Generative AI cluster engine configurations not found on active ecosystem environment parameters." });
    }

const genAI = new GoogleGenerativeAI(activeApiKey);
    
    // 🎯 ALIGNED SYSTEM INSTRUCTIONS: Matching your schema properties and OpenAI configurations perfectly
    const prompt = `ANALYZE TRANSACTION DATA AND RETURN ONLY VALID JSON.
Extract description, transaction amount, and category parameters from file entries.
Group parameters using EXACTLY one of these target database schema category keys: "Food & Drinks", "Travel & Transport", "Shopping", "Bills & Utilities", "Entertainment", or "Other".

RETURN FORMAT SPECIFICATION (Do not include conversational summaries, raw code markers or text notes outside the raw JSON string wrapper block):
{
  "transactions": [
    {
      "category": "Food & Drinks",
      "description": "Zomato dining spent entry logs",
      "amount": 450.50,
      "itemCount": 1
    }
  ]
}`;

    let pureBase64Data = imageBuffer.includes(";base64,") ? imageBuffer.split(";base64,").pop() : imageBuffer;

    // 🎯 FIX: Explicit multi-modal structural alignment using correct SDK part configurations
    const modelContents = [
      {
        role: "user",
        parts: [
          { text: prompt },
          {
            inlineData: {
              data: pureBase64Data,
              mimeType: mimeType
            }
          }
        ]
      }
    ];

    let responsePayload = null;
    
    // 🎯 FIX: Using rock-solid, production-verified stable model strings
    const supportedModels = ["gemini-1.5-flash", "gemini-2.0-flash"];

    for (const modelName of supportedModels) {
      try {
        console.log(`🤖 Dispatched request stream down to AI Core node: [${modelName}]`);
        
        const model = genAI.getGenerativeModel({ model: modelName });
        
        // Passing structured multi-modal context along with generation schema layouts
        responsePayload = await model.generateContent({
          contents: modelContents,
          generationConfig: { 
            responseMimeType: "application/json",
            temperature: 0.1 // Low temperature ensures rigid, deterministic JSON formatting layout maps
          }
        });

        if (responsePayload && responsePayload.response) {
          break; // Exit loop instantly upon successful retrieval
        }
      } catch (err) {
        console.warn(`⚠️ Model configuration failover alert on targeting line [${modelName}]: ${err.message}`);
      }
    }

    if (!responsePayload) {
      return res.status(500).json({ 
        success: false, 
        msg: "Failed to perform AI scanning internally via Gemini SDK engine. Check API credit balancing metrics." 
      });
    }

    let rawTextOutput = responsePayload.response.text().trim();
    let extractedPayload;

    try {
      // Stripping potential raw Markdown wrapper flags if left behind
      const sanitizedText = rawTextOutput.replace(/```json|```/g, "").trim();
      const startIndex = sanitizedText.indexOf("{");
      const endIndex = sanitizedText.lastIndexOf("}");
      const parsedTargetText = (startIndex !== -1 && endIndex !== -1) ? sanitizedText.slice(startIndex, endIndex + 1) : sanitizedText;
      
      extractedPayload = JSON.parse(parsedTargetText);
    } catch (jsonError) {
      console.error("🚨 AI Structure Serialization Fault:", jsonError.message);
      return res.status(500).json({ success: false, msg: "Generative engine text calculations did not match JSON standard structural requirements." });
    }

    if (!extractedPayload || !Array.isArray(extractedPayload.transactions)) {
      return res.status(400).json({ success: false, msg: "AI matrix return logs missing transactional array objects mapping properties." });
    }
    
    const savedExpenses = [];
    for (const transaction of extractedPayload.transactions) {
      try {
        const finalAmount = Number(String(transaction.amount).replace(/[^0-9.]/g, ""));
        if (!finalAmount || isNaN(finalAmount)) continue;

        const automatedExpense = new Expense({
          userId: userId, // 🎯 FIX: Maintaining real Object / String mapping safety
          description: transaction.description || `${transaction.category} Spend Matrix`,
          amount: finalAmount,
          category: transaction.category || "Other",
          date: new Date(),
        });

        const saved = await automatedExpense.save();
        savedExpenses.push(saved);

        // Safely invoke background milestone warning validations
        if (typeof checkBudgetThresholds === "function") {
          checkBudgetThresholds(userId, saved.category, saved.amount).catch((e) => 
            console.error("⚠️ Background limit system alert tracked:", e.message)
          );
        }
      } catch (dbSaveErr) {
        console.error("🚨 Loop internal record storage exception encountered:", dbSaveErr.message);
      }
    }

    if (savedExpenses.length === 0) {
      return res.status(400).json({ msg: "No applicable valid spend configurations saved into database collections from data logs." });
    }

    // 🎯 FIX: Convert the string userId into a valid MongoDB ObjectId type structure to prevent database calculation crashes
    const targetMongoObjectId = new mongoose.Types.ObjectId(String(userId));

    const rawAggregatedSums = await Expense.aggregate([
      { $match: { userId: targetMongoObjectId } }, // Evaluates matched documents using correct object structures
      { $group: { _id: null, totalSpent: { $sum: "$amount" } } },
    ]);

    const finalAccumulatedTotal = rawAggregatedSums[0]?.totalSpent || 0;
    const monthlyBudgetCap = 10000;
    const consumptionRatioPercent = (finalAccumulatedTotal / monthlyBudgetCap) * 100;

    let systemAlertNotification = null;
    if (consumptionRatioPercent >= 100) {
      systemAlertNotification = `🛑 Critical Alert! Monthly baseline user budget caps fully saturated (Spent: ₹${finalAccumulatedTotal}).`;
    } else if (consumptionRatioPercent >= 80) {
      systemAlertNotification = `⚠️ System warning notification alert: 80% threshold exceeded (Spent: ₹${finalAccumulatedTotal}).`;
    }

    return res.status(200).json({
      success: true,
      msg: "AI Document processed successfully!",
      data: savedExpenses,
      summary: {
        transactionsScanned: savedExpenses.length,
        totalAmount: savedExpenses.reduce((sum, exp) => sum + exp.amount, 0),
        categories: [...new Set(savedExpenses.map((exp) => exp.category))],
      },
      alert: systemAlertNotification,
    });
  } catch (error) {
    console.error("🚨 Core Controller Structural Failure:", error);
    return res.status(500).json({ msg: "Internal system error scanning file upload document elements." });
  }
};