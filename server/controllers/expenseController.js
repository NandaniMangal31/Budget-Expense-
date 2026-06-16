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
      userId: String(userId),
      amount: Number(req.body.amount),
    };

    const expense = await Expense.create(expenseData);

    // ✅ Trigger budget threshold check
    await checkBudgetThresholds(userId, expense.category, expense.amount);

    res.status(201).json(expense);
  } catch (err) {
    console.error("Manual Add Error:", err);
    res.status(500).json({ msg: "Server error while saving expense.", error: err.message });
  }
};

// 🔍 GET EXPENSES
export const getExpenses = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ msg: "User ID is required!" });
    }

    const expenses = await Expense.find({ userId: String(userId) }).sort({ date: -1 });
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

    // Prompt definition (aligned with category enums)
    const prompt = `ANALYZE TRANSACTION RECORDS AND RETURN JSON.
Categories must be one of: "Food & Drinks", "Travel & Transport", "Shopping", "Bills & Utilities", "Entertainment", "Other".
Return ONLY valid JSON in this format:
{
  "transactions": [
    {
      "category": "Food & Drinks",
      "description": "Aggregated food spend",
      "amount": 80,
      "itemCount": 2
    }
  ]
}`;

    const modelInputContent = [
      prompt,
      {
        inlineData: {
          data: imageBuffer,
          mimeType: mimeType,
        },
      },
    ];

    let responsePayload;
    const supportedModels = ["models/gemini-2.5-flash", "models/gemini-2.0-flash"];
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
      return res.status(500).json({ msg: "Gemini API error: no model succeeded." });
    }

    let rawTextOutput = responsePayload.response.text().trim();
    console.log("Gemini raw output:", rawTextOutput);

    // Parse JSON safely
    let extractedPayload;
    try {
      let sanitizedText = rawTextOutput.replace(/```json|```/g, "").trim();
      extractedPayload = JSON.parse(sanitizedText);
    } catch (jsonError) {
      console.error("AI JSON Parse Error:", jsonError.message, rawTextOutput);
      return res.status(500).json({ msg: "AI returned invalid JSON.", error: jsonError.message });
    }

    if (!Array.isArray(extractedPayload.transactions)) {
      return res.status(400).json({ msg: "AI response missing transactions array." });
    }

    // 💾 Save transactions
    const savedExpenses = [];
    for (const transaction of extractedPayload.transactions) {
      try {
        const finalAmount = Number(String(transaction.amount).replace(/[^0-9.]/g, ""));
        if (!finalAmount || isNaN(finalAmount)) continue;

        const automatedExpense = new Expense({
          userId: String(userId),
          description: transaction.description || `${transaction.category} (${transaction.itemCount || 1} items)`,
          amount: finalAmount,
          category: transaction.category,
          date: new Date(),
        });

        const saved = await automatedExpense.save();
        savedExpenses.push(saved);

        await checkBudgetThresholds(userId, saved.category, saved.amount);
      } catch (dbSaveErr) {
        console.error("Schema Save Error:", dbSaveErr.message);
      }
    }

    if (savedExpenses.length === 0) {
      return res.status(400).json({ msg: "No valid transactions parsed." });
    }

    // 📊 Aggregation
    const rawAggregatedSums = await Expense.aggregate([
      { $match: { userId: String(userId) } },
      { $group: { _id: null, totalSpent: { $sum: "$amount" } } },
    ]);

    const finalAccumulatedTotal = rawAggregatedSums[0]?.totalSpent || 0;
    const monthlyBudgetCap = 10000; // ⚠️ Replace with dynamic budget later
    const consumptionRatioPercent = (finalAccumulatedTotal / monthlyBudgetCap) * 100;

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
    return res.status(500).json({ msg: "AI scanning failed.", error: error.message });
  }
};
