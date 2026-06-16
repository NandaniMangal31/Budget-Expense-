import dotenv from "dotenv";
dotenv.config();

import OpenAI from "openai";

console.log("OPENAI KEY:", process.env.OPENAI_API_KEY);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// CATEGORY DETECTION
export const categorizeExpenseAI = async (text) => {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "Classify expense into: Food, Travel, Shopping, Bills, Entertainment",
      },
      {
        role: "user",
        content: text,
      },
    ],
  });

  return response.choices[0].message.content;
};

// INSIGHT GENERATION
export const generateInsightAI = async (data) => {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are a financial advisor. Give short savings advice based on spending data.",
      },
      {
        role: "user",
        content: JSON.stringify(data),
      },
    ],
  });

  return response.choices[0].message.content;
};

export default openai;