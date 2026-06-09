import axios from "axios";
import { GoogleGenerativeAI } from "@google/generative-ai"; // 🎯 FIX 1: Missing SDK import restoration
import mongoose from "mongoose"; 
import Expense from "../models/Expense.js";

// 🧱 SECURE KEY RESOLUTION LAYER
const getGeminiKey = () => {
  if (process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.includes("YourActual")) {
    return process.env.GEMINI_API_KEY;
  }

  console.error("⚠️ Gemini API Key missing or placeholder. Set a valid GEMINI_API_KEY in .env.");
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
};

const selectSupportedModels = (availableModels) => {
  const normalized = availableModels.map((name) => String(name).toLowerCase());
  const preferredOrder = [
    "gemini-3.1-pro-image",
    "gemini-3-pro-image",
    "gemini-3.1-flash-image",
    "gemini-2.5-flash-image",
    "gemini-3.1-flash-preview",
    "gemini-3-pro-preview",
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-2.0-flash",
    "gemini-flash-latest",
    "gemini-pro-latest",
    "vision-bison-1.1",
    "vision-bison-1.0",
    "image-bison-1.0",
    "chat-bison-001",
    "text-bison-001",
  ];

  const ordered = [];
  const used = new Set();

  for (const candidate of preferredOrder) {
    const match = availableModels.find((name) => {
      const lower = String(name).toLowerCase();
      const isTextOnly = lower.includes("embedding") || lower.includes("aqa") || lower.includes("imagen") || lower.includes("veo") || lower.includes("gemma") || lower.includes("tts") || lower.includes("lyria") || lower.includes("robotics") || lower.includes("deep-research") || lower.includes("antigravity");
      return !isTextOnly && lower.includes(candidate);
    });
    if (match && !used.has(match)) {
      ordered.push(match);
      used.add(match);
    }
  }

  for (const modelName of availableModels) {
    const lower = String(modelName).toLowerCase();
    const isTextOnly = lower.includes("embedding") || lower.includes("aqa") || lower.includes("imagen") || lower.includes("veo") || lower.includes("gemma") || lower.includes("tts") || lower.includes("lyria") || lower.includes("robotics") || lower.includes("deep-research") || lower.includes("antigravity");
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
      return res.status(400).json({ msg: "User identification configuration is missing!" });
    }

    const expenseData = {
      ...req.body,
      userId: userId,
      amount: Number(req.body.amount)
    };

    const expense = await Expense.create(expenseData);
    res.status(201).json(expense);
  } catch (err) {
    console.error("Manual Add Error:", err);
    res.status(500).json({ msg: "Server error while saving expense.", error: err.message });
  }
};

// 2. 🔍 GET EXPENSES
export const getExpenses = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ msg: "Target User ID is mandatory parameter." });
    }

    const expenses = await Expense.find({ userId }).sort({ date: -1 });
    res.json(expenses);
  } catch (err) {
    console.error("Fetch Expenses Error:", err);
    res.status(500).json({ msg: "Database query execution error.", error: err.message });
  }
};

// 3. 🤖 AI SCREENSHOT SCANNER & NOTIFICATION ENGINE (100% Patched Production Ready)
export const scanReceiptAndProcess = async (req, res) => {
  try {
    const { imageBuffer, mimeType } = req.body;
    const userId = req.user?._id || req.body.userId;

    if (!imageBuffer || !mimeType) {
      return res.status(400).json({ msg: "Screenshot image stream binary is required!" });
    }

    if (!userId) {
      return res.status(401).json({ msg: "Session expired or User ID missing." });
    }

    const activeApiKey = getGeminiKey();
    console.log("Gemini key present?", !!activeApiKey, "key length", activeApiKey?.length);
    if (!activeApiKey) {
      console.error("🛑 CRITICAL: Gemini API key validation failed on all configuration layers!");
      return res.status(500).json({ msg: "Backend configuration error: GEMINI_API_KEY is missing." });
    }

    if (!isValidGeminiKey(activeApiKey)) {
      console.error("🛑 Gemini API key invalid or missing. Cannot proceed with AI scan without a valid key.", activeApiKey);
      return res.status(500).json({
        msg: "Gemini API key invalid or missing. Add a valid GEMINI_API_KEY to .env and restart the server.",
      });
    }

    // 🎯 CRITICAL PATH FIX 1: Official dynamic initialization map
    const genAI = new GoogleGenerativeAI(activeApiKey);

    const prompt = `ANALYZE ENTIRE PAYMENT HISTORY IMAGE - GROUP BY CATEGORY

YOU MUST SCAN THE ENTIRE IMAGE AND FIND ALL TRANSACTIONS VISIBLE.

STEP 1: Find ALL transactions in the image
- Read every transaction shown in the payment history
- Extract merchant name, amount (₹), and any transaction type label

STEP 2: Group by Category
Categorize each transaction:
- "Money Transfer" label → "Other"
- "Groceries" label → "Food"
- "Restaurant" / Food merchants → "Food"  
- "Travel" / Uber / Ola → "Travel"
- "Shopping" / Amazon / Flipkart → "Shopping"
- "Bills" / Recharge → "Bills"
- "Entertainment" / Movie → "Entertainment"
- Everything else → "Other"

STEP 3: SUM amounts by category
If same category appears multiple times, ADD UP the amounts:
- Example: Groceries ₹40 + Restaurant ₹40 = Food ₹80 (ONE entry)
- Example: Aman Jha ₹45 + Akta ₹50 + Ravindra ₹34 = Other ₹129 (ONE entry)

STEP 4: Return JSON with grouped transactions

Return this format EXACTLY (no markdown):
{
  "transactions": [
    {
      "category": "Food",
      "description": "Groceries and restaurant purchases",
      "amount": 80,
      "itemCount": 2
    },
    {
      "category": "Other",
      "description": "Money transfers",
      "amount": 129,
      "itemCount": 3
    }
  ]
}

CRITICAL RULES:
- MUST find ALL visible transactions
- MUST group by category
- MUST sum amounts for same category into ONE entry
- amount MUST be real numbers (never 0)
- Return array of grouped transactions, NOT individual ones`;

    // 🎯 CRITICAL PATH FIX 2: Pass the uploaded base64 image string as Gemini expects
    const imagePart = {
      inlineData: {
        data: imageBuffer,
        mimeType: mimeType,
      },
    };

    console.log("Triggering official dynamic SDK call to Gemini Instance...");

    let availableModels = [];
    try {
      availableModels = await listAvailableModels(activeApiKey);
      console.log("Available Gemini/Vertex models:", availableModels);
    } catch (listError) {
      console.warn("Could not list available models:", listError?.message || listError);
    }

    const supportedModels = selectSupportedModels(
      availableModels.length ? availableModels : [
        "models/gemini-2.5-flash",
        "models/gemini-2.5-pro",
        "models/gemini-2.0-flash",
        "models/gemini-flash-latest",
        "models/gemini-pro-latest",
        "models/gemini-3-pro-image",
        "models/gemini-3.1-flash-image",
      ]
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
        responsePayload = await model.generateContent([prompt, imagePart]);
        successfulModel = modelName;
        break;
      } catch (err) {
        lastError = err;
        console.warn(`Gemini model ${modelName} failed:`, err?.message || err);
        if (err?.status === 503) {
          console.warn("503 Service Unavailable - retrying next available model.");
          continue;
        }
      }
    }

    if (!responsePayload) {
      console.error("🛑 Gemini API Error full:", lastError);
      console.error("🛑 Gemini API Error message:", lastError?.message || lastError);
      return res.status(500).json({
        msg: "Gemini API error: Model not found or API key invalid. Please check your GEMINI_API_KEY in .env",
        error: lastError?.message || String(lastError),
        availableModels,
      });
    }

    console.log(`Gemini succeeded with model: ${successfulModel}`);
    
    let rawTextOutput = responsePayload.response.text().trim();
    
    console.log("Raw Response fetched directly from SDK (first 500 chars):", rawTextOutput.slice(0, 500));
    console.log("Full raw response:", rawTextOutput);

    // Attempt to extract JSON from response if it contains markdown or verbose text
    let extractedPayload;
    try {
      // Sanitize output strings 
      rawTextOutput = rawTextOutput.replace(/```json|```/g, "").trim();
      extractedPayload = JSON.parse(rawTextOutput);
      console.log("Parsed JSON successfully:", extractedPayload);
    } catch (jsonError) {
      // Try to find JSON object in the response
      const jsonMatch = rawTextOutput.match(/{[^{}]*"(?:description|amount|category)"[^{}]*}/);
      if (jsonMatch) {
        try {
          extractedPayload = JSON.parse(jsonMatch[0]);
          console.log("Extracted JSON from verbose response:", extractedPayload);
        } catch (innerErr) {
          console.error("Failed to parse extracted JSON:", innerErr.message);
          return res.status(500).json({
            msg: "AI returned invalid data format. Could not extract expense details.",
            error: innerErr.message,
          });
        }
      } else {
        console.error("No JSON found in model response:", rawTextOutput.slice(0, 300));
        return res.status(500).json({
          msg: "AI model returned text instead of structured data. Try with a different model.",
          error: "No JSON format detected",
          model: successfulModel,
        });
      }
    }

    console.log("Final extracted payload before saving:", extractedPayload);

    // Validate response structure - should be array of grouped transactions
    if (!extractedPayload.transactions || !Array.isArray(extractedPayload.transactions)) {
      console.error("❌ Invalid response format. Expected transactions array:", extractedPayload);
      return res.status(400).json({
        msg: "AI response format invalid. Expected grouped transactions.",
        received: extractedPayload,
      });
    }

    if (extractedPayload.transactions.length === 0) {
      console.error("❌ No transactions found in image");
      return res.status(400).json({
        msg: "No transactions detected in the image.",
      });
    }

    // Save all grouped transactions into MongoDB
    const savedExpenses = [];
    for (const transaction of extractedPayload.transactions) {
      // Validate each transaction
      const finalAmount = Number(transaction.amount);
      if (!finalAmount || finalAmount === 0 || isNaN(finalAmount)) {
        console.error("❌ Invalid amount in transaction:", transaction);
        continue; // Skip this one, but continue with others
      }

      if (!transaction.category) {
        console.error("❌ Missing category in transaction:", transaction);
        continue;
      }

      // Save this grouped transaction
      const automatedExpense = new Expense({
        userId,
        description: transaction.description || `${transaction.category} (${transaction.itemCount || 1} items)`,
        amount: finalAmount,
        category: transaction.category,
        date: new Date()
      });
      const saved = await automatedExpense.save();
      savedExpenses.push(saved);
      console.log(`✅ Saved ${transaction.category} expense: ₹${finalAmount}`);
    }

    if (savedExpenses.length === 0) {
      return res.status(400).json({
        msg: "No valid transactions to save from image.",
        error: "All transactions had invalid amounts or categories",
      });
    }

    // 📉 BUDGET THRESHOLD CALCULATION ALERTS ENGINE
    const monthlyBudgetCap = 10000; 
    const objectId = new mongoose.Types.ObjectId(userId);

    const rawAggregatedSums = await Expense.aggregate([
      { $match: { userId: objectId } }, 
      { $group: { _id: null, totalSpent: { $sum: "$amount" } } }
    ]);

    const finalAccumulatedTotal = rawAggregatedSums[0]?.totalSpent || 0;
    const consumptionRatioPercent = (finalAccumulatedTotal / monthlyBudgetCap) * 100;

    let systemAlertNotification = null;

    if (consumptionRatioPercent >= 100) {
      systemAlertNotification = `🛑 Alert Bhai! Your budget limit is 100% used (Spent: ₹${finalAccumulatedTotal}). Stop spending!`;
    } else if (consumptionRatioPercent >= 80) {
      systemAlertNotification = `⚠️ Warning! You have consumed 80% of your budget allowance threshold. Tighten your grip.`;
    } else if (consumptionRatioPercent >= 50) {
      systemAlertNotification = `🔔 Budget update notice: 50% milestone hit. You have safely exhausted half your limits.`;
    }

    return res.status(200).json({
      msg: "AI Receipt processing complete via Gemini Direct Pipeline! 🎉",
      data: savedExpenses,
      summary: {
        transactionsScanned: savedExpenses.length,
        totalAmount: savedExpenses.reduce((sum, exp) => sum + exp.amount, 0),
        categories: [...new Set(savedExpenses.map(exp => exp.category))]
      },
      alert: systemAlertNotification
    });

  } catch (error) {
    console.error("Gemini SDK Processing Pipeline Error:", error);
    return res.status(500).json({ 
      msg: "Failed to perform AI scanning internally via Gemini SDK engine.", 
      error: error.message 
    });
  }
};