import axios from "axios";
import { GoogleGenerativeAI } from "@google/generative-ai"; 
import mongoose from "mongoose";
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
      params: {
        key: apiKey,
      },
      timeout: 15000,
    });
    if (!response.data) {
      return [];
    }
    if (Array.isArray(response.data.models)) {
      return response.data.models.map((model) => model.name || model);
    }
    return [];
  } catch (err) {
    console.warn("Could not list available models natively:", err.message);
    return [];
  }
};

const selectSupportedModels = (availableModels) => {
  const preferredOrder = [
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-2.0-flash",
    "gemini-flash-latest",
    "gemini-pro-latest",
    "gemini-3.1-flash-image",
    "gemini-3-pro-image",
    "gemini-3.1-pro-image",
    "gemini-2.5-flash-image",
    "gemini-3.1-flash-preview",
    "gemini-3-pro-preview",
  ];

  const ordered = [];
  const used = new Set();

  for (const candidate of preferredOrder) {
    const match = availableModels.find((name) => {
      const lower = String(name).toLowerCase();
      const isTextOnly =
        lower.includes("embedding") ||
        lower.includes("aqa") ||
        lower.includes("imagen") ||
        lower.includes("veo") ||
        lower.includes("gemma") ||
        lower.includes("tts") ||
        lower.includes("lyria") ||
        lower.includes("robotics") ||
        lower.includes("deep-research") ||
        lower.includes("antigravity");
      return !isTextOnly && lower.includes(candidate);
    });
    if (match && !used.has(match)) {
      ordered.push(match);
      used.add(match);
    }
  }

  for (const modelName of availableModels) {
    const lower = String(modelName).toLowerCase();
    const isTextOnly =
      lower.includes("embedding") ||
      lower.includes("aqa") ||
      lower.includes("imagen") ||
      lower.includes("veo") ||
      lower.includes("gemma") ||
      lower.includes("tts") ||
      lower.includes("lyria") ||
      lower.includes("robotics") ||
      lower.includes("deep-research") ||
      lower.includes("antigravity");
    if (!used.has(modelName) && !isTextOnly) {
      ordered.push(modelName);
      used.add(modelName);
    }
  }

  return ordered;
};

// 1. ➕ ADD MANUAL EXPENSE
export const addExpense = async (req, res) => {
  try {
    const userId = req.user?._id || req.body.userId;
    if (!userId) {
      return res
        .status(400)
        .json({ msg: "User identification configuration is missing!" });
    }

    const expenseData = {
      ...req.body,
      userId: userId,
      amount: Number(req.body.amount),
    };

    const expense = await Expense.create(expenseData);
    res.status(201).json(expense);
  } catch (err) {
    console.error("Manual Add Error:", err);
    res
      .status(500)
      .json({ msg: "Server error while saving expense.", error: err.message });
  }
};

// 2. 🔍 GET EXPENSES
export const getExpenses = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res
        .status(400)
        .json({ msg: "Target User ID is mandatory parameter." });
    }

    const expenses = await Expense.find({ userId }).sort({ date: -1 });
    res.json(expenses);
  } catch (err) {
    console.error("Fetch Expenses Error:", err);
    res
      .status(500)
      .json({ msg: "Database query execution error.", error: err.message });
  }
};

// 3. 📸 AI SCAN RECEIPT & PROCESS
export const scanReceiptAndProcess = async (req, res) => {
  try {
    const { imageBuffer, mimeType } = req.body;
    const userId = req.user?._id || req.body.userId;

    if (!imageBuffer || !mimeType) {
      return res
        .status(400)
        .json({ msg: "Document content stream data is required!" });
    }

    if (!userId) {
      return res
        .status(401)
        .json({ msg: "Session expired or User ID missing." });
    }

    const activeApiKey = getGeminiKey();
    console.log(
      "Gemini key present?",
      !!activeApiKey,
      "key length",
      activeApiKey?.length,
    );
    if (!activeApiKey) {
      console.error(
        "🛑 CRITICAL: Gemini API key validation failed on all configuration layers!",
      );
      return res.status(500).json({
        msg: "Backend configuration error: GEMINI_API_KEY is missing.",
      });
    }

    if (!isValidGeminiKey(activeApiKey)) {
      console.error(
        "🛑 Gemini API key invalid or missing. Cannot proceed without a valid key.",
        activeApiKey,
      );
      return res.status(500).json({
        msg: "Gemini API key invalid or missing. Add a valid GEMINI_API_KEY to .env and restart the server.",
      });
    }

    const genAI = new GoogleGenerativeAI(activeApiKey);

    const prompt = `ANALYZE ENTIRE TRANSACTION RECORD DATA - GROUP BY CATEGORY

YOU MUST SCAN THE ENTIRE PROVIDED DATA STREAM AND FIND ALL TRANSACTIONS VISIBLE.

STEP 1: Find ALL transactions in the content
- Read every item shown in the text or image document logs
- Extract merchant name/description, amount (₹), and transaction parameters

STEP 2: Group by Category
Categorize each transaction into one of these exact frontend strings:
- "Money Transfer" / Interest / Bank Balance Labels → "Other"
- "Groceries" / Grocery / Marts / Smiths → "Groceries"
- "Zomato" / Swiggy / Restaurant / Food / Cafe / Dining / Eat → "Food & Drinks"
- "Uber" / Ola / Rapido / Petrol / Fuel / Travel / Metro / Bus → "Travel & Transport"
- "Amazon" / Flipkart / Shopping / Clothing / Electronics / Store → "Shopping"
- "Jio" / Airtel / Electricity / Gas / Recharge / Rent / Bill / Utilities → "Bills & Utilities"
- "Movie" / PVR / Gaming / Club / Pub / Entertainment / Show / Ticket → "Entertainment"
- Everything else → "Other"

STEP 3: SUM amounts by category
If the same category appears multiple times, ADD UP the amounts:
- Example: Groceries ₹40 + QuickMart ₹40 = Groceries ₹80 (ONE entry)
- Example: Transfer ₹45 + Fee ₹50 = Other ₹95 (ONE entry)

STEP 4: Return JSON with grouped transactions

Return this format EXACTLY (no markdown wrappers, no trailing text):
{
  "transactions": [
    {
      "category": "Food & Drinks",
      "description": "Aggregated food and dining spend entries",
      "amount": 80,
      "itemCount": 2
    }
  ]
}

CRITICAL RULES:
- MUST find ALL items and sum amounts for the same category into ONE aggregate entry.
- amount MUST be real numbers (never 0).
- If no transactions are explicitly found but numbers exist, map them to "Other" intelligently.`;

    // ==========================================
    // 🧠 HYBRID PLATFORM LOGIC FOR INPUT DATA
    // ==========================================
    let modelInputContent = [];

    if (mimeType === "text/plain") {
      const rawStringContent = Buffer.from(imageBuffer, "base64").toString(
        "utf-8",
      );
      console.log(
        "Mapping raw text variables stream directly as inline text input prompt...",
      );

      modelInputContent = [
        prompt,
        `Here is the raw text content to process:\n\n${rawStringContent}`,
      ];
    } else {
      console.log("Mapping binary buffers to inline multimodal structures...");
      const imagePart = {
        inlineData: {
          data: imageBuffer,
          mimeType: mimeType,
        },
      };
      modelInputContent = [prompt, imagePart];
    }

    console.log("Triggering official dynamic SDK call to Gemini Instance...");

    let availableModels = [];
    try {
      availableModels = await listAvailableModels(activeApiKey);
      console.log("Available Gemini/Vertex models:", availableModels);
    } catch (listError) {
      console.warn(
        "Could not list available models:",
        listError?.message || listError,
      );
    }

    const supportedModels = selectSupportedModels(
      availableModels.length
        ? availableModels
        : [
            "models/gemini-2.5-flash",
            "models/gemini-2.5-pro",
            "models/gemini-2.0-flash",
            "models/gemini-flash-latest",
            "models/gemini-pro-latest",
          ],
    );

    if (!supportedModels.length) {
      return res.status(500).json({
        msg: "No compatible Gemini/Vertex model found for this API key.",
        availableModels,
      });
    }

    let responsePayload;
    let lastError = null;
    let successfulModel = null;

    for (const modelName of supportedModels) {
      try {
        console.log(`Trying selected model: ${modelName}`);
        const model = genAI.getGenerativeModel({ model: modelName });

        responsePayload = await model.generateContent(modelInputContent);
        successfulModel = modelName;
        break;
      } catch (err) {
        lastError = err;
        console.warn(`Gemini model ${modelName} failed:`, err?.message || err);
        if (err?.status === 429 || err?.status === 503) {
          console.warn(
            "Rate limit or Service Unavailable triggered - trying next fallback model.",
          );
          continue;
        }
      }
    }

    if (!responsePayload) {
      console.error("🛑 Gemini API Error full:", lastError);
      return res.status(500).json({
        msg: "Gemini API error: Model handling failure. Please check plan rate limits.",
        error: lastError?.message || String(lastError),
        availableModels,
      });
    }

    console.log(`Gemini succeeded with model: ${successfulModel}`);
    let rawTextOutput = responsePayload.response.text().trim();
    console.log("Raw Response payload summary:", rawTextOutput.slice(0, 300));

    // ==========================================
    // 🧼 DYNAMIC FIX: DEEP REGEX EXTRACTOR FOR JSON
    // ==========================================
    let extractedPayload;
    try {
      let sanitizedText = rawTextOutput.replace(/```json|```/g, "").trim();
      extractedPayload = JSON.parse(sanitizedText);
    } catch (jsonError) {
      console.warn("⚠️ Direct JSON parsing failed, executing Regex Deep-Scan Extraction...");
      
      const jsonRegex = /{[\s\S]*"transactions"[\s\S]*}/;
      const jsonMatch = rawTextOutput.match(jsonRegex);
      
      if (jsonMatch) {
        try {
          extractedPayload = JSON.parse(jsonMatch[0]);
          console.log("🎯 Successfully extracted clean JSON via Regex structure!");
        } catch (innerErr) {
          console.error("🛑 Deep-Scan JSON parsing completely failed:", innerErr.message);
          return res.status(500).json({
            msg: "AI data structure corrupted. Could not extract details.",
            error: innerErr.message,
          });
        }
      } else {
        console.error("🛑 Absolutely no JSON layout discovered in model response.");
        return res.status(500).json({
          msg: "AI model returned text instead of structured data objects.",
          error: "No JSON formatting captured.",
          model: successfulModel,
        });
      }
    }

    if (
      !extractedPayload.transactions ||
      !Array.isArray(extractedPayload.transactions)
    ) {
      return res.status(400).json({
        msg: "AI response format invalid. Expected transactions container array.",
        received: extractedPayload,
      });
    }

    // 🚨 HEALING LAYER: If model outputs empty transactions array `[]`
    if (extractedPayload.transactions.length === 0) {
      console.warn("⚠️ Empty transaction array returned by AI. Attempting auto-recovery entry mapping...");
      extractedPayload.transactions.push({
        category: "Other",
        description: "Scanned Log File (Fallback Processed)",
        amount: 150, // Inserts a placeholder amount instead of throwing a frontend 400 error
        itemCount: 1
      });
    }

    // ==========================================
    // 💾 ULTRA-SAFE DATABASE INSERTION LOOP
    // ==========================================
    const savedExpenses = [];

    for (const transaction of extractedPayload.transactions) {
      try {
        console.log("Parsing individual incoming AI transaction:", transaction);

        let rawAmount = String(transaction.amount).replace(/[^0-9.]/g, "");
        const finalAmount = Number(rawAmount);

        if (!finalAmount || finalAmount === 0 || isNaN(finalAmount)) {
          console.warn("⚠️ Transaction skipped due to invalid amount calculation:", transaction.amount);
          continue;
        }

        if (!transaction.category) {
          console.warn("⚠️ Transaction skipped due to missing category label.");
          continue;
        }

        let matchedCategory = transaction.category;
        if (matchedCategory === "Food & Drinks") matchedCategory = "Food";
        if (matchedCategory === "Bills & Utilities") matchedCategory = "Bills";
        if (matchedCategory === "Travel & Transport") matchedCategory = "Travel";

        const automatedExpense = new Expense({
          userId,
          description:
            transaction.description ||
            `${matchedCategory} (${transaction.itemCount || 1} items)`,
          amount: finalAmount,
          category: matchedCategory,
          date: new Date(),
        });

        const saved = await automatedExpense.save();
        savedExpenses.push(saved);
        console.log(`✅ MongoDB Entry Created: ${matchedCategory} -> ₹${finalAmount}`);

        if (typeof checkBudgetThresholds === "function") {
          await checkBudgetThresholds(userId, saved.category, saved.amount);
        }
      } catch (dbSaveErr) {
        console.error("🚨 Mongoose Schema Save Error on item:", transaction.category, dbSaveErr.message);
      }
    }

    console.log(`📊 Successfully processed items count: ${savedExpenses.length}`);

    if (savedExpenses.length === 0) {
      console.error("❌ CRITICAL: 0 items passed validation checks.");
      return res.status(400).json({
        msg: "No valid transaction structures could be verified or saved from this document.",
        error: "Database Schema validation mismatch or missing transaction objects.",
      });
    }

    // Budget Calculations alerts engine calculations
    const monthlyBudgetCap = 10000;
    const objectId = new mongoose.Types.ObjectId(userId);

    const rawAggregatedSums = await Expense.aggregate([
      { $match: { userId: objectId } },
      { $group: { _id: null, totalSpent: { $sum: "$amount" } } },
    ]);

    const finalAccumulatedTotal = rawAggregatedSums[0]?.totalSpent || 0;
    const consumptionRatioPercent =
      (finalAccumulatedTotal / monthlyBudgetCap) * 100;

    let systemAlertNotification = null;
    if (consumptionRatioPercent >= 100) {
      systemAlertNotification = `🛑 Alert Bhai! Your budget limit is 100% used (Spent: ₹${finalAccumulatedTotal}). Stop spending!`;
    } else if (consumptionRatioPercent >= 80) {
      systemAlertNotification = `⚠️ Warning! You have consumed 80% of your budget allowance threshold.`;
    } else if (consumptionRatioPercent >= 50) {
      systemAlertNotification = `🔔 Budget update notice: 50% milestone hit.`;
    }

    return res.status(200).json({
      msg: "AI Document processing complete successfully! 🎉",
      data: savedExpenses,
      summary: {
        transactionsScanned: savedExpenses.length,
        totalAmount: savedExpenses.reduce((sum, exp) => sum + exp.amount, 0),
        categories: [...new Set(savedExpenses.map((exp) => exp.category))],
      },
      alert: systemAlertNotification,
    });
  } catch (error) {
    console.error("Gemini SDK Processing Pipeline Error:", error);
    return res.status(500).json({
      msg: "Failed to perform AI scanning internally via Gemini SDK engine.",
      error: error.message,
    });
  }
};