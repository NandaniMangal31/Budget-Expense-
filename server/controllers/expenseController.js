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
    console.log("🔍 Starting scanReceiptAndProcess...");
    
    const { imageBuffer, mimeType } = req.body;
    const userId = req.user?._id || req.body.userId;

    console.log("✅ Extracted userId:", userId);
    console.log("✅ Received mimeType:", mimeType);
    console.log("✅ ImageBuffer length:", imageBuffer?.length);

    if (!imageBuffer || !mimeType) {
      console.error("❌ Missing imageBuffer or mimeType");
      return res.status(400).json({ msg: "Document content is required!" });
    }
    if (!userId) {
      console.error("❌ Missing userId");
      return res.status(401).json({ msg: "User ID missing." });
    }

    // Gemini API setup
    const activeApiKey = process.env.GEMINI_API_KEY;
    if (!activeApiKey) {
      console.error("❌ GEMINI_API_KEY not set in environment");
      return res.status(500).json({ msg: "Gemini API key missing." });
    }
    console.log("✅ Gemini API key found");
    const genAI = new GoogleGenerativeAI(activeApiKey);

    // Strict JSON prompt
    const prompt = `
You are an AI that must ONLY return valid JSON.
Do not include explanations, text, or markdown.
Categories must be one of: "Food & Drinks", "Travel & Transport", "Shopping", "Bills & Utilities", "Entertainment", "Other".

Return in this format:
{
  "transactions": [
    {
      "category": "Food & Drinks",
      "description": "Aggregated food spend",
      "amount": 80,
      "itemCount": 2
    }
  ]
}
`;

    const modelInputContent = [
      prompt,
      {
        inlineData: {
          data: imageBuffer,
          mimeType: mimeType,
        },
      },
    ];

    console.log("🚀 Calling Gemini API with models:", supportedModels);
    let responsePayload;
    const supportedModels = ["models/gemini-2.5-flash", "models/gemini-2.0-flash"];
    for (const modelName of supportedModels) {
      try {
        console.log(`📡 Trying model: ${modelName}`);
        const model = genAI.getGenerativeModel({ model: modelName });
        responsePayload = await model.generateContent(modelInputContent);
        console.log(`✅ Model ${modelName} succeeded`);
        break;
      } catch (err) {
        console.error(`❌ Gemini model ${modelName} failed:`, err.message);
      }
    }

    if (!responsePayload) {
      console.error("❌ No Gemini model succeeded");
      return res.status(500).json({ msg: "Gemini API error: no model succeeded." });
    }

    let rawTextOutput;
    try {
      rawTextOutput = responsePayload.response.text().trim();
      console.log("✅ Gemini response received, length:", rawTextOutput.length);
    } catch (textErr) {
      console.error("❌ Error extracting text from Gemini response:", textErr.message);
      return res.status(500).json({ msg: "Failed to extract text from AI response.", error: textErr.message });
    }

    // Safe JSON parse
    let extractedPayload;
    try {
      console.log("🔍 Parsing Gemini JSON response...");
      let sanitizedText = rawTextOutput.replace(/```json|```/g, "").trim();
      // If Gemini adds text before JSON, cut everything before first {
      const firstBrace = sanitizedText.indexOf("{");
      if (firstBrace > 0) sanitizedText = sanitizedText.slice(firstBrace);
      extractedPayload = JSON.parse(sanitizedText);
    } catch (jsonError) {
      console.error("AI JSON Parse Error:", jsonError.message);
      return res.status(500).json({ msg: "AI returned invalid JSON.", raw: rawTextOutput });
    }

    if (!Array.isArray(extractedPayload.transactions)) {
      console.error("❌ Missing transactions array in parsed JSON");
      return res.status(400).json({ msg: "AI response missing transactions array." });
    }

    console.log(`📊 Found ${extractedPayload.transactions.length} transactions to save`);

    // Save transactions
    const savedExpenses = [];
    for (const transaction of extractedPayload.transactions) {
      try {
        const finalAmount = Number(String(transaction.amount).replace(/[^0-9.]/g, ""));
        if (!finalAmount || isNaN(finalAmount)) {
          console.warn("⚠️ Skipping transaction with invalid amount:", transaction.amount);
          continue;
        }

        const automatedExpense = new Expense({
          userId: String(userId),
          description: transaction.description || `${transaction.category} (${transaction.itemCount || 1} items)`,
          amount: finalAmount,
          category: transaction.category,
          date: new Date(),
        });

        const saved = await automatedExpense.save();
        console.log(`✅ Saved expense: ${saved._id} - ${saved.category} - ₹${saved.amount}`);
        savedExpenses.push(saved);

        try {
          await checkBudgetThresholds(userId, saved.category, saved.amount);
          console.log(`✅ Budget threshold checked for ${saved.category}`);
        } catch (budgetErr) {
          console.error("⚠️ Budget threshold check failed:", budgetErr.message);
          // Don't fail the whole request if budget check fails
        }
      } catch (dbSaveErr) {
        console.error("❌ Schema Save Error:", dbSaveErr.message, dbSaveErr.stack);
      }
    }

    if (savedExpenses.length === 0) {
      console.error("❌ No valid transactions were saved");
      return res.status(400).json({ msg: "No valid transactions parsed." });
    }

    console.log(`✅ Successfully saved ${savedExpenses.length} expenses`);

    return res.status(200).json({
      success: true,
      msg: "AI Document processed successfully!",
      data: savedExpenses,
      summary: {
        transactionsScanned: savedExpenses.length,
        totalAmount: savedExpenses.reduce((sum, exp) => sum + exp.amount, 0),
        categories: [...new Set(savedExpenses.map((exp) => exp.category))],
      },
    });
  } catch (error) {
    console.error("🚨 CRITICAL ERROR in scanReceiptAndProcess:", error);
    console.error("Error stack:", error.stack);
    return res.status(500).json({ 
      msg: "AI scanning failed.", 
      error: error.message,
      details: error.stack 
    });
  }
};

