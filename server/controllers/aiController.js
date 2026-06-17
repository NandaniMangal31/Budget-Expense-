import { categorizeExpenseAI, generateInsightAI } from "../services/openaiService.js";

/**
 * 🏷️ Single text expense categorization engine
 * Takes a raw description string and calculates the target frontend category
 */
export const categorizeExpense = async (req, res) => {
  try {
    const { text } = req.body;

    // 🛡️ Fail-safe validation check
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ 
        success: false,
        message: "A valid, non-empty text string parameter is required for categorization." 
      });
    }

    const category = await categorizeExpenseAI(text.trim());

    return res.json({ 
      success: true,
      category 
    });
  } catch (err) {
    // Log the actual system failure internally for debugging
    console.error("🚨 AI Categorization Controller Failure Trace:", err);
    
    // Return a clean, safe diagnostic warning to the client layout
    return res.status(500).json({ 
      success: false,
      message: "An internal operational error occurred while analyzing the expense category." 
    });
  }
};

/**
 * 📊 Financial Insights Generator
 * Analyzes structured spending data arrays to provide custom optimization feedback
 */
export const getInsights = async (req, res) => {
  try {
    const { expenses, budgetTargets } = req.body;

    // 🛡️ Structure check to ensure the AI service gets valid financial arrays
    if (!expenses || !Array.isArray(expenses)) {
      return res.status(400).json({ 
        success: false,
        message: "Missing or invalid structured financial data array blocks required for analysis." 
      });
    }

    // Build a secure, structured payload instead of forwarding the raw req.body object
    const insightPayload = {
      expenses,
      budgetTargets: budgetTargets || {}
    };

    const insight = await generateInsightAI(insightPayload);

    return res.json({ 
      success: true,
      insight 
    });
  } catch (err) {
    console.error("🚨 AI Insights Generation Controller Failure Trace:", err);
    
    return res.status(500).json({ 
      success: false,
      message: "Failed parsing user spending datasets through the AI analytics engine." 
    });
  }
};