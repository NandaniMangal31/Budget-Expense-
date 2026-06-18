import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

// 🛡️ Safe check to ensure service fails fast if environment tokens are missing
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ CRITICAL: OPENAI_API_KEY environment variable is missing inside your .env configuration matrix!");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * 🏷️ AI Categorization Strategy
 * Analyzes unstructured entry logs and maps them to absolute database enum types
 */
export const categorizeExpenseAI = async (text) => {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1, // 📉 Low temperature enforces deterministic, reliable mapping results
      messages: [
        {
          role: "system",
          content: `You are an accurate data classification backend utility. 
Categorize the incoming user purchase or transaction text into EXACTLY one of these target database schema category keys:
- "Food & Drinks"
- "Travel & Transport"
- "Shopping"
- "Bills & Utilities"
- "Entertainment"
- "Healthcare"
- "Education"
- "Investment"
- "Groceries"
- "Other"

CRITICAL: Return ONLY the exact string value from the list above. Do not include periods, extra spaces, explanation details, or additional formatting markdown blocks.`,
        },
        {
          role: "user",
          content: text,
        },
      ],
    });

    // Extract, clean up, and sanitize text layout from response payload blocks
    const finalCategory = response.choices[0]?.message?.content?.replace(/['"]/g, "").trim();
    
    // Fallback block mechanism just in case LLM outputs an unmapped key value
    const validCategories = [
      "Food & Drinks", "Travel & Transport", "Shopping", "Bills & Utilities",
      "Entertainment", "Healthcare", "Education", "Investment", "Groceries", "Other",
    ];
    return validCategories.includes(finalCategory) ? finalCategory : "Other";

  } catch (error) {
    console.error("🚨 OpenAI Categorization Service Failure Trace:", error.message);
    throw new Error("Failed to resolve text strings via external classification engine.");
  }
};

/**
 * 📊 Financial Analytics Framework
 * Parses current spending array structures alongside target thresholds to build summaries
 */
export const generateInsightAI = async (data) => {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7, // 📈 Moderate temperature allows for natural, engaging advice formatting
      messages: [
        {
          role: "system",
          content: `You are an expert financial planning advisor and wallet management system optimizer.
Analyze the structured transaction data array objects and cross-reference them with target milestone limits.
Provide clear, actionable, short savings advice (2-3 sentences max) highlighting potential overspending categories.
Be direct, supportive, and focus entirely on optimizations. Use a professional corporate advisor tone.`,
        },
        {
          role: "user",
          content: typeof data === "string" ? data : JSON.stringify(data),
        },
      ],
    });

    return response.choices[0]?.message?.content || "No advice profile computed by the analytical model engine.";
  } catch (error) {
    console.error("🚨 OpenAI Financial Advisory Engine Service Failure Trace:", error.message);
    throw new Error("Failed compiling insights via automated parsing architectures.");
  }
};

export default openai;