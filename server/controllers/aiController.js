import { categorizeExpenseAI, generateInsightAI } from "../services/openaiService.js";

// Categorize expense text
export const categorizeExpense = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || text.trim() === "") {
      return res.status(400).json({ message: "Expense text is required." });
    }

    const category = await categorizeExpenseAI(text);
    res.json({ success: true, category });
  } catch (err) {
    console.error("AI Categorization Error:", err);
    res.status(500).json({ success: false, message: "AI categorization failed.", error: err.message });
  }
};

// Generate insights from spending data
export const getInsights = async (req, res) => {
  try {
    const data = req.body;
    if (!data || Object.keys(data).length === 0) {
      return res.status(400).json({ message: "Spending data is required." });
    }

    const insight = await generateInsightAI(data);
    res.json({ success: true, insight });
  } catch (err) {
    console.error("AI Insight Error:", err);
    res.status(500).json({ success: false, message: "AI insight generation failed.", error: err.message });
  }
};
