import { categorizeExpenseAI, generateInsightAI } from "../services/openaiService.js";

export const categorizeExpense = async (req, res) => {
  try {
    const { text } = req.body;

    const category = await categorizeExpenseAI(text);

    res.json({ category });
  } catch (err) {
    res.status(500).json(err);
  }
};

export const getInsights = async (req, res) => {
  try {
    const data = req.body;

    const insight = await generateInsightAI(data);

    res.json({ insight });
  } catch (err) {
    res.status(500).json(err);
  }
};