import { GoogleGenerativeAI } from "@google/generative-ai";
import Expense from "../models/Expense.js";
import { checkBudgetThresholds } from "../utils/budgetAlertEngine.js";

// ➕ ADD MANUAL EXPENSE
export const addExpense = async (req, res) => {
  try {
    const userId = req.user?._id || req.body.userId;
    if (!userId) {
      return res.status(400).json({ msg: "User ID is required!" });
    }

    const expenseData = {
      ...req.body,
      userId: String(userId), // ✅ always string
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

// 🔍 GET EXPENSES
export const getExpenses = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ msg: "User ID is required!" });
    }

    const expenses = await Expense.find({ userId: String(userId) }).sort({
      date: -1,
    });
    res.json(expenses);
  } catch (err) {
    console.error("Fetch Expenses Error:", err);
    res.status(500).json({ msg: "Database query error.", error: err.message });
  }
};

// 📸 AI SCAN RECEIPT & PROCESS
export const scanReceiptAndProcess = async (req, res) => {
  try {
    const { imageBuffer, mimeType } = req.body;
    const userId = req.user?._id || req.body.userId;

    if (!imageBuffer || !mimeType) {
      return res.status(400).json({ msg: "Document content is required!" });
    }
    if (!userId) {
      return res.status(401).json({ msg: "User ID missing." });
    }

    // Gemini API setup
    const activeApiKey = process.env.GEMINI_API_KEY;
    if (!activeApiKey) {
      return res.status(500).json({ msg: "Gemini API key missing." });
    }
    const genAI = new GoogleGenerativeAI(activeApiKey);

    // Prompt definition
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
...

STEP 4: Return JSON with grouped transactions
Return this format EXACTLY:
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

    // Build model input
    const modelInputContent = [
      prompt,
      {
        inlineData: {
          data: imageBuffer,
          mimeType: mimeType,
        },
      },
    ];

    // Try models
    let responsePayload;
    const supportedModels = [
      "models/gemini-2.5-flash",
      "models/gemini-2.0-flash",
    ];
    for (const modelName of supportedModels) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        responsePayload = await model.generateContent(modelInputContent);
        break;
      } catch (err) {
        console.warn(`Gemini model ${modelName} failed:`, err.message);
      }
    }

    if (!responsePayload) {
      return res
        .status(500)
        .json({ msg: "Gemini API error: no model succeeded." });
    }

    let rawTextOutput = responsePayload.response.text().trim();
    console.log("Gemini raw output:", rawTextOutput);

    // Parse JSON safely
    let extractedPayload;
    try {
      let sanitizedText = rawTextOutput.replace(/```json|```/g, "").trim();
      extractedPayload = JSON.parse(sanitizedText);
    } catch (jsonError) {
      return res
        .status(500)
        .json({ msg: "AI returned invalid JSON.", error: jsonError.message });
    }

    if (!Array.isArray(extractedPayload.transactions)) {
      return res
        .status(400)
        .json({ msg: "AI response missing transactions array." });
    }

    // 💾 Save transactions
    const savedExpenses = [];
    for (const transaction of extractedPayload.transactions) {
      try {
        const finalAmount = Number(
          String(transaction.amount).replace(/[^0-9.]/g, ""),
        );
        if (!finalAmount || isNaN(finalAmount)) continue;

        const automatedExpense = new Expense({
          userId: String(userId),
          description:
            transaction.description ||
            `${transaction.category} (${transaction.itemCount || 1} items)`,
          amount: finalAmount,
          category: transaction.category, // ✅ keep full category names
          date: new Date(),
        });

        const saved = await automatedExpense.save();
        savedExpenses.push(saved);

        if (typeof checkBudgetThresholds === "function") {
          await checkBudgetThresholds(userId, saved.category, saved.amount);
        }
      } catch (dbSaveErr) {
        console.error("Schema Save Error:", dbSaveErr.message);
      }
    }

    if (savedExpenses.length === 0) {
      return res.status(400).json({ msg: "No valid transactions parsed." });
    }

    // 📊 Aggregation
    const rawAggregatedSums = await Expense.aggregate([
      { $match: { userId: String(userId) } }, // ✅ match string
      { $group: { _id: null, totalSpent: { $sum: "$amount" } } },
    ]);

    const finalAccumulatedTotal = rawAggregatedSums[0]?.totalSpent || 0;
    const monthlyBudgetCap = 10000;
    const consumptionRatioPercent =
      (finalAccumulatedTotal / monthlyBudgetCap) * 100;

    let systemAlertNotification = null;
    if (consumptionRatioPercent >= 100) {
      systemAlertNotification = `🛑 Alert! Budget fully used (₹${finalAccumulatedTotal}).`;
    } else if (consumptionRatioPercent >= 80) {
      systemAlertNotification = `⚠️ Warning! 80% of budget consumed.`;
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
    console.error("Gemini Processing Error:", error);
    return res
      .status(500)
      .json({ msg: "AI scanning failed.", error: error.message });
  }
};
