/** Canonical categories aligned with Expense schema + AI prompts */

export const EXPENSE_CATEGORIES = [
  "Groceries",
  "Food & Drinks",
  "Travel & Transport",
  "Shopping",
  "Bills & Utilities",
  "Entertainment",
  "Healthcare",
  "Education",
  "Insurance",
  "Investment",
  "Cash Withdrawal",
  "Transfer",
  "Other",
];

export const SCAN_CATEGORIES = [
  "Food & Drinks",
  "Travel & Transport",
  "Shopping",
  "Bills & Utilities",
  "Entertainment",
  "Healthcare",
  "Education",
  "Investment",
  "Other",
];

/** Merchant / keyword hints for rule-based categorization */
export const MERCHANT_CATEGORY_RULES = [
  { pattern: /\b(swiggy|zomato|dominos|kfc|mcdonald|starbucks|restaurant|cafe|food|dining|biryani|pizza)\b/i, category: "Food & Drinks" },
  { pattern: /\b(uber|ola|rapido|irctc|metro|petrol|fuel|cab|travel|redbus|makemytrip)\b/i, category: "Travel & Transport" },
  { pattern: /\b(amazon|flipkart|myntra|ajio|meesho|shopping|mall|retail)\b/i, category: "Shopping" },
  { pattern: /\b(netflix|spotify|pvr|inox|bookmyshow|cinema|movie|gaming)\b/i, category: "Entertainment" },
  { pattern: /\b(jio|airtel|electricity|water|recharge|rent|broadband|bill|utilities)\b/i, category: "Bills & Utilities" },
  { pattern: /\b(hospital|pharmacy|clinic|medical|apollo|fortis|1mg|pharmeasy)\b/i, category: "Healthcare" },
  { pattern: /\b(school|college|university|tuition|course|udemy|coursera|education)\b/i, category: "Education" },
  { pattern: /\b(mutual fund|sip|zerodha|groww|investment|stock|nifty)\b/i, category: "Investment" },
];

export const categorizeByMerchantRules = (description) => {
  const desc = String(description || "");
  for (const rule of MERCHANT_CATEGORY_RULES) {
    if (rule.pattern.test(desc)) return rule.category;
  }
  return "Other";
};

export default {
  EXPENSE_CATEGORIES,
  SCAN_CATEGORIES,
  MERCHANT_CATEGORY_RULES,
  categorizeByMerchantRules,
};
