import axios from "axios";
import { GoogleGenerativeAI } from "@google/generative-ai";
import mongoose from "mongoose";
import ExcelJS from "exceljs"; // 📊 Native Spreadsheet Decoder Engine
import XLSX from "xlsx";
import { Readable } from "stream"; // feeds CSV buffers into ExcelJS's csv reader
import mammoth from "mammoth"; // 📝 Native Word Document (.docx) Decoder Engine
import Tesseract from "tesseract.js";
import sharp from "sharp";
import { PDFParse } from "pdf-parse";
import { pdf as pdfToImages } from "pdf-to-img";
import Expense from "../models/Expense.js";
import { checkBudgetThresholds } from "../utils/budgetAlertEngine.js";

// 🧱 SECURE KEY RESOLUTION LAYER
const getGeminiKey = () => {
  if (
    process.env.GEMINI_API_KEY &&
    !process.env.GEMINI_API_KEY.includes("YourActual")
  ) {
    return process.env.GEMINI_API_KEY;
  }

  console.error(
    "⚠️ Gemini API Key missing or placeholder. Set a valid GEMINI_API_KEY in .env.",
  );
  return null;
};

const isValidGeminiKey = (key) => {
  return (
    typeof key === "string" &&
    key.length > 20 &&
    !key.includes("YourActual") &&
    !key.includes("PLACEHOLDER")
  );
};

const listAvailableModels = async (apiKey) => {
  try {
    const url = "https://generativelanguage.googleapis.com/v1beta/models";
    const response = await axios.get(url, {
      params: { key: apiKey },
      timeout: 15000,
    });
    if (!response.data || !Array.isArray(response.data.models)) return [];
    return response.data.models.map((model) => model.name || model);
  } catch (err) {
    console.warn("Could not list available models natively:", err.message);
    return [];
  }
};

const RECEIVED_KEYWORDS =
  /\b(received|credited|credit|refund|refunded|reversal|reversed|cashback|salary|income|deposit|money\s+in)\b/i;

const isReceivedTransaction = (description, lineText = "") => {
  const text = `${description || ""} ${lineText || ""}`.toLowerCase();
  return RECEIVED_KEYWORDS.test(text);
};

const resolveTransactionType = (description, lineText = "") =>
  isReceivedTransaction(description, lineText) ? "received" : "expense";

// 🧼 DYNAMIC CATEGORIZATION ENGINE UTILITY HELPER
const autoCategorize = (description) => {
  const desc = (description || "").toLowerCase().trim();
  if (/interest expense|interest/i.test(desc)) return "Other";
  if (/groceries|grocery|smith\'s|smiths/i.test(desc)) return "Groceries";
  if (/credit|beginning balance|balance|account balance/i.test(desc)) return "Bills & Utilities";
  if (/zomato|swiggy|restaurant|hotel|food|cafe|mcdonald|starbucks|blinkit|zepto|instamart|eat|canteen|dinner|lunch|breakfast|bakery|diner|dining|pizza|burger|biryani|dominos|kfc|tea|coffee|snack|meal/i.test(desc)) return "Food & Drinks";
  if (/uber|ola|rapido|irctc|flight|metro|petrol|fuel|shell|diesel|train|bus|cab|travel|transport|automart|car|bike|garage|auto|parking|toll/i.test(desc)) return "Travel & Transport";
  if (/amazon|flipkart|myntra|zara|h&m|mall|shopping|clothing|electronics|shoes|apparel|store|walmart|target|mart|market|retail/i.test(desc)) return "Shopping";
  if (/jio|airtel|electricity|water|gas|broadband|recharge|rent|netflix|spotify|prime|bill|utilities|mobile|wifi|internet/i.test(desc)) return "Bills & Utilities";
  if (/movie|pvr|inox|gaming|pub|club|bar|concert|theater|booking|cinema|game/i.test(desc)) return "Entertainment";
  return "Other";
};

const normalizeModelName = (name) => String(name).replace(/^models\//, "");

const ALLOWED_CATEGORIES = [
  "Groceries",
  "Food & Drinks",
  "Travel & Transport",
  "Shopping",
  "Bills & Utilities",
  "Entertainment",
  "Other",
];

// Supported upload types for the universal scanner
const SUPPORTED_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "pdf",
  "xlsx",
  "xls",
  "csv",
  "docx",
  "doc",
  "rtf",
  "txt",
];

const MIME_BY_EXTENSION = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  csv: "text/csv",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  rtf: "application/rtf",
  txt: "text/plain",
};

const resolveUploadFile = (mimeType, fileName) => {
  const lowerName = String(fileName || "").toLowerCase();
  const ext = lowerName.includes(".") ? lowerName.split(".").pop() : "";
  const supported = SUPPORTED_EXTENSIONS.includes(ext);
  const resolvedMime =
    mimeType && mimeType !== "application/octet-stream"
      ? mimeType
      : MIME_BY_EXTENSION[ext] || mimeType || "application/octet-stream";

  let fileKind = "unknown";
  if (/^image\//.test(resolvedMime) || ["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) {
    fileKind = "image";
  } else if (resolvedMime.includes("pdf") || ext === "pdf") {
    fileKind = "pdf";
  } else if (["xlsx", "xls", "csv"].includes(ext) || /spreadsheet|excel|csv/i.test(resolvedMime)) {
    fileKind = "spreadsheet";
  } else if (["docx", "doc"].includes(ext) || /word|msword|wordprocessing/i.test(resolvedMime)) {
    fileKind = "word";
  } else if (ext === "rtf" || /rtf/i.test(resolvedMime)) {
    fileKind = "rtf";
  } else if (ext === "txt" || /text\/plain/i.test(resolvedMime)) {
    fileKind = "text";
  }

  return { ext, mimeType: resolvedMime, fileKind, supported };
};

const cleanRTFToText = (rtfStr) => {
  let text = String(rtfStr || "");
  text = text.replace(/\\([a-z]{1,32})(-?\d+)? ?/gi, "");
  text = text.replace(/\{[^}]*\}/g, "");
  text = text.replace(/[\r\n\t]+/g, "\n");
  return text.trim();
};

const successMessageForScan = (fileKind, usedLocalOcr) => {
  const labels = {
    image: "Image",
    pdf: "PDF",
    spreadsheet: "Spreadsheet",
    word: "Word document",
    rtf: "RTF document",
    text: "Text file",
  };
  const label = labels[fileKind] || "Document";
  if (usedLocalOcr) {
    return `${label} processed with local OCR (AI quota unavailable). 🎉`;
  }
  return `${label} scanned and categorized successfully! 🎉`;
};

const DOCUMENT_SCAN_PROMPT = `Analyze this expense document and extract every individual purchase/transaction line.

Categories (use exactly one per line): ${ALLOWED_CATEGORIES.map((c) => `"${c}"`).join(", ")}

Rules:
- Read line by line; one row with a price = one transaction.
- Use only real money amounts (never dates, years, invoice numbers, qty, or phone numbers).
- Skip subtotal, tax, grand total, balance, and header/footer rows.
- If description contains received, credited, refund, salary, or income — still include the row (it will be classified as income).
- amount must be a plain number (no currency symbols).

Return ONLY raw JSON:
{"transactions":[{"category":"Food & Drinks","description":"Zomato dinner","amount":250.5,"itemCount":1}]}`;

const IMAGE_SCAN_PROMPT = `You are an expert receipt and bill analyzer with vision OCR.

Study the entire image carefully, then extract expenses line by line.

For EACH real purchase line in the image:
1. description = merchant or item text on that line
2. amount = the price paid on that line (numeric only)
3. category = exactly one of: ${ALLOWED_CATEGORIES.map((c) => `"${c}"`).join(", ")}

Critical rules:
- Read the image top-to-bottom, line by line.
- NEVER use dates (17/06/2026), times (14:30), years (2024/2025/2026), invoice IDs, GSTIN, or qty as amount.
- Ignore address, phone, thank-you notes, barcode text.
- Skip rows named: subtotal, tax, cgst, sgst, total, grand total, balance, change, tip.
- Include rows with received, credited, refund, salary, or income in the description (money coming in).
- If one line has item + amount, create one transaction for that line.
- Choose category from item/merchant meaning (food places => Food & Drinks, fuel/uber => Travel & Transport, etc).

Return ONLY valid JSON, no markdown:
{"transactions":[{"category":"Food & Drinks","description":"Chicken biryani","amount":199,"itemCount":1}]}`;

const selectVisionModels = (availableModels) => {
  const preferredOrder = [
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-2.5-flash",
    "gemini-2.0-flash-lite",
    "gemini-flash-latest",
  ];
  const ordered = [];
  const used = new Set();

  for (const candidate of preferredOrder) {
    const match = availableModels.find((name) => {
      const lower = String(name).toLowerCase();
      const isExcluded =
        lower.includes("embedding") ||
        lower.includes("aqa") ||
        lower.includes("imagen") ||
        lower.includes("veo") ||
        lower.includes("gemma") ||
        lower.includes("pro") ||
        lower.includes("gemini-3") ||
        lower.includes("gemini-3.5") ||
        lower.includes("latest");
      return !isExcluded && lower.includes(candidate);
    });
    if (match && !used.has(match)) {
      ordered.push(normalizeModelName(match));
      used.add(match);
    }
  }
  return ordered.length ? ordered : ["gemini-2.0-flash", "gemini-1.5-flash"];
};

const selectSupportedModels = (availableModels) => {
  const preferredOrder = [
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
    "gemini-2.0-flash",
    "gemini-2.5-flash",
    "gemini-flash-latest",
  ];
  const ordered = [];
  const used = new Set();

  for (const candidate of preferredOrder) {
    const match = availableModels.find((name) => {
      const lower = String(name).toLowerCase();
      const isExcluded =
        lower.includes("embedding") ||
        lower.includes("aqa") ||
        lower.includes("imagen") ||
        lower.includes("veo") ||
        lower.includes("gemma") ||
        lower.includes("pro") ||
        lower.includes("gemini-3") ||
        lower.includes("gemini-3.5") ||
        lower.includes("latest");
      return !isExcluded && lower.includes(candidate);
    });
    if (match && !used.has(match)) {
      ordered.push(normalizeModelName(match));
      used.add(match);
    }
  }
  return ordered.length ? ordered : ["gemini-2.0-flash-lite", "gemini-1.5-flash"];
};

const runImageOcr = async (buffer) => {
  const recognize = (input, options = {}) =>
    Tesseract.recognize(input, "eng", { logger: () => {}, ...options });

  let preprocessed = buffer;
  try {
    preprocessed = await sharp(buffer)
      .resize({ width: 1400, withoutEnlargement: false })
      .grayscale()
      .normalize()
      .sharpen()
      .toBuffer();
  } catch (imgErr) {
    console.warn("Image preprocess skipped:", imgErr.message);
  }

  const primary = await recognize(preprocessed);
  let text = primary.data?.text || "";

  // Retry with sparse-text mode when OCR returns too little (common on mobile screenshots).
  if (text.split(/\r?\n/).filter((l) => l.trim()).length < 8) {
    const sparse = await recognize(preprocessed, { tessedit_pageseg_mode: "11" });
    if ((sparse.data?.text || "").length > text.length) {
      text = sparse.data.text;
    }
  }

  // Final fallback on original buffer if preprocessing made OCR worse.
  if (text.split(/\r?\n/).filter((l) => l.trim()).length < 6) {
    const raw = await recognize(buffer);
    if ((raw.data?.text || "").length > text.length) {
      text = raw.data.text;
    }
  }

  return text;
};

const extractPdfText = async (buffer) => {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result?.text?.trim() || "";
  } finally {
    await parser.destroy().catch(() => {});
  }
};

const ocrScannedPdf = async (buffer) => {
  const MAX_PAGES = 5;
  let fullText = "";
  const document = await pdfToImages(buffer, { scale: 2 });

  let pageNum = 0;
  for await (const pageImage of document) {
    pageNum += 1;
    if (pageNum > MAX_PAGES) break;

    const pageText = await runImageOcr(pageImage);
    if (pageText.trim()) {
      fullText += `\n--- Page ${pageNum} ---\n${pageText}`;
    }
  }

  return fullText.trim();
};

const parseGeminiJsonResponse = (responsePayload) => {
  if (!responsePayload?.response) return null;

  const response = responsePayload.response;
  const hasContent =
    response && Array.isArray(response.candidates) && response.candidates.length > 0;
  if (!hasContent) return null;

  const rawTextOutput = response.text().trim();
  const sanitizedText = rawTextOutput.replace(/```json|```/g, "").trim();

  try {
    return JSON.parse(sanitizedText);
  } catch {
    const jsonMatch = rawTextOutput.match(/{[\s\S]*"transactions"[\s\S]*}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  }

  return null;
};

const sanitizeAiTransactions = (transactions) => {
  if (!Array.isArray(transactions)) return [];

  const seen = new Set();
  const cleaned = [];

  for (const tx of transactions) {
    if (!tx) continue;

    const rawAmount = String(tx.amount ?? "").replace(/[^0-9.]/g, "");
    const amount = Number(rawAmount);
    if (!amount || isNaN(amount) || amount <= 0) continue;

    // Reject year/date-like false positives from AI output.
    if (Number.isInteger(amount) && amount >= 1900 && amount <= 2100) continue;
    if (amount <= 31 && !/\./.test(rawAmount) && !tx.description) continue;

    let description = String(tx.description || "Purchase").trim();
    if (!description) description = "Purchase";

    let category = ALLOWED_CATEGORIES.includes(tx.category)
      ? tx.category
      : autoCategorize(description);
    if (category === "Other") {
      const guess = autoCategorize(description);
      if (guess !== "Other") category = guess;
    }

    const dedupeKey = `${description.toLowerCase()}|${amount}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    cleaned.push({
      category,
      description,
      amount,
      itemCount: 1,
      transactionType: resolveTransactionType(description),
    });
  }

  return cleaned;
};

const analyzeVisualWithGemini = async (apiKey, imageBuffer, mimeType, prompt) => {
  const genAI = new GoogleGenerativeAI(apiKey);
  const availableModels = await listAvailableModels(apiKey);
  const visionModels = selectVisionModels(availableModels);
  const modelInput = [
    prompt,
    {
      inlineData: {
        data: imageBuffer,
        mimeType,
      },
    },
  ];

  let lastError = null;
  for (const modelName of visionModels) {
    try {
      const model = genAI.getGenerativeModel({
        model: normalizeModelName(modelName),
        generationConfig: { responseMimeType: "application/json" },
      });
      const responsePayload = await model.generateContent(modelInput);
      const parsed = parseGeminiJsonResponse(responsePayload);
      const transactions = sanitizeAiTransactions(parsed?.transactions);
      if (transactions.length > 0) {
        console.log(`🤖 Vision AI parsed ${transactions.length} transactions via ${modelName}.`);
        return { transactions, error: null };
      }
    } catch (err) {
      lastError = err;
      console.warn(`Vision model ${modelName} failed:`, err.message);
    }
  }

  return { transactions: [], error: lastError };
};

const analyzeTextWithGemini = async (apiKey, prompt, textContent) => {
  const genAI = new GoogleGenerativeAI(apiKey);
  const availableModels = await listAvailableModels(apiKey);
  const supportedModels = selectSupportedModels(availableModels);
  const modelInput = [prompt, `Document Contents:\n\n${textContent}`];

  let lastError = null;
  for (const modelName of supportedModels) {
    try {
      const model = genAI.getGenerativeModel({
        model: normalizeModelName(modelName),
        generationConfig: { responseMimeType: "application/json" },
      });
      const responsePayload = await model.generateContent(modelInput);
      const parsed = parseGeminiJsonResponse(responsePayload);
      const transactions = sanitizeAiTransactions(parsed?.transactions);
      if (transactions.length > 0) {
        return { transactions, error: null };
      }
    } catch (err) {
      lastError = err;
      console.warn(`Text model ${modelName} failed:`, err.message);
    }
  }

  return { transactions: [], error: lastError };
};

// Detect date/time tokens that OCR often misreads as amounts.
const isDateOrTimeToken = (token) => {
  const t = token.replace(/,/g, "").trim();
  if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(t)) return true;
  if (/^\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}$/.test(t)) return true;
  if (/^\d{1,2}[\/\-\.]\d{1,2}$/.test(t)) return true;
  if (/^(19|20)\d{2}$/.test(t)) return true;
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(t)) return true;
  // Time fragments (05 from 05:35 PM, 07 from 07:54)
  if (/^(0?[0-9]|1[0-9]|2[0-3])$/.test(t) && Number(t) <= 59) return true;
  return false;
};

const isLikelyExpenseAmount = (token, line) => {
  if (isDateOrTimeToken(token)) return false;

  const normalized = token.replace(/,/g, "");
  const amount = Number(normalized);
  if (!amount || isNaN(amount) || amount <= 0) return false;

  const hasDecimals = /\.\d{1,2}$/.test(normalized);
  const hasCurrency = /[₹$]|(?:\brs\.?\b)|(?:\binr\b)/i.test(line);

  // Time components from "05:35 PM", "07:54 PM", etc.
  if (/\d{1,2}\s*:\s*\d{2}/.test(line)) {
    const timeMatch = line.match(/(\d{1,2})\s*:\s*(\d{2})/);
    if (timeMatch && (Number(timeMatch[1]) === amount || Number(timeMatch[2]) === amount)) {
      return false;
    }
  }

  // "From 4" footer noise on Paytm sent-lines
  if (/\bfrom\s+\d\s*$/i.test(line) && amount <= 9) return false;

  // Years (2024, 2025, 2026) are almost never expense amounts.
  if (Number.isInteger(amount) && amount >= 1900 && amount <= 2100 && !hasDecimals) {
    return false;
  }

  // On date-heavy lines, small integers are usually day/month/qty — not amounts.
  if (!hasDecimals && amount <= 31 && /\d{1,2}[\/\-\.]\d{1,2}/.test(line)) {
    return false;
  }

  // Prefer realistic expense values: currency marker, decimals, or >= ₹10.
  if (hasCurrency || hasDecimals || amount >= 10) return true;

  // Tiny whole numbers without context are usually OCR noise.
  return false;
};

const scoreAmountCandidate = (token, amount, index, lineLength, line) => {
  let score = 0;
  const normalized = token.replace(/,/g, "");

  if (/\.\d{2}$/.test(normalized)) score += 12;
  if (/[₹$]|(?:\brs\.?\b)|(?:\binr\b)/i.test(line)) score += 8;
  if (amount >= 10 && amount <= 500000) score += 6;
  if (index >= lineLength * 0.45) score += 4; // amounts usually appear on the right
  if (amount < 5) score -= 8;

  return score;
};

const extractAmountFromLine = (line) => {
  const currencyMatch = line.match(
    /(?:₹|rs\.?|inr|\$)\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d+(?:\.\d{2})?)/i,
  );
  if (currencyMatch) {
    const token = currencyMatch[1];
    const amount = Number(token.replace(/,/g, ""));
    if (isLikelyExpenseAmount(token, line)) {
      return { amountToken: currencyMatch[0], amount };
    }
  }

  const matches = [...line.matchAll(/\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d+(?:\.\d{2})?/g)];
  const candidates = [];

  for (const match of matches) {
    const token = match[0];
    if (!isLikelyExpenseAmount(token, line)) continue;

    const amount = Number(token.replace(/,/g, ""));
    candidates.push({
      token,
      amount,
      score: scoreAmountCandidate(token, amount, match.index ?? 0, line.length, line),
      index: match.index ?? 0,
    });
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.score - a.score || b.index - a.index);
  const best = candidates[0];
  return { amountToken: best.token, amount: best.amount };
};

const cleanLineDescription = (line, amountToken) => {
  let description = line
    .replace(amountToken, "")
    .replace(/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/g, " ")
    .replace(/\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}/g, " ")
    .replace(/\d{1,2}:\d{2}(:\d{2})?/g, " ")
    .replace(/[₹$,;|]+/g, " ")
    .replace(/\b(rs\.?|inr)\b/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  description = description.replace(/^[\d.\s\-]+|[\d.\s\-]+$/g, "").trim();
  return description || "Purchase";
};

// 📱 Paytm / PhonePe / GPay screenshot parser — handles multi-line UPI history rows.
const parseUpiAppScreenshotText = (text) => {
  const upiSignalCount = (text.match(/sent\s+(yesterday|on\b)|paid\s+on\b|money transfer/gi) || [])
    .length;
  const isUpiApp =
    /paytm|phonepe|gpay|google pay|upi lite|payment history|money transfer|balance\s*&\s*history/i.test(
      text,
    ) || upiSignalCount >= 2;

  if (!isUpiApp) return null;

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 1);

  const transactions = [];
  const seen = new Set();
  const usedLineIndexes = new Set();

  const parseUpiOcrAmount = (digits) => {
    const d = String(digits).replace(/\D/g, "");
    if (!d) return null;

    let amount = Number(d);
    // OCR often misreads ₹ as a leading digit: -₹45 → "-345", -₹50 → "-350"
    if (d.length === 3 && amount >= 100 && amount <= 999) {
      const lastTwo = Number(d.slice(-2));
      if (lastTwo >= 1 && lastTwo <= 500) amount = lastTwo;
    }

    return amount >= 1 && amount <= 500000 ? amount : null;
  };

  const mapUpiTagCategory = (tagLine) => {
    const t = (tagLine || "").toLowerCase();
    if (/grocer/i.test(t)) return "Groceries";
    if (/food|restaurant|cafe|dining/i.test(t)) return "Food & Drinks";
    if (/travel|fuel|metro|cab|uber|ola/i.test(t)) return "Travel & Transport";
    if (/shop|retail|mall|store/i.test(t)) return "Shopping";
    if (/bill|recharge|utility|electric|mobile/i.test(t)) return "Bills & Utilities";
    if (/movie|entertain|cinema/i.test(t)) return "Entertainment";
    return "Other";
  };

  const cleanPersonName = (raw) =>
    String(raw || "")
      .replace(/^[^A-Za-z]+/i, "")
      .replace(/^[a-z]{1,2}\s+(?=[A-Z])/i, "")
      .replace(/[@&£€$#%+]+/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();

  const isNoiseLine = (line) =>
    /^(balance|history|your accounts|payment history|canara|upi lite|ac no|deck|paytm|total spent)/i.test(
      line,
    ) ||
    /^from\s+[\d&@£]+$/i.test(line) ||
    /^june\s+\d{4}/i.test(line) ||
    /^[\d:]+\s*[%~]/.test(line);

  const extractNameAmountFromLine = (line) => {
    if (!line || isNoiseLine(line)) return null;

    const patterns = [
      /^(.+?)\s*-+\s*[^0-9A-Za-z]*(\d{2,4})\s*$/,
      /^(.+?)\s*[₹¥rs%]+\s*(\d{2,4})\s*$/i,
      /^(.+?)\s+(\d{2,3})\s*$/,
    ];

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (!match) continue;

      const name = cleanPersonName(match[1]);
      const amount = parseUpiOcrAmount(match[2]);
      if (name && name.length >= 2 && amount) {
        return { name, amount };
      }
    }

    return null;
  };

  const findCategoryNear = (anchorIndex) => {
    for (let j = anchorIndex + 1; j < Math.min(anchorIndex + 4, lines.length); j++) {
      if (/money transfer|groceries|food|shop|travel|bill|entertain/i.test(lines[j])) {
        return mapUpiTagCategory(lines[j]);
      }
    }
    for (let j = anchorIndex - 1; j >= Math.max(0, anchorIndex - 3); j--) {
      if (/money transfer|groceries|food|shop|travel|bill|entertain/i.test(lines[j])) {
        return mapUpiTagCategory(lines[j]);
      }
    }
    return "Other";
  };

  const pushTransaction = (name, amount, category, lineIndexes = [], sourceLine = "") => {
    if (!name || !amount) return;
    const dedupeKey = `${name.toLowerCase()}|${amount}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    lineIndexes.forEach((idx) => usedLineIndexes.add(idx));

    transactions.push({
      category,
      description: name,
      amount,
      itemCount: 1,
      transactionType: resolveTransactionType(name, sourceLine || category),
    });
  };

  // Strategy A — anchor on every Sent/Paid row (most reliable for Paytm UI).
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/^(sent|paid)\b/i.test(line)) continue;

    let name = null;
    let amount = null;
    const usedIndexes = [i];

    for (let j = i - 1; j >= Math.max(0, i - 4); j--) {
      const candidate = lines[j];
      if (isNoiseLine(candidate) || /^(sent|paid)\b/i.test(candidate)) continue;
      if (/money transfer|groceries/i.test(candidate)) continue;

      const extracted = extractNameAmountFromLine(candidate);
      if (extracted) {
        name = extracted.name;
        amount = extracted.amount;
        usedIndexes.push(j);

        // Merge previous line when it's a wrapped surname (no amount on that line).
        if (j - 1 >= 0) {
          const prev = lines[j - 1];
          if (
            !usedLineIndexes.has(j - 1) &&
            /^[A-Za-z]/.test(prev) &&
            !extractNameAmountFromLine(prev) &&
            !/^(sent|paid)\b/i.test(prev) &&
            !/money transfer|groceries/i.test(prev)
          ) {
            name = `${cleanPersonName(prev)} ${name}`.replace(/\s{2,}/g, " ").trim();
            usedIndexes.push(j - 1);
          }
        }
        break;
      }
    }

    if (name && amount) {
      pushTransaction(name, amount, findCategoryNear(i), usedIndexes, line);
    }
  }

  // Strategy A2 — Received / Credited / Refund rows (money in).
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/^(received|credited|refund)/i.test(line) && !isReceivedTransaction(line)) continue;
    if (usedLineIndexes.has(i)) continue;

    let name = null;
    let amount = null;
    const usedIndexes = [i];

    const inline = extractNameAmountFromLine(line);
    if (inline) {
      name = inline.name || line;
      amount = inline.amount;
    } else {
      for (let j = i + 1; j <= Math.min(lines.length - 1, i + 3); j++) {
        const extracted = extractNameAmountFromLine(lines[j]);
        if (extracted?.amount) {
          name = extracted.name || line;
          amount = extracted.amount;
          usedIndexes.push(j);
          break;
        }
      }
      if (!amount) {
        const extracted = extractAmountFromLine(line);
        if (extracted) {
          name = cleanLineDescription(line, extracted.amountToken) || line;
          amount = extracted.amount;
        }
      }
    }

    if (name && amount) {
      pushTransaction(name, amount, "Other", usedIndexes, line);
    }
  }

  // Strategy B — direct inline "Name -345" rows (backup when Sent/Paid OCR is missing).
  for (let i = 0; i < lines.length; i++) {
    if (usedLineIndexes.has(i) || isNoiseLine(lines[i]) || /^(sent|paid)\b/i.test(lines[i])) {
      continue;
    }

    const extracted = extractNameAmountFromLine(lines[i]);
    if (!extracted) continue;

    let name = extracted.name;
    if (i + 1 < lines.length) {
      const next = lines[i + 1];
      if (
        !usedLineIndexes.has(i + 1) &&
        !/^(sent|paid)\b/i.test(next) &&
        !/money transfer|groceries/i.test(next) &&
        !extractNameAmountFromLine(next) &&
        /^[A-Za-z]/.test(next) &&
        next.split(/\s+/).length <= 6
      ) {
        name = `${name} ${cleanPersonName(next)}`.replace(/\s{2,}/g, " ").trim();
      }
    }

    pushTransaction(name, extracted.amount, findCategoryNear(i), [i], lines[i]);
  }

  // Strategy C — anchor on category tags (Money Transfer / Groceries) and look upward.
  for (let i = 0; i < lines.length; i++) {
    if (!/money transfer|groceries/i.test(lines[i])) continue;

    const category = mapUpiTagCategory(lines[i]);
    let name = null;
    let amount = null;

    for (let j = i - 1; j >= Math.max(0, i - 6); j--) {
      if (usedLineIndexes.has(j) || isNoiseLine(lines[j])) continue;
      if (/money transfer|groceries/i.test(lines[j])) continue;

      const extracted = extractNameAmountFromLine(lines[j]);
      if (extracted) {
        name = extracted.name;
        amount = extracted.amount;

        if (j - 1 >= 0) {
          const prev = lines[j - 1];
          if (
            !usedLineIndexes.has(j - 1) &&
            /^[A-Za-z]/.test(prev) &&
            !extractNameAmountFromLine(prev) &&
            !/^(sent|paid)\b/i.test(prev) &&
            !/money transfer|groceries/i.test(prev)
          ) {
            name = `${cleanPersonName(prev)} ${name}`.replace(/\s{2,}/g, " ").trim();
          }
        }
        break;
      }

      // Last resort: plain name line + separate amount token somewhere nearby.
      if (/^[A-Za-z]/.test(lines[j]) && !/^(sent|paid)\b/i.test(lines[j])) {
        const digitMatch = lines[j].match(/(\d{2,4})\s*$/);
        if (digitMatch) {
          name = cleanPersonName(lines[j].replace(/\d{2,4}\s*$/, ""));
          amount = parseUpiOcrAmount(digitMatch[1]);
          if (name && amount) break;
        }
      }
    }

    if (name && amount) {
      pushTransaction(name, amount, category, [i], lines[i]);
    }
  }

  return transactions.length > 0 ? transactions : null;
};

// 🧮 LOCAL FALLBACK — scan extracted text line-by-line and build transactions.
// Used when Gemini is unavailable / rate-limited / returns nothing usable, so
// docx, txt, xlsx, xls, and csv uploads keep working with proper categorization
// even without the AI step.
const parseTransactionsFromRawText = (text) => {
  const upiTransactions = parseUpiAppScreenshotText(text);
  if (upiTransactions?.length) {
    console.log(`📱 UPI app screenshot parser extracted ${upiTransactions.length} transactions.`);
    return upiTransactions;
  }

  const lines = text.split(/\r?\n/);
  const transactions = [];
  const seen = new Set();

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || /^---\s*Sheet:/i.test(line)) continue;

    // Skip lines that are only a date/time.
    if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(line)) continue;
    if (/^\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}$/.test(line)) continue;
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(line)) continue;

    const extracted = extractAmountFromLine(line);
    if (!extracted) continue;

    const { amountToken, amount } = extracted;
    let description = cleanLineDescription(line, amountToken);

    const lowerDesc = description.toLowerCase();
    const isReceivedLine = isReceivedTransaction(description, line);
    if (
      !isReceivedLine &&
      (/^(total|subtotal|tax|balance|amount|date|description|item|qty|quantity|payment|paid)$/i.test(
        lowerDesc,
      ) ||
      /subtotal|grand total|total expense|total income|total spent|page \d|statement period|opening balance|invoice no|bill no|gstin|thank you|sent yesterday|sent on|paid on|money transfer|from \d|payment history|your accounts|upi lite|canara bank/i.test(
        lowerDesc,
      ) ||
      /^(sent|paid|from|june|paytm)/i.test(lowerDesc))
    ) {
      continue;
    }

    const dedupeKey = `${description.toLowerCase()}|${amount}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    transactions.push({
      category: autoCategorize(description),
      description,
      amount,
      itemCount: 1,
      transactionType: resolveTransactionType(description, line),
    });
  }

  return transactions;
};

// 📂 Extract readable text from a non-image/non-pdf document buffer.
// Returns { text, isDocumentFile }. Spreadsheets, docx, txt/rtf are all
// converted to plain text here; images/PDFs fall through untouched and
// get sent to Gemini as binary (inlineData) instead.
const extractDocumentText = async (finalBuffer, mimeType, fileName) => {
  const lowerFileName = String(fileName || "").toLowerCase();
  const isXls = /\.xls$/i.test(lowerFileName);
  const isXlsx = /\.xlsx$/i.test(lowerFileName);
  const isCsv = /\.csv$/i.test(lowerFileName);
  const isSpreadsheet =
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    mimeType.includes("csv") ||
    isXlsx ||
    isXls ||
    isCsv;

  const isDocx =
    mimeType.includes("officedocument.wordprocessingml") || /\.docx$/i.test(fileName);
  const isDoc = /\.doc$/i.test(fileName) && !isDocx;
  const isRtf = /\.rtf$/i.test(fileName) || mimeType.includes("rtf");
  const isTxt = /\.txt$/i.test(fileName) || mimeType.includes("text/plain");

  if (isSpreadsheet) {
    const isCsvFile = mimeType.includes("csv") || isCsv;

    // STRATEGY A — real, modern OOXML .xlsx (and many files saved with a
    // .xls extension that are actually xlsx under the hood — common from
    // newer Excel/Sheets exports). Skip this for genuine .csv files since
    // xlsx.load() always throws on plain delimited text and just wastes time.
    if (!isCsvFile) {
      try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(finalBuffer);
        let text = "";
        workbook.eachSheet((worksheet) => {
          text += `\n--- Sheet: ${worksheet.name} ---\n`;
          worksheet.eachRow((row) => {
            const rowValues = Array.isArray(row.values)
              ? row.values.slice(1).map((v) => (v && typeof v === "object" ? v.result ?? v.text ?? JSON.stringify(v) : v))
              : [];
            text += rowValues.join(", ") + "\n";
          });
        });
        if (text.trim()) {
          console.log("📊 ExcelJS: Parsed as native XLSX workbook.");
          return { text, isDocumentFile: true };
        }
      } catch (xlsxErr) {
        console.warn("ExcelJS xlsx.load failed, trying CSV reader:", xlsxErr.message);
      }
    }

    // STRATEGY B — true CSV / tab-delimited text, via ExcelJS's own csv
    // reader (it needs a stream, so we wrap the buffer in a Readable).
    try {
      const workbook = new ExcelJS.Workbook();
      const csvStream = Readable.from(finalBuffer.toString("utf-8"));
      const worksheet = await workbook.csv.read(csvStream);
      let text = `\n--- Sheet: ${worksheet.name || "CSV"} ---\n`;
      worksheet.eachRow((row) => {
        const rowValues = Array.isArray(row.values) ? row.values.slice(1) : [];
        text += rowValues.join(", ") + "\n";
      });
      if (text.trim().length > 15) {
        console.log("📊 ExcelJS: Parsed as CSV stream.");
        return { text, isDocumentFile: true };
      }
    } catch (csvErr) {
      console.warn("ExcelJS csv.read failed, trying HTML/raw-text fallback:", csvErr.message);
    }

    // STRATEGY C — many bank/web-app "xls" exports are actually HTML tables
    // wearing an .xls extension. Strip markup so the rows read as plain text.
    const rawString = finalBuffer.toString("utf-8");
    if (/<table/i.test(rawString) || /<html/i.test(rawString)) {
      const text = rawString
        .replace(/<\/(tr|p|div|br)>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/[ \t]{2,}/g, " ");
      console.log("📊 Detected HTML-formatted spreadsheet export, stripped markup.");
      return { text, isDocumentFile: true };
    }

    // STRATEGY D — last resort, raw decode. Note: genuine legacy binary
    // .xls (Excel 97-2003 BIFF format) cannot be reliably read this way —
    // ExcelJS doesn't support that format at all, so this will only recover
    // something usable if the file is actually CSV/HTML/plain text in
    // disguise, not a true binary .xls.
    const text = rawString.replace(/[^\x20-\x7E\n\r\t]/g, " ");
    if (text.trim().length > 15) {
      return { text, isDocumentFile: true };
    }

    // STRATEGY E — parse with SheetJS to support true legacy .xls and edge files.
    try {
      const workbook = XLSX.read(finalBuffer, {
        type: "buffer",
        cellText: true,
        cellDates: true,
        raw: false,
      });

      let sheetText = "";
      for (const sheetName of workbook.SheetNames || []) {
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });
        sheetText += `\n--- Sheet: ${sheetName} ---\n`;
        for (const row of rows) {
          if (!Array.isArray(row)) continue;
          sheetText += row.map((cell) => (cell == null ? "" : String(cell))).join(", ") + "\n";
        }
      }

      if (sheetText.trim().length > 15) {
        console.log("📊 Parsed spreadsheet with SheetJS fallback.");
        return { text: sheetText, isDocumentFile: true };
      }
    } catch (sheetErr) {
      console.warn("SheetJS fallback parse failed:", sheetErr.message);
    }

    return { text: "", isDocumentFile: true };
  }

  if (isDocx || isDoc) {
    if (isDocx) {
      try {
        const result = await mammoth.extractRawText({ buffer: finalBuffer });
        console.log("📝 Mammoth: Extracted text from Word (.docx).");
        return { text: result.value, isDocumentFile: true, fileKind: "word" };
      } catch (err) {
        console.warn("Mammoth .docx extraction failed:", err.message);
      }
    }

    const text = finalBuffer
      .toString(isDocx ? "utf-8" : "latin1")
      .replace(/[^\x20-\x7E\n\r\t]/g, " ");
    console.log(`📝 Extracted text from Word (${isDocx ? ".docx" : ".doc"}) fallback.`);
    return { text, isDocumentFile: true, fileKind: "word" };
  }

  if (isRtf) {
    const text = cleanRTFToText(finalBuffer.toString("utf-8"));
    console.log("📄 RTF document cleaned to plain text.");
    return { text, isDocumentFile: true, fileKind: "rtf" };
  }

  if (isTxt) {
    const text = finalBuffer.toString("utf-8");
    console.log("📄 Plain text file loaded.");
    return { text, isDocumentFile: true, fileKind: "text" };
  }

  const isPdf = mimeType.includes("pdf") || /\.pdf$/i.test(lowerFileName);
  if (isPdf) {
    try {
      const pdfText = await extractPdfText(finalBuffer);
      if (pdfText) {
        console.log("📄 PDF text extracted via pdf-parse.");
        return { text: pdfText, isDocumentFile: true, fileKind: "pdf" };
      }
    } catch (err) {
      console.warn("pdf-parse failed:", err.message);
    }
    return { text: "", isDocumentFile: false, fileKind: "pdf", isScannedPdf: true };
  }

  // Images — OCR / vision path in scanReceiptAndProcess.
  return { text: "", isDocumentFile: false, fileKind: "image" };
};

// 1. ➕ ADD MANUAL EXPENSE
export const addExpense = async (req, res) => {
  try {
    const userId = req.user?._id || req.body.userId;
    if (!userId) return res.status(400).json({ msg: "User identification missing!" });

    const expenseData = { ...req.body, userId: userId, amount: Number(req.body.amount) };
    const expense = await Expense.create(expenseData);
    res.status(201).json(expense);
  } catch (err) {
    res.status(500).json({ msg: "Server error saving expense.", error: err.message });
  }
};

// 2. 🔍 GET EXPENSES
export const getExpenses = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ msg: "User ID parameter required." });
    const expenses = await Expense.find({ userId }).sort({ date: -1 });
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ msg: "Database query error.", error: err.message });
  }
};

// 2b. 🗑️ DELETE ALL EXPENSE LOGS (keeps received/credit entries)
export const deleteAllExpenses = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, msg: "Session validation expired or User ID missing." });
    }

    const result = await Expense.deleteMany({
      userId,
      $or: [{ transactionType: "expense" }, { transactionType: { $exists: false } }],
    });

    return res.status(200).json({
      success: true,
      msg: `Deleted ${result.deletedCount} expense log(s).`,
      deletedCount: result.deletedCount,
    });
  } catch (err) {
    res.status(500).json({ success: false, msg: "Failed to delete expense logs.", error: err.message });
  }
};

// 3. 📸 AI SCAN RECEIPT & PROCESS
export const scanReceiptAndProcess = async (req, res) => {
  try {
    const safeBody = req.body || {};
    let imageBuffer = safeBody.imageBuffer || null;
    let mimeType = safeBody.mimeType || null;
    const userId = req.user?._id || safeBody.userId;

    let finalBuffer;
    if (req.file) {
      finalBuffer = req.file.buffer;
      mimeType = req.file.mimetype;
      imageBuffer = req.file.buffer.toString("base64");
    } else if (imageBuffer) {
      finalBuffer = Buffer.from(imageBuffer, "base64");
    }

    if (!finalBuffer || !mimeType) {
      return res.status(400).json({ msg: "Document stream content data is completely empty!" });
    }

    if (!userId) {
      return res.status(401).json({ msg: "Session validation expired or User ID missing." });
    }

    const fileName = req.file?.originalname || safeBody.scannedDocumentName || "";
    const fileMeta = resolveUploadFile(mimeType, fileName);

    if (!fileMeta.supported) {
      return res.status(400).json({
        msg: `Unsupported file type${fileMeta.ext ? ` (.${fileMeta.ext})` : ""}. Allowed: ${SUPPORTED_EXTENSIONS.join(", ")}`,
      });
    }

    mimeType = fileMeta.mimeType;
    const activeApiKey = getGeminiKey();

    console.log(`📂 Universal scan started: ${fileName} [${fileMeta.fileKind}]`);

    const { text: extractedTextContent, isDocumentFile } = await extractDocumentText(
      finalBuffer,
      mimeType,
      fileName,
    );

    const isImageFile = fileMeta.fileKind === "image";
    const isPdfFile = fileMeta.fileKind === "pdf";

    if (isDocumentFile && !extractedTextContent.trim()) {
      return res.status(400).json({
        msg: "Could not read any text from this file. It may be empty, corrupted, or password-protected.",
      });
    }

    // Cap text size sent to the model to avoid token-limit related failures on large files
    const MAX_CHARS = 60000;
    const trimmedTextContent =
      extractedTextContent.length > MAX_CHARS
        ? extractedTextContent.slice(0, MAX_CHARS) + "\n...[truncated]"
        : extractedTextContent;

    let extractedPayload = null;
    let lastError = null;
    let usedLocalOcr = false;

    // 📸 Images: AI vision first (line-by-line smart analysis).
    if (isImageFile && activeApiKey) {
      console.log("🤖 AI vision analyzing image line-by-line...");
      const visionResult = await analyzeVisualWithGemini(
        activeApiKey,
        imageBuffer,
        mimeType,
        IMAGE_SCAN_PROMPT,
      );
      if (visionResult.transactions.length > 0) {
        extractedPayload = { transactions: visionResult.transactions };
      } else {
        lastError = visionResult.error;
      }
    }

    // 📄 Text documents: local parser first, AI text analysis second.
    if (!extractedPayload && isDocumentFile && trimmedTextContent.trim()) {
      const localTransactions = parseTransactionsFromRawText(trimmedTextContent);
      if (localTransactions.length > 0) {
        console.log("🧮 Parsed document with local line-scan engine.");
        extractedPayload = { transactions: localTransactions };
      } else if (activeApiKey) {
        const textAiResult = await analyzeTextWithGemini(
          activeApiKey,
          DOCUMENT_SCAN_PROMPT,
          trimmedTextContent,
        );
        if (textAiResult.transactions.length > 0) {
          extractedPayload = { transactions: textAiResult.transactions };
        } else {
          lastError = textAiResult.error;
        }
      }
    }

    // 📄 Scanned PDFs (no extractable text): AI vision OCR.
    if (!extractedPayload && isPdfFile && !isDocumentFile && activeApiKey) {
      console.log("🤖 AI vision analyzing scanned PDF...");
      const pdfVisionResult = await analyzeVisualWithGemini(
        activeApiKey,
        imageBuffer,
        mimeType,
        IMAGE_SCAN_PROMPT,
      );
      if (pdfVisionResult.transactions.length > 0) {
        extractedPayload = { transactions: pdfVisionResult.transactions };
      } else {
        lastError = pdfVisionResult.error;
      }
    }

    if (!activeApiKey && !isDocumentFile && !isImageFile && !isPdfFile) {
      return res.status(500).json({
        msg: "Scanned PDF requires Gemini OCR, but API key is missing/invalid.",
      });
    }

    // Document fallback after AI failure.
    if (
      (!extractedPayload || !Array.isArray(extractedPayload.transactions) || extractedPayload.transactions.length === 0) &&
      isDocumentFile
    ) {
      const localTransactions = parseTransactionsFromRawText(trimmedTextContent);
      if (localTransactions.length > 0) {
        console.log("🧮 Falling back to local line-scan categorization engine.");
        extractedPayload = { transactions: localTransactions };
      }
    }

    // Scanned PDF local OCR fallback (no Gemini quota needed).
    if (
      (!extractedPayload || !Array.isArray(extractedPayload.transactions) || extractedPayload.transactions.length === 0) &&
      isPdfFile &&
      !isDocumentFile
    ) {
      try {
        console.log("📄 Running local OCR on scanned PDF pages...");
        const pdfOcrText = await ocrScannedPdf(finalBuffer);
        const pdfOcrTransactions = parseTransactionsFromRawText(pdfOcrText);
        if (pdfOcrTransactions.length > 0) {
          extractedPayload = { transactions: pdfOcrTransactions };
          usedLocalOcr = true;
          console.log(`📄 Scanned PDF OCR extracted ${pdfOcrTransactions.length} transactions.`);
        }
      } catch (pdfOcrErr) {
        console.warn("Scanned PDF OCR fallback failed:", pdfOcrErr.message);
        lastError = pdfOcrErr;
      }
    }

    // Image OCR fallback only when AI vision is unavailable or failed.
    if (
      (!extractedPayload || !Array.isArray(extractedPayload.transactions) || extractedPayload.transactions.length === 0) &&
      isImageFile
    ) {
      try {
        console.log("📷 Running local OCR fallback on image...");
        const ocrText = await runImageOcr(finalBuffer);
        const ocrTransactions = parseTransactionsFromRawText(ocrText);
        if (ocrTransactions.length > 0) {
          extractedPayload = { transactions: ocrTransactions };
          usedLocalOcr = true;
          console.log(`📷 Local OCR extracted ${ocrTransactions.length} transactions.`);
        }
      } catch (ocrErr) {
        console.warn("Image OCR fallback failed:", ocrErr.message);
        lastError = ocrErr;
      }
    }

    if (!extractedPayload || !Array.isArray(extractedPayload.transactions) || extractedPayload.transactions.length === 0) {
      const isQuotaError = /429|quota|too many requests/i.test(lastError?.message || "");
      let failureMsg = "Could not extract any transactions from this file.";
      if (isImageFile) {
        failureMsg = isQuotaError
          ? "Gemini AI daily quota is exceeded and local OCR could not read this image. Try a clearer receipt photo or wait for quota reset."
          : "Could not read expense lines from this image. Use a clear, well-lit photo where item names and amounts are visible.";
      } else if (isPdfFile && !isDocumentFile) {
        failureMsg = isQuotaError
          ? "Gemini AI quota is exceeded and local PDF OCR could not extract transactions. Try a clearer PDF or text-based export."
          : "Could not extract transactions from this PDF. Ensure amounts and descriptions are readable.";
      }

      return res.status(500).json({
        msg: failureMsg,
        error: lastError?.message || "No usable content was returned.",
      });
    }

    // 💾 DB PLACEMENT LOOPS
    const savedExpenses = [];
    const savedReceived = [];
    for (const transaction of extractedPayload.transactions) {
      try {
        let rawAmount = String(transaction.amount).replace(/[^0-9.]/g, "");
        const finalAmount = Number(rawAmount);
        if (!finalAmount || isNaN(finalAmount)) continue;

        const allowedCategories = ALLOWED_CATEGORIES;
        let cat = allowedCategories.includes(transaction.category) ? transaction.category : autoCategorize(transaction.description);

        // If the model shrugged and said "Other", give the regex engine a second opinion
        if (cat === "Other") {
          const guess = autoCategorize(transaction.description);
          if (guess !== "Other") cat = guess;
        }

        const txType =
          transaction.transactionType || resolveTransactionType(transaction.description);

        const automatedExpense = new Expense({
          userId,
          description: transaction.description || `${cat} Transaction`,
          amount: finalAmount,
          category: cat,
          date: new Date(),
          transactionType: txType,
        });

        const saved = await automatedExpense.save();
        if (txType === "received") {
          savedReceived.push(saved);
        } else {
          savedExpenses.push(saved);
          if (typeof checkBudgetThresholds === "function") {
            await checkBudgetThresholds(userId, saved.category, saved.amount).catch(() => {});
          }
        }
      } catch (dbErr) {
        console.error("DB Save Item Failure:", dbErr.message);
      }
    }

    const allSaved = [...savedExpenses, ...savedReceived];
    if (allSaved.length === 0) {
      return res.status(400).json({ msg: "No valid expense parameters could be parsed from this document asset." });
    }

    // 📊 RECALCULATE MONTHLY PROGRESS BUDGET METRICS (expenses only)
    const monthlyBudgetCap = 10000;
    const objectId = new mongoose.Types.ObjectId(userId);
    const rawAggregatedSums = await Expense.aggregate([
      {
        $match: {
          userId: objectId,
          $or: [{ transactionType: "expense" }, { transactionType: { $exists: false } }],
        },
      },
      { $group: { _id: null, totalSpent: { $sum: "$amount" } } },
    ]);

    const finalAccumulatedTotal = rawAggregatedSums[0]?.totalSpent || 0;
    const consumptionRatioPercent = (finalAccumulatedTotal / monthlyBudgetCap) * 100;

    let systemAlertNotification = null;
    if (consumptionRatioPercent >= 100) {
      systemAlertNotification = `🛑 Alert! Your budget limit is 100% used (Spent: ₹${finalAccumulatedTotal}). Stop spending!`;
    } else if (consumptionRatioPercent >= 80) {
      systemAlertNotification = `⚠️ Warning! You have consumed 80% of your budget allowance threshold.`;
    }

    return res.status(200).json({
      msg: successMessageForScan(fileMeta.fileKind, usedLocalOcr),
      data: allSaved,
      summary: {
        fileKind: fileMeta.fileKind,
        fileName,
        transactionsScanned: allSaved.length,
        expensesCount: savedExpenses.length,
        receivedCount: savedReceived.length,
        totalAmount: savedExpenses.reduce((sum, exp) => sum + exp.amount, 0),
        receivedAmount: savedReceived.reduce((sum, exp) => sum + exp.amount, 0),
        categories: [...new Set(savedExpenses.map((exp) => exp.category))],
      },
      alert: systemAlertNotification,
    });

  } catch (error) {
    console.error("Pipeline Engine Critical Crash:", error);
    return res.status(500).json({ msg: "Internal application handler scanning failure.", error: error.message });
  }
};