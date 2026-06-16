import dotenv from "dotenv";
dotenv.config();

import OpenAI from "openai";

// ✅ Ensure API key is loaded
if (!process.env.OPENAI_API_KEY) {
  console.error("🚨 Missing OPENAI_API_KEY in environment variables!");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// CATEGORY DETECTION
export const categorizeExpenseAI = async (text) => {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Classify the following expense into one of these categories: Food & Drinks, Travel & Transport, Shopping, Bills & Utilities, Entertainment, Other. Return only the category name.",
        },
        {
          role: "user",
          content: text,
        },
      ],
    });

    return response.choices[0]?.message?.content?.trim() || "Other";
  } catch (err) {
    console.error("🚨 AI Categorization Error:", err.message);
    return "Other"; // fallback
  }
};

// INSIGHT GENERATION
export const generateInsightAI = async (data) => {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a financial advisor. Based on the spending data provided, give a short, practical savings tip (1–2 sentences).",
        },
        {
          role: "user",
          content: JSON.stringify(data),
        },
      ],
    });

    return response.choices[0]?.message?.content?.trim() || "No insight generated.";
  } catch (err) {
    console.error("🚨 AI Insight Error:", err.message);
    return "Unable to generate insight at this time.";
  }
};

export default openai;
