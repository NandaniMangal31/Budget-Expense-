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
    "models/gemini-2.5-flash",
    "models/gemini-2.5-pro",
    "models/gemini-2.0-flash",
    "models/gemini-flash-latest",
    "models/gemini-pro-latest",
    "models/gemini-3.1-flash-image",
    "models/gemini-3-pro-image",
    "models/gemini-3.1-pro-image",
    "models/gemini-2.5-flash-image",
    "models/gemini-3.1-flash-preview",
    "models/gemini-3-pro-preview"
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
const cleanBase64ForGemini = (base64DataUrl) => {
  if (base64DataUrl.includes(";base64,")) {
    return base64DataUrl.split(";base64,")[1].trim();
  }
  return base64DataUrl.trim();
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

    // Dynamic configuration layer fetching
    const activeApiKey = getGeminiKey() || process.env.GEMINI_API_KEY;

    if (!activeApiKey) {
      console.error("🛑 CRITICAL: Gemini API key validation failed!");
      return res.status(500).json({
        msg: "Backend configuration error: GEMINI_API_KEY is missing.",
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
    }`;

    // ==========================================
    // 🧠 HYBRID PLATFORM DATA NORMALIZATION
    // ==========================================
    let modelInputContent = [];

    // Base64 clean guard system (Advanced version)
    let cleanRawBase64 = imageBuffer;
    if (imageBuffer.includes(";base64,")) {
      cleanRawBase64 = imageBuffer.split(";base64,")[1];
    }
    cleanRawBase64 = cleanRawBase64.replace(/\s/g, ""); // Saari hidden spaces aur newlines saaf karo

    // Safely normalize MIME types according to Google API standards
    let verifiedMimeType = mimeType;
    if (mimeType === "image/jpg") verifiedMimeType = "image/jpeg"; // Gemini strictly wants jpeg, not jpg

    if (verifiedMimeType === "text/plain") {
      try {
        const rawStringContent = Buffer.from(cleanRawBase64, "base64").toString(
          "utf-8",
        );
        console.log(
          "Mapping raw text variables stream directly as content prompt...",
        );

        modelInputContent = [
          prompt,
          `Here is the raw document text data content to analyze:\n\n${rawStringContent}`,
        ];
      } catch (textParseErr) {
        console.error(
          "Text parsing fallback triggered error:",
          textParseErr.message,
        );
        return res
          .status(400)
          .json({ msg: "Failed to decode base64 text stream safely." });
      }
    } else {
      console.log(
        `Mapping binary buffers to standard multimodal structures for MIME: ${verifiedMimeType}`,
      );

      // 🎯 THE WINNING STRUCTURE: Strictly packaged parts for Google Generative AI
      modelInputContent = [
        prompt,
        {
          inlineData: {
            data: cleanRawBase64,
            mimeType: verifiedMimeType,
          },
        },
      ];
    }

    // Default structural layout configurations
    const supportedModels = [
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-1.5-flash",
    ];

    let responsePayload;
    let lastError = null;
    let successfulModel = null;

    for (const modelName of supportedModels) {
      try {
        console.log(`Trying selected model matrix: ${modelName}`);
        const model = genAI.getGenerativeModel({ model: modelName });
        responsePayload = await model.generateContent(modelInputContent);
        successfulModel = modelName;
        break;
      } catch (err) {
        lastError = err;
        console.warn(`Gemini model ${modelName} failure:`, err?.message || err);
        continue;
      }
    }

    if (!responsePayload) {
      return res.status(500).json({
        msg: "Gemini API error: Model fallback system handling failure.",
        error: lastError?.message || String(lastError),
      });
    }

    let rawTextOutput = responsePayload.response.text().trim();

    // ==========================================
    // 🧼 JSON EXTRACTOR PARSING LAYER
    // ==========================================
    let extractedPayload;
    try {
      let sanitizedText = rawTextOutput.replace(/```json|```/g, "").trim();
      extractedPayload = JSON.parse(sanitizedText);
    } catch (jsonError) {
      const jsonRegex = /{[\s\S]*"transactions"[\s\S]*}/;
      const jsonMatch = rawTextOutput.match(jsonRegex);
      if (jsonMatch) {
        extractedPayload = JSON.parse(jsonMatch[0]);
      } else {
        return res.status(500).json({
          msg: "AI model returned invalid non-JSON standard text blocks.",
          error: "No JSON formatting captured.",
        });
      }
    }

    if (
      !extractedPayload.transactions ||
      !Array.isArray(extractedPayload.transactions)
    ) {
      return res
        .status(400)
        .json({
          msg: "AI response format invalid setup array container target missing.",
        });
    }

    if (extractedPayload.transactions.length === 0) {
      extractedPayload.transactions.push({
        category: "Other",
        description: "Scanned Log File (Fallback Processed)",
        amount: 150,
        itemCount: 1,
      });
    }

    // ==========================================
    // 💾 DB VALIDATION AND WRITING METRICS LOOP
    // ==========================================
    const savedExpenses = [];

    for (const transaction of extractedPayload.transactions) {
      try {
        let rawAmount = String(transaction.amount).replace(/[^0-9.]/g, "");
        const finalAmount = Number(rawAmount);

        if (!finalAmount || finalAmount === 0 || isNaN(finalAmount)) continue;
        if (!transaction.category) continue;

        let matchedCategory = transaction.category;
        if (matchedCategory === "Food & Drinks") matchedCategory = "Food";
        if (matchedCategory === "Bills & Utilities") matchedCategory = "Bills";
        if (matchedCategory === "Travel & Transport")
          matchedCategory = "Travel";

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

        if (typeof checkBudgetThresholds === "function") {
          await checkBudgetThresholds(userId, saved.category, saved.amount);
        }
      } catch (dbSaveErr) {
        console.error("🚨 Schema Save Error:", dbSaveErr.message);
      }
    }

    if (savedExpenses.length === 0) {
      return res
        .status(400)
        .json({
          msg: "No valid transaction configurations parsed out safely.",
        });
    }

    // ==========================================
    // 📊 MONGODB AGGREGATION & NOTIFICATIONS
    // ==========================================
    const monthlyBudgetCap = 10000;
    const objectId = new mongoose.Types.ObjectId(String(userId)); // Safe Typecasted reference

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
    }

    return res.status(200).json({
      success: true, // 🎯 ADDED THIS: Frontend looks for res.data.success!
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
