import axios from "axios";
import { GoogleGenerativeAI } from "@google/generative-ai";
import mongoose from "mongoose";
import ExcelJS from "exceljs"; // ≡ƒôè Native Spreadsheet Decoder Engine
import XLSX from "xlsx";
import { Readable } from "stream"; // feeds CSV buffers into ExcelJS's csv reader
import mammoth from "mammoth"; // ≡ƒô¥ Native Word Document (.docx) Decoder Engine
import Tesseract from "tesseract.js";
import sharp from "sharp";
import { PDFParse } from "pdf-parse";
import { pdf as pdfToImages } from "pdf-to-img";
import Expense from "../models/Expense.js";
import Budget from "../models/Budget.js";
import { checkBudgetThresholds } from "../utils/budgetAlertEngine.js";
import { SCAN_CATEGORIES, categorizeByMerchantRules } from "../constants/categories.js";
import {
  isFailedTransactionLine,
  isFailedTransactionBlock,
  isLikelyReferenceNumber,
  INCOME_KEYWORDS,
} from "../utils/transactionValidation.js";
import { buildFinancialSummary, generateLocalInsights } from "../utils/financialInsights.js";
import { categorizeByMerchant } from "../utils/merchantCategoryEngine.js";

// SECURE KEY RESOLUTION LAYER
const getGeminiKey = () => {
  if (
    process.env.GEMINI_API_KEY &&
    !process.env.GEMINI_API_KEY.includes("YourActual")
  ) {
    return process.env.GEMINI_API_KEY;
  }

  console.error(
    " Gemini API Key missing or placeholder. Set a valid GEMINI_API_KEY in .env.",
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

const RECEIVED_KEYWORDS = INCOME_KEYWORDS;

const SENT_KEYWORDS =
  /\b(sent\s+to|sent\s+on|sent\s+yesterday|sent\s+today|paid\s+to|paid\s+on|paid\s+yesterday|paid\s+today|debited\s+from|debited\s+on|money\s+sent\s+to|payment\s+to)\b/i;

const isSentAnchorLine = (line) => {
  const t = String(line || "").trim();
  if (isCompactPaytmStatusLine(t)) return false;
  return /^(money\s+sent\s+to|debited|payment\s+to)\b/i.test(t);
};

const isReceivedAnchorLine = (line) => {
  const t = String(line || "").trim();
  if (isCompactPaytmStatusLine(t)) return false;
  return /^(money\s+received|received\s+from|credited|refund)\b/i.test(t);
};

const isPaytmPlusAmountLine = (line) => /^\+\s*(?:[₹¥]|rs\.?|inr)?\s*\d/i.test(String(line || "").trim());
const isPaytmMinusAmountLine = (line) => /^-\s*(?:[₹¥]|rs\.?|inr)?\s*\d/i.test(String(line || "").trim());

const isCompactPaytmStatusLine = (line) =>
  /^(sent|paid|received)\s+(on|yesterday|today)\b/i.test(String(line || "").trim()) ||
  /^(sent|paid|received)\s+\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(
    String(line || "").trim(),
  );

const isReceivedAmountContext = (line, nearbyLines = []) => {
  const text = `${line || ""} ${nearbyLines.join(" ")}`.toLowerCase();
  if (isPaytmPlusAmountLine(line)) return true;
  if (isReceivedAnchorLine(line) || RECEIVED_KEYWORDS.test(text)) return true;
  if (/money\s+received/i.test(text)) return true;
  if (/\bcredited\s+to\b/i.test(text)) return true;
  return false;
};

const isUpiAnchorLine = (line) => isSentAnchorLine(line) || isReceivedAnchorLine(line);

const isReceivedTransaction = (description, lineText = "") => {
  const text = `${description || ""} ${lineText || ""}`.toLowerCase();
  if (SENT_KEYWORDS.test(text) || isSentAnchorLine(lineText)) return false;
  if (RECEIVED_KEYWORDS.test(text) || isReceivedAnchorLine(lineText)) return true;
  if (/\+\s*[₹rs.]?\s*[\d,]+/i.test(lineText)) return true;
  return false;
};

const resolveTransactionType = (description, lineText = "", forcedType = null) => {
  if (forcedType === "received" || forcedType === "expense") return forcedType;
  return isReceivedTransaction(description, lineText) ? "received" : "expense";
};

const isJunkDescription = (description) => {
  const desc = String(description || "").trim();
  if (!desc) return true;

  const alpha = desc.replace(/[^a-zA-Z]/g, "");
  if (alpha.length < 3) return true;

  if (
    /^(on|at|to|from|the|in|of|paid|sent|received|yesterday|today|failed|pending|success|money|transfer|payment|purchase|transaction|item|expense|unknown|misc|general|n\/a|null|undefined|untitled)$/i.test(
      desc,
    )
  ) {
    return true;
  }

  if (/^(sent|paid|received|credited|refund|debit|credit)$/i.test(desc)) return true;
  if (/^(paid|received|sent)\s+(on|yesterday|today)\b/i.test(desc)) return true;
  if (/^\d+([.,]\d+)?$/.test(desc)) return true;
  if (/^(gstin|invoice|bill no|page \d|total|subtotal|balance)/i.test(desc)) return true;
  if (/^(am|pm|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)$/i.test(desc)) return true;

  return false;
};

const isValidTransactionName = (name) => !isJunkDescription(name);

// DYNAMIC CATEGORIZATION ENGINE UTILITY HELPER
// ✅ NOW USES COMPREHENSIVE MERCHANT DATABASE
const autoCategorize = (description) => {
  const desc = (description || "").toLowerCase().trim();
  if (!desc) return "Other";

  // ✅ TRY MERCHANT DATABASE FIRST (higher accuracy)
  const merchantCategory = categorizeByMerchant(description);
  if (merchantCategory !== "Other") {
    return merchantCategory;
  }

  // ✅ FALLBACK TO LEGACY PATTERNS (for edge cases)
  // Healthcare before travel — "healthcare" falsely matches /\bcar\b/ if boundaries are loose.
  if (
    /\b(healthcare|health\s*care|hospital|clinic|pharmacy|chemist|medical|medicine|doctor|dr\.|dental|diagnostic|pathology|apollo|fortis|medplus|pharmeasy|netmeds|1mg|practo|thyrocare)\b/i.test(
      desc,
    )
  ) {
    return "Healthcare";
  }

  if (/\binterest expense\b/i.test(desc) || /\binterest\b/i.test(desc)) return "Other";
  if (/\b(groceries|grocery)\b/i.test(desc) || /smith(?:'s|s)/i.test(desc)) return "Groceries";

  if (/\b(beginning balance|account balance|opening balance)\b/i.test(desc)) {
    return "Bills & Utilities";
  }
  if (/\bbalance\b/i.test(desc) && !/\b(received|credited|refund)\b/i.test(desc)) {
    return "Bills & Utilities";
  }

  if (
    /\b(zomato|swiggy|restaurant|cafe|mcdonald|starbucks|blinkit|zepto|instamart|dominos|kfc|biryani|burger|pizza|eatfit|dunzo)\b/i.test(
      desc,
    ) ||
    /\b(food|dining|dinner|lunch|breakfast|bakery|canteen|snack|meal|tea|coffee)\b/i.test(desc)
  ) {
    return "Food & Drinks";
  }

  if (
    /\b(uber|ola|rapido|irctc|flight|metro|petrol|fuel|diesel|train|cab|travel|transport|parking|toll|shell|makemytrip|redbus|fastag)\b/i.test(
      desc,
    )
  ) {
    return "Travel & Transport";
  }
  if (/\b(car|bike|garage|auto|bus)\b/i.test(desc)) return "Travel & Transport";

  if (
    /\b(amazon|flipkart|myntra|zara|walmart|target|shopping|clothing|electronics|shoes|apparel|retail|ajio|meesho)\b/i.test(
      desc,
    )
  ) {
    return "Shopping";
  }
  if (/\b(mall|market|mart|store)\b/i.test(desc) && !/\b(super\s*market|grocery)\b/i.test(desc)) {
    return "Shopping";
  }

  if (
    /\b(jio|airtel|electricity|water|gas|broadband|recharge|rent|netflix|spotify|prime|wifi|internet|mobile|vi\b|bsnl)\b/i.test(
      desc,
    ) ||
    /\b(bill|utilities|utility)\b/i.test(desc)
  ) {
    return "Bills & Utilities";
  }

  if (
    /\b(movie|pvr|inox|gaming|concert|theater|cinema|bookmyshow|game)\b/i.test(desc) ||
    /\b(pub|club|bar)\b/i.test(desc)
  ) {
    return "Entertainment";
  }

  if (/\b(insurance|lic|policy premium)\b/i.test(desc)) return "Insurance";

  if (/\b(school|college|university|tuition|course|udemy|coursera|education|byju)\b/i.test(desc)) {
    return "Education";
  }

  const merchantCat = categorizeByMerchantRules(desc);
  if (merchantCat !== "Other") return merchantCat;

  return "Other";
};

const normalizeModelName = (name) => String(name).replace(/^models\//, "");

const ALLOWED_CATEGORIES = [...SCAN_CATEGORIES, "Groceries", "Insurance", "Cash Withdrawal", "Transfer"];

const resolveCategory = (description, aiCategory = null) => {
  const autoCat = autoCategorize(description);
  if (autoCat !== "Other") return autoCat;
  if (aiCategory && ALLOWED_CATEGORIES.includes(aiCategory)) return aiCategory;
  return "Other";
};

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
    return `${label} processed with local OCR (AI quota unavailable). ≡ƒÄë`;
  }
  return `${label} scanned and categorized successfully! ≡ƒÄë`;
};

const DOCUMENT_SCAN_PROMPT = `Analyze this expense document and extract every individual purchase/transaction line.

Categories (use exactly one per line): ${ALLOWED_CATEGORIES.map((c) => `"${c}"`).join(", ")}

Rules:
- Read line by line; one row with a price = one transaction.
- Use only real money amounts (never dates, years, invoice numbers, qty, or phone numbers).
- Skip subtotal, tax, grand total, balance, and header/footer rows.
- transactionType = "received" for money IN (received, credited, refund, salary, cashback, income). Otherwise "expense".
- Hospital/clinic/pharmacy/doctor/lab => Healthcare (never Travel & Transport).
- amount must be a plain number (no currency symbols).

Return ONLY raw JSON:
{"transactions":[{"category":"Food & Drinks","description":"Zomato dinner","amount":250.5,"itemCount":1,"transactionType":"expense"}]}`;

const IMAGE_SCAN_PROMPT = `You are an expert Indian UPI app (PhonePe, Paytm, GPay) and receipt analyzer.

Study the image and extract ONLY successful money transactions.

For EACH successful transaction block:
1. description = person name or merchant name from that block
2. amount = successful payment amount (numeric only)
3. category = exactly one of: ${ALLOWED_CATEGORIES.map((c) => `"${c}"`).join(", ")}
4. transactionType:
   - "expense" when label says: Money sent to, Sent, Paid, Debited, Payment to
   - "received" when label says: Received from, Received, Credited, Refund, Money received

Critical UPI rules (must follow exactly):
- The LABEL above/below the name decides type — never guess from the person's name alone.
- "Money sent to Karnika Gupta" => expense. "Received from Karnika Gupta" => received.
- "Money sent to Aman Jha" => expense. "Received from Aman Jha" => received.
- SKIP entire blocks marked Failed, Pending, Declined, Rejected, Cancelled, Unsuccessful.
- NEVER extract amounts from failed transactions.
- NEVER use dates, times, years, phone numbers, or UPI IDs as amounts.
- Ignore UI chrome: Home, History, Offers, Scan, Balance, Spend Analytics.

Return ONLY valid JSON:
{"transactions":[{"category":"Other","description":"Karnika Gupta","amount":500,"itemCount":1,"transactionType":"received"}]}`;

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

  if (!text || text.trim().length < 10) {
    console.warn("OCR text too short after retries:", text);
    return "";
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

const isFormulaOrTotal = (desc) => {
  const text = String(desc || "").toLowerCase();
  return (
    /^=/.test(text) || // Excel formulas
    /\b(sum|total|subtotal|balance|grand\s+total|average|count|formula|computed)\b/i.test(text)
  );
};

const sanitizeAiTransactions = (transactions) => {
  if (!Array.isArray(transactions)) return [];

  const seen = new Set();
  const cleaned = [];
  const rejectionLog = [];

  // ✅ OCR DEBUGGING: Log raw extracted transactions
  console.log(`\n📊 OCR SANITIZATION REPORT`);
  console.log(`Total extracted transactions: ${transactions.length}`);

  for (const tx of transactions) {
    if (!tx) continue;

    const rawAmount = String(tx.amount ?? "").replace(/[^0-9.]/g, "");
    const amount = Number(rawAmount);
    
    // ✅ REJECTION: Invalid amount
    if (!amount || isNaN(amount) || amount <= 0) {
      rejectionLog.push({
        type: "INVALID_AMOUNT",
        reason: `Amount: ${rawAmount || "empty"}`,
        transaction: tx
      });
      continue;
    }

    // ✅ REJECTION: Year/date false positives
    if (Number.isInteger(amount) && amount >= 1900 && amount <= 2100) {
      rejectionLog.push({
        type: "YEAR_DETECTED",
        reason: `Likely year: ${amount}`,
        transaction: tx
      });
      continue;
    }

    // ✅ REJECTION: Small numbers without description
    if (amount <= 31 && !/\./.test(rawAmount) && !tx.description) {
      rejectionLog.push({
        type: "SMALL_NO_DESC",
        reason: `Amount ${amount} with no description`,
        transaction: tx
      });
      continue;
    }

    let description = String(tx.description || "Purchase").trim();
    if (!description) description = "Purchase";
    
    // ✅ REJECTION: Junk description
    if (isJunkDescription(description)) {
      rejectionLog.push({
        type: "JUNK_DESCRIPTION",
        reason: `Junk: "${description}"`,
        transaction: tx
      });
      continue;
    }
    
    // ✅ REJECTION: Failed transaction - CRITICAL
    if (isFailedTransactionLine(description)) {
      rejectionLog.push({
        type: "FAILED_TRANSACTION",
        reason: `Failed keyword found in: "${description}"`,
        transaction: tx
      });
      continue;
    }

    // ✅ REJECTION: Failed in combined fields
    if (/\bfailed\b/i.test(String(tx.description || "") + String(tx.category || ""))) {
      rejectionLog.push({
        type: "FAILED_IN_FIELDS",
        reason: `Failed keyword in description or category`,
        transaction: tx
      });
      continue;
    }

    // ✅ REJECTION: Formula or total
    if (isFormulaOrTotal(description) && !/\b(received|paid|sent|credited|debited|money|upi|transaction)\b/i.test(description)) {
      rejectionLog.push({
        type: "FORMULA_OR_TOTAL",
        reason: `Formula/total detected: "${description}"`,
        transaction: tx
      });
      continue;
    }

    const txType =
      tx.transactionType === "received" || tx.transactionType === "expense"
        ? tx.transactionType
        : resolveTransactionType(description);

    let category =
      txType === "received"
        ? "Other"
        : resolveCategory(description, tx.category);

    const dedupeKey = normalizeTransactionKey(description, amount, txType);
    
    // ✅ REJECTION: Duplicate
    if (seen.has(dedupeKey)) {
      rejectionLog.push({
        type: "DUPLICATE",
        reason: `Duplicate key: ${dedupeKey}`,
        transaction: tx
      });
      continue;
    }
    
    seen.add(dedupeKey);

    cleaned.push({
      category,
      description,
      amount,
      itemCount: 1,
      transactionType: txType,
    });

    // ✅ LOG: Accepted transaction
    console.log(`✅ ACCEPTED: ${txType.toUpperCase()} | ${category} | ${description} | ₹${amount}`);
  }

  // ✅ OCR DEBUGGING: Log rejected transactions
  if (rejectionLog.length > 0) {
    console.log(`\n❌ REJECTED TRANSACTIONS (${rejectionLog.length}):`);
    for (const rejection of rejectionLog) {
      console.log(`   [${rejection.type}] ${rejection.reason}`);
    }
  }

  console.log(`\n✅ FINAL: ${cleaned.length} valid transactions from ${transactions.length} extracted\n`);

  return cleaned;
};

const normalizeTransactionKey = (description, amount, txType = "expense") => {
  const normalizedDesc = String(description || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
  const roundedAmount = Math.round(Number(amount) * 100) / 100;
  return `${normalizedDesc}|${roundedAmount}|${txType}`;
};

const dedupeTransactionList = (transactions = []) => {
  const seen = new Set();
  const deduped = [];
  for (const tx of transactions) {
    if (!tx?.description || !tx?.amount) continue;
    const txType = tx.transactionType || "expense";
    const key = normalizeTransactionKey(tx.description, tx.amount, txType);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(tx);
  }
  return deduped;
};

const mergeTransactionLists = (primary = [], supplemental = []) =>
  dedupeTransactionList([...primary, ...supplemental]);

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
        console.log(`≡ƒñû Vision AI parsed ${transactions.length} transactions via ${modelName}.`);
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
  if (isLikelyReferenceNumber(token, line)) return false;
  if (isFailedTransactionLine(line)) return false;

  const normalized = token.replace(/,/g, "");
  const amount = Number(normalized);
  if (!amount || isNaN(amount) || amount <= 0) return false;

  const hasDecimals = /\.\d{1,2}$/.test(normalized);
  const hasCurrency = /[Γé╣$]|(?:\brs\.?\b)|(?:\binr\b)/i.test(line);

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

  // On date-heavy lines, small integers are usually day/month/qty ΓÇö not amounts.
  if (!hasDecimals && amount <= 31 && /\d{1,2}[\/\-\.]\d{1,2}/.test(line)) {
    return false;
  }

  // Prefer realistic expense values: currency marker, decimals, or >= Γé╣10.
  if (hasCurrency || hasDecimals || amount >= 10) return true;

  // Tiny whole numbers without context are usually OCR noise.
  return false;
};

const scoreAmountCandidate = (token, amount, index, lineLength, line) => {
  let score = 0;
  const normalized = token.replace(/,/g, "");

  if (/\.\d{2}$/.test(normalized)) score += 12;
  if (/[Γé╣$]|(?:\brs\.?\b)|(?:\binr\b)/i.test(line)) score += 8;
  if (amount >= 10 && amount <= 500000) score += 6;
  if (index >= lineLength * 0.45) score += 4; // amounts usually appear on the right
  if (amount < 5) score -= 8;

  return score;
};

const extractAmountFromLine = (line) => {
  const plusMatch = line.match(
    /^\+\s*(?:₹|¥|rs\.?|inr)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d+(?:\.\d{2})?)/i,
  );
  if (plusMatch) {
    const token = plusMatch[1];
    const amount = Number(token.replace(/,/g, ""));
    if (amount >= 1) {
      return { amountToken: plusMatch[0], amount, isReceived: true };
    }
  }

  const minusMatch = line.match(
    /^-\s*(?:₹|¥|rs\.?|inr)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d+(?:\.\d{2})?)/i,
  );
  if (minusMatch) {
    const token = minusMatch[1];
    const amount = Number(token.replace(/,/g, ""));
    if (isLikelyExpenseAmount(token, line)) {
      return { amountToken: minusMatch[0], amount, isExpense: true };
    }
  }

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
    .replace(/[Γé╣$,;|]+/g, " ")
    .replace(/\b(rs\.?|inr)\b/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  description = description.replace(/^[\d.\s\-]+|[\d.\s\-]+$/g, "").trim();
  return description || "Purchase";
};

// ≡ƒô▒ Paytm / PhonePe / GPay screenshot parser ΓÇö handles multi-line UPI history rows.
const parseUpiAppScreenshotText = (text) => {
  const upiSignalCount =
    (text.match(
      /sent\s+(yesterday|on\b|today)|paid\s+on\b|received\s+(on|yesterday|today)\b|money transfer|money sent to|received from|payment to|debited from|credited to|money received/gi,
    ) || []).length;
  const isUpiApp =
    /paytm|phonepe|gpay|google pay|bhim|upi lite|payment history|money transfer|balance\s*&\s*history|transaction history|spend analytics|credited to|debited from|payment to|money received/i.test(
      text,
    ) || upiSignalCount >= 2;

  if (!isUpiApp) return null;

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 1);

  const failedZoneIndexes = new Set();
  for (let i = 0; i < lines.length; i++) {
    if (isFailedTransactionLine(lines[i]) || /^\s*failed\s*$/i.test(lines[i])) {
      for (let k = Math.max(0, i - 6); k <= Math.min(lines.length - 1, i + 6); k++) {
        failedZoneIndexes.add(k);
      }
    }
  }
  for (let i = 0; i < lines.length; i++) {
    if (!/^payment\s+to\b/i.test(lines[i])) continue;
    const segment = lines.slice(i, Math.min(i + 10, lines.length));
    if (segment.some((l) => isFailedTransactionLine(l) || /^\s*failed\s*$/i.test(l))) {
      for (let k = i; k < Math.min(i + 10, lines.length); k++) failedZoneIndexes.add(k);
    }
  }

  const transactions = [];
  const seen = new Set();
  const usedLineIndexes = new Set();

  const parseUpiOcrAmount = (digits, line = "") => {
    const d = String(digits).replace(/,/g, "").replace(/\D/g, "");
    if (!d) return null;

    let amount = Number(d);
    const isExpenseCtx = /-|sent\b|paid\b|debited|payment\s+to|money\s+sent\s+to/i.test(line);
    const isReceivedCtx = /\+|received|credited|money\s+received/i.test(line);

    if (d.length === 4 && /^[23]/.test(d) && (isExpenseCtx || isReceivedCtx)) {
      const stripped = Number(d.slice(1));
      if (stripped >= 10 && stripped <= 50000) amount = stripped;
    } else if (d.length === 3 && d.startsWith("3")) {
      const lastTwo = Number(d.slice(-2));
      if (lastTwo >= 1 && lastTwo <= 500) amount = lastTwo;
    }

    return amount >= 1 && amount <= 500000 ? amount : null;
  };

  const mapUpiTagCategory = (tagLine) => {
    const t = (tagLine || "").toLowerCase();
    if (/money\s+received|received/i.test(t)) return "Other";
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
      .replace(/[@&┬úΓé¼$#%+]+/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();

  const isNoiseLine = (line) =>
    isCompactPaytmStatusLine(line) ||
    /^(balance|history|your accounts|payment history|canara|upi lite|ac no|deck|paytm|total spent)/i.test(
      line,
    ) ||
    /^from\s+[\d&@┬ú]+$/i.test(line) ||
    /^june\s+\d{4}/i.test(line) ||
    /^[\d:]+\s*[%~]/.test(line);

  const extractNameAmountFromLine = (line) => {
    if (!line || isNoiseLine(line)) return null;

    const patterns = [
      /^(.+?)\s*-+\s*[^0-9A-Za-z]*(\d{2,4})\s*$/,
      /^(.+?)\s*[Γé╣┬Ñrs%]+\s*(\d{2,4})\s*$/i,
      /^(.+?)\s+(\d{2,3})\s*$/,
    ];

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (!match) continue;

      const name = cleanPersonName(match[1]);
      const amount = parseUpiOcrAmount(match[2], line);
      if (name && name.length >= 2 && amount) {
        return { name, amount };
      }
    }

    return null;
  };

  const findCategoryNear = (anchorIndex) => {
    for (let j = anchorIndex + 1; j < Math.min(anchorIndex + 4, lines.length); j++) {
      if (/money transfer|groceries|food|shop|travel|bill|entertain|money received|shopping/i.test(lines[j])) {
        return mapUpiTagCategory(lines[j]);
      }
    }
    for (let j = anchorIndex - 1; j >= Math.max(0, anchorIndex - 3); j--) {
      if (/money transfer|groceries|food|shop|travel|bill|entertain|money received|shopping/i.test(lines[j])) {        return mapUpiTagCategory(lines[j]);
      }
    }
    return "Other";
  };

  const pushTransaction = (
    name,
    amount,
    category,
    lineIndexes = [],
    sourceLine = "",
    forcedTxType = null,
  ) => {
    if (!name || !amount || amount < 5) return;
    if (!isValidTransactionName(name)) return;
    if (/^(money sent to|money received|received from|spend analytics|transaction history|total cashback|failed|pending)$/i.test(String(name).trim())) {
      return;
    }

    if (lineIndexes.some((idx) => failedZoneIndexes.has(idx))) return;

    if (lineIndexes.length > 0) {
      const minIdx = Math.min(...lineIndexes);
      const maxIdx = Math.max(...lineIndexes);
      const wideBlock = lines.slice(Math.max(0, minIdx - 2), Math.min(lines.length, maxIdx + 6));
      if (isFailedTransactionBlock(wideBlock)) return;
    }

    const txType = resolveTransactionType(name, sourceLine, forcedTxType);
    const finalCategory =
      txType === "received" ? "Other" : resolveCategory(name, category);
    const dedupeKey = normalizeTransactionKey(name, amount, txType);
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    lineIndexes.forEach((idx) => usedLineIndexes.add(idx));

    transactions.push({
      category: finalCategory,
      description: name,
      amount,
      itemCount: 1,
      transactionType: txType,
    });
  };

  const resolveAnchorTxType = (anchorLine) => {
    if (isReceivedAnchorLine(anchorLine)) return "received";
    if (isSentAnchorLine(anchorLine)) return "expense";
    return null;
  };

  const collectAnchorBlock = (startIdx) => {
    const block = [{ index: startIdx, text: lines[startIdx] }];
    for (let j = startIdx + 1; j < Math.min(startIdx + 8, lines.length); j++) {
      if (isUpiAnchorLine(lines[j])) break;
      if (/^(home|offers|cashback|history|scan|help)$/i.test(lines[j])) break;
      block.push({ index: j, text: lines[j] });
    }
    return block;
  };

  const parseNameAmountFromBlock = (blockEntries, anchorLine, txType) => {
    const blockLines = blockEntries.map((entry) => entry.text);
    if (isFailedTransactionBlock(blockLines)) return null;

    const anchorText = String(anchorLine || "");
    let name = null;
    const amountFragments = [];

    const stripAnchorPrefix = (line) => {
      const t = String(line || "").trim();
      if (isCompactPaytmStatusLine(t)) return "";
      return t
        .replace(/^money\s+sent\s+to\s*/i, "")
        .replace(/^money\s+received\s*/i, "")
        .replace(/^received\s+from\s*/i, "")
        .replace(/^(credited|refund)\b\s*/i, "")
        .trim();
    };

    const anchorTail = stripAnchorPrefix(anchorText);
    if (anchorTail && !isOcrNoiseLine(anchorTail)) {
      const tailDigits = anchorTail.match(/(\d{1,3}(?:,\d{3})+|\d{2,6})/);
      if (tailDigits && !/[A-Za-z]{3,}/.test(anchorTail)) {
        amountFragments.push(tailDigits[1]);
      } else if (/[A-Za-z]{3,}/.test(anchorTail)) {
        const candidateName = cleanPersonName(anchorTail.replace(/\d+.*$/, "").trim());
        if (isValidTransactionName(candidateName)) name = candidateName;
      }
    }

    for (const entry of blockEntries.slice(1)) {
      const candidate = entry.text;
      if (isOcrNoiseLine(candidate) || isDateLine(candidate)) continue;

      const hashAmt = candidate.match(/^[#%¥$₹+-]+\s*(\d{1,3}(?:,\d{3})*|\d{2,6})/);
      if (hashAmt) {
        amountFragments.push(hashAmt[1]);
        continue;
      }

      const inlineDigits = candidate.match(/^[^A-Za-z]*(\d{1,3}(?:,\d{3})+|\d{2,6})[^A-Za-z0-9]*$/);
      if (inlineDigits) {
        amountFragments.push(inlineDigits[1]);
        continue;
      }

      const nameAmountLine = candidate.match(/^([A-Za-z][A-Za-z\s.'-]{1,50})\s+(\d{2,6})\s*$/);
      if (nameAmountLine) {
        name = name || cleanPersonName(nameAmountLine[1]);
        amountFragments.push(nameAmountLine[2]);
        continue;
      }

      const extracted = extractNameAmountFromLine(candidate);
      if (extracted) {
        name = name || extracted.name;
        amountFragments.push(String(extracted.amount));
        continue;
      }

      if (/[A-Za-z]{3,}/.test(candidate) && !isFailedTransactionLine(candidate)) {
        const candidateName = cleanPersonName(candidate);
        if (isValidTransactionName(candidateName)) {
          name = name || candidateName;
        }
        const trailingDigits = candidate.match(/(\d{2,6})\s*$/);
        if (trailingDigits) amountFragments.push(trailingDigits[1]);
      }
    }

    const contextLine = `${anchorText} ${txType === "received" ? "received credited" : "sent paid"}`;
    const amount = joinSplitAmountFragments(amountFragments, contextLine);
    if (!name || !amount || !isValidTransactionName(name)) return null;

    return { name, amount };
  };

  const isDateLine = (line) =>
    /^\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(line);

  const isOcrNoiseLine = (line) => {
    const compact = String(line || "").replace(/\s+/g, "");
    return compact.length <= 2;
  };

  const joinSplitAmountFragments = (fragments, contextLine = "money sent to") => {
    const nums = fragments.map((f) => String(f).replace(/,/g, "")).filter(Boolean);
    if (!nums.length) return null;
    if (nums.length === 1) return parseUpiOcrAmount(nums[0], contextLine);

    const last = nums[nums.length - 1];
    if (last === "000" && nums.length >= 2) {
      const combined = Number(`${nums[0]}${last}`);
      if (combined >= 1000 && combined <= 500000) return combined;
    }

    const best =
      parseUpiOcrAmount(nums[nums.length - 1], contextLine) ??
      parseUpiOcrAmount(nums[0], contextLine);
    return best;
  };

  const resolvePaytmRowType = (amountLineIdx, amountLine) => {
    const rangeStart = Math.max(0, amountLineIdx - 3);
    const rangeEnd = Math.min(lines.length, amountLineIdx + 5);
    for (let k = rangeStart; k < rangeEnd; k++) {
      if (failedZoneIndexes.has(k) || isFailedTransactionLine(lines[k])) return null;
    }

    const range = lines.slice(rangeStart, rangeEnd);
    if (isFailedTransactionBlock(range)) return null;

    for (const l of range) {
      if (/^(sent|paid)\s+(on|yesterday|today)/i.test(l)) return "expense";
      if (/^money\s+sent\s+to\b/i.test(l) || /^payment\s+to\b/i.test(l)) return "expense";
      if (/money\s+transfer/i.test(l) && !/money\s+received/i.test(l)) return "expense";
    }
    for (const l of range) {
      if (/^received\s+(on|yesterday|today)/i.test(l) || /money\s+received/i.test(l)) {
        return "received";
      }
      if (/^received\s+from\b/i.test(l)) return "received";
    }

    if (isPaytmMinusAmountLine(amountLine)) return "expense";
    if (isPaytmPlusAmountLine(amountLine)) return "received";
    return "expense";
  };

  const findNearestAnchorType = (index) => {
    const resolveRowTypeFromStatusLines = (start, end) => {
      for (let j = start; j <= end; j++) {
        const line = lines[j];
        if (/^(sent|paid)\s+(on|yesterday|today)/i.test(line)) return "expense";
        if (/^received\s+(on|yesterday|today)/i.test(line) || /money\s+received/i.test(line)) {
          return "received";
        }
        const txType = resolveAnchorTxType(line);
        if (txType) return txType;
      }
      return null;
    };

    if (isPaytmPlusAmountLine(lines[index]) || isPaytmMinusAmountLine(lines[index])) {
      const rowType = resolvePaytmRowType(index, lines[index]);
      if (rowType) return rowType;
    }

    const afterType = resolveRowTypeFromStatusLines(index, Math.min(index + 3, lines.length - 1));
    if (afterType) return afterType;

    const beforeType = resolveRowTypeFromStatusLines(Math.max(0, index - 3), index - 1);
    if (beforeType) return beforeType;

    return "expense";
  };

  // Paytm / BHIM signed amount rows: classify using nearby Paid/Received status (skip FAILED blocks).
  for (let i = 0; i < lines.length; i++) {
    if (usedLineIndexes.has(i) || failedZoneIndexes.has(i)) continue;
    const line = lines[i];
    if (!isPaytmPlusAmountLine(line) && !isPaytmMinusAmountLine(line)) continue;

    const blockLines = lines.slice(Math.max(0, i - 3), Math.min(lines.length, i + 5));
    if (isFailedTransactionBlock(blockLines)) {
      blockLines.forEach((_, offset) => usedLineIndexes.add(Math.max(0, i - 3) + offset));
      continue;
    }

    const extracted = extractAmountFromLine(line);
    if (!extracted?.amount) continue;

    const txType = resolvePaytmRowType(i, line);
    if (!txType) {
      blockLines.forEach((_, offset) => usedLineIndexes.add(Math.max(0, i - 3) + offset));
      continue;
    }

    let name = null;
    const usedIndexes = [i];
    for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
      const candidate = lines[j];
      if (
        usedLineIndexes.has(j) ||
        failedZoneIndexes.has(j) ||
        isNoiseLine(candidate) ||
        isUpiAnchorLine(candidate) ||
        isCompactPaytmStatusLine(candidate)
      ) {
        continue;
      }
      if (isPaytmPlusAmountLine(candidate) || isPaytmMinusAmountLine(candidate)) continue;
      if (/^[A-Za-z]/.test(candidate)) {
        const candidateName = cleanPersonName(candidate);
        if (isValidTransactionName(candidateName)) {
          name = candidateName;
          usedIndexes.push(j);
          break;
        }
      }
    }

    if (!name) continue;
    pushTransaction(name, extracted.amount, autoCategorize(name), usedIndexes, line, txType);
  }

  // Primary strategy — anchor-driven blocks (Money sent to / Received from / Sent / Paid / Received).
  for (let i = 0; i < lines.length; i++) {
    if (usedLineIndexes.has(i) || !isUpiAnchorLine(lines[i])) continue;

    const txType = resolveAnchorTxType(lines[i]);
    if (!txType) continue;

    const blockEntries = collectAnchorBlock(i);
    const blockLines = blockEntries.map((entry) => entry.text);
    if (isFailedTransactionBlock(blockLines)) {
      blockEntries.forEach((entry) => usedLineIndexes.add(entry.index));
      continue;
    }

    const parsed = parseNameAmountFromBlock(blockEntries, lines[i], txType);
    if (parsed) {
      pushTransaction(
        parsed.name,
        parsed.amount,
        autoCategorize(parsed.name),
        blockEntries.map((entry) => entry.index),
        lines[i],
        txType,
      );
    }
  }

  const moneySentAnchorCount = lines.filter((l) => /^money sent to\b/i.test(l)).length;
  const receivedAnchorCount = lines.filter((l) => /^received\s+from\b/i.test(l)).length;
  const isTransactionHistoryLayout =
    (moneySentAnchorCount + receivedAnchorCount) >= 2 && /transaction history/i.test(text);

  if (isTransactionHistoryLayout && transactions.length > 0) {
    return transactions;
  }

  // Strategy A - Paytm compact UI: "Sent yesterday" / "Paid on" below the name.
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (usedLineIndexes.has(i) || !/^(sent|paid)\b/i.test(line)) continue;
    if (isFailedTransactionLine(line)) continue;

    const sentBlock = lines.slice(Math.max(0, i - 4), Math.min(lines.length, i + 2));
    if (isFailedTransactionBlock(sentBlock)) continue;

    let name = null;
    let amount = null;
    const usedIndexes = [i];

    for (let j = i - 1; j >= Math.max(0, i - 4); j--) {
      const candidate = lines[j];
      if (usedLineIndexes.has(j) || isNoiseLine(candidate) || /^(sent|paid|received)\b/i.test(candidate)) {
        continue;
      }
      if (/money transfer|groceries/i.test(candidate)) continue;
      if (isFailedTransactionLine(candidate)) break;

      const extracted = extractNameAmountFromLine(candidate);
      if (extracted && isValidTransactionName(extracted.name)) {
        name = extracted.name;
        amount = extracted.amount;
        usedIndexes.push(j);

        if (j - 1 >= 0) {
          const prev = lines[j - 1];
          if (
            !usedLineIndexes.has(j - 1) &&
            /^[A-Za-z]/.test(prev) &&
            !extractNameAmountFromLine(prev) &&
            !/^(sent|paid|received)\b/i.test(prev) &&
            !/money transfer|groceries/i.test(prev)
          ) {
            const prevName = cleanPersonName(prev);
            if (isValidTransactionName(prevName)) {
              name = `${prevName} ${name}`.replace(/\s{2,}/g, " ").trim();
              usedIndexes.push(j - 1);
            }
          }
        }
        break;
      }

      if (isPaytmMinusAmountLine(candidate)) {
        const amt = extractAmountFromLine(candidate);
        if (amt?.amount && j - 1 >= 0) {
          const prevName = cleanPersonName(lines[j - 1]);
          if (isValidTransactionName(prevName)) {
            name = prevName;
            amount = amt.amount;
            usedIndexes.push(j, j - 1);
            break;
          }
        }
      }

      if (/^[A-Za-z]/.test(candidate)) {
        const candidateName = cleanPersonName(candidate);
        if (isValidTransactionName(candidateName)) {
          name = candidateName;
          usedIndexes.push(j);
          for (let k = j + 1; k < i; k++) {
            if (isPaytmMinusAmountLine(lines[k])) {
              const amt = extractAmountFromLine(lines[k]);
              if (amt?.amount) {
                amount = amt.amount;
                usedIndexes.push(k);
                break;
              }
            }
          }
          if (name && amount) break;
        }
      }
    }

    if (name && amount && isValidTransactionName(name)) {
      pushTransaction(name, amount, findCategoryNear(i), usedIndexes, line, "expense");
    }
  }

  // Strategy A2 - Paytm compact UI: "Received on" / "Received yesterday" below the name.
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (usedLineIndexes.has(i) || !/^received\s+(on|yesterday|today)\b/i.test(line)) continue;
    if (isFailedTransactionLine(line)) continue;

    const recvBlock = lines.slice(Math.max(0, i - 4), Math.min(lines.length, i + 2));
    if (isFailedTransactionBlock(recvBlock)) continue;

    let name = null;
    let amount = null;
    const usedIndexes = [i];

    for (let j = i - 1; j >= Math.max(0, i - 4); j--) {
      const candidate = lines[j];
      if (usedLineIndexes.has(j) || isNoiseLine(candidate)) continue;
      if (/^(sent|paid|received)\b/i.test(candidate)) continue;
      if (isFailedTransactionLine(candidate)) break;

      const extracted = extractNameAmountFromLine(candidate);
      if (extracted && isValidTransactionName(extracted.name)) {
        name = extracted.name;
        amount = extracted.amount;
        usedIndexes.push(j);
        break;
      }

      if (isPaytmPlusAmountLine(candidate)) {
        const plusAmt = extractAmountFromLine(candidate);
        if (plusAmt?.amount) {
          amount = plusAmt.amount;
          usedIndexes.push(j);
          if (j - 1 >= 0 && /^[A-Za-z]/.test(lines[j - 1]) && !isNoiseLine(lines[j - 1])) {
            const prevName = cleanPersonName(lines[j - 1]);
            if (isValidTransactionName(prevName)) {
              name = prevName;
              usedIndexes.push(j - 1);
              break;
            }
          }
        }
      }

      if (/^[A-Za-z][A-Za-z\s.'-]{2,}$/.test(candidate) && isValidTransactionName(cleanPersonName(candidate))) {
        name = cleanPersonName(candidate);
        usedIndexes.push(j);
        for (let k = j + 1; k <= i; k++) {
          const amountLine = extractAmountFromLine(lines[k]);
          if (amountLine) {
            amount = amountLine.amount;
            usedIndexes.push(k);
            break;
          }
        }
        if (name && amount) break;
      }
    }

    if (name && amount && isValidTransactionName(name)) {
      pushTransaction(name, amount, "Other", usedIndexes, line, "received");
    }
  }

  // Strategy B — backup rows only when anchored by nearby Sent/Paid/Received labels.
  for (let i = 0; i < lines.length; i++) {
    if (usedLineIndexes.has(i) || isNoiseLine(lines[i]) || isUpiAnchorLine(lines[i])) {
      continue;
    }
    if (isFailedTransactionLine(lines[i])) continue;

    const nearbyType = findNearestAnchorType(i);
    const nearbyBlock = lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 6));
    if (isFailedTransactionBlock(nearbyBlock)) continue;

    const extracted = extractNameAmountFromLine(lines[i]);
    if (!extracted) continue;

    let name = extracted.name;
    if (i + 1 < lines.length) {
      const next = lines[i + 1];
      if (
        !usedLineIndexes.has(i + 1) &&
        !isUpiAnchorLine(next) &&
        !/money transfer|groceries/i.test(next) &&
        !extractNameAmountFromLine(next) &&
        /^[A-Za-z]/.test(next) &&
        next.split(/\s+/).length <= 6
      ) {
        name = `${name} ${cleanPersonName(next)}`.replace(/\s{2,}/g, " ").trim();
      }
    }

    if (!isValidTransactionName(name)) continue;

    pushTransaction(
      name,
      extracted.amount,
      findCategoryNear(i),
      [i],
      lines[i],
      nearbyType,
    );
  }

  // Strategy C — category tags with nearest anchor type (incl. Money Received).
  for (let i = 0; i < lines.length; i++) {
    if (!/money transfer|groceries|money received|shopping/i.test(lines[i])) continue;

    const category = mapUpiTagCategory(lines[i]);
    const forcedType = /money\s+received/i.test(lines[i]) ? "received" : null;
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
          amount = parseUpiOcrAmount(digitMatch[1], lines[j]);
          if (name && amount) break;
        }
      }
    }

    if (name && amount && isValidTransactionName(name)) {
      const nearbyType = forcedType || findNearestAnchorType(i);
      const tagBlock = lines.slice(Math.max(0, i - 6), Math.min(lines.length, i + 2));
      if (isFailedTransactionBlock(tagBlock)) continue;
      pushTransaction(name, amount, category, [i], lines[i], nearbyType);
    }
  }

  return transactions.length > 0 ? transactions : null;
};

// ≡ƒº« LOCAL FALLBACK ΓÇö scan extracted text line-by-line and build transactions.
// Used when Gemini is unavailable / rate-limited / returns nothing usable, so
// docx, txt, xlsx, xls, and csv uploads keep working with proper categorization
// even without the AI step.
const parseTransactionsFromRawText = (text) => {
  // ✅ OCR DEBUGGING: Log raw OCR text (first 500 chars for brevity)
  const textPreview = (text || "").slice(0, 500).replace(/\n/g, "\\n");
  console.log(`📄 RAW OCR TEXT (first 500 chars): ${textPreview}...`);

  const upiTransactions = parseUpiAppScreenshotText(text);
  if (upiTransactions?.length) {
    console.log(`✅ UPI app screenshot parser extracted ${upiTransactions.length} transactions.`);
    return upiTransactions;
  }

  const lines = text.split(/\r?\n/);
  const transactions = [];
  const seen = new Set();
  const rejectedLines = [];

  console.log(`📊 LINE-BY-LINE PARSING: Processing ${lines.length} lines`);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || /^---\s*Sheet:/i.test(line)) continue;

    // Skip lines that are only a date/time.
    if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(line)) continue;
    if (/^\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}$/.test(line)) continue;
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(line)) continue;

    const extracted = extractAmountFromLine(line);
    if (!extracted) continue;
    
    // ✅ REJECTION: Failed transaction
    if (isFailedTransactionLine(line)) {
      rejectedLines.push({ reason: "FAILED_TRANSACTION", line });
      continue;
    }

    const nearbyLines = lines.slice(Math.max(0, lines.indexOf(rawLine) - 2), lines.indexOf(rawLine) + 3);
    if (isFailedTransactionBlock(nearbyLines.map((l) => l.trim()).filter(Boolean))) {
      rejectedLines.push({ reason: "FAILED_BLOCK", line });
      continue;
    }

    const { amountToken, amount } = extracted;
    let description = cleanLineDescription(line, amountToken);
    
    // ✅ REJECTION: Junk description
    if (isJunkDescription(description)) {
      rejectedLines.push({ reason: "JUNK_DESC", line });
      continue;
    }

    const lowerDesc = description.toLowerCase();
    const isReceivedLine = isReceivedTransaction(description, line);
    
    // ✅ REJECTION: Non-expense junk
    if (
      !isReceivedLine &&
      (/^(total|subtotal|tax|balance|amount|date|description|item|qty|quantity|payment|paid|failed|pending)$/i.test(
        lowerDesc,
      ) ||
      /subtotal|grand total|total expense|total income|total spent|page \d|statement period|opening balance|invoice no|bill no|gstin|thank you|sent yesterday|sent on|paid on|money transfer|from \d|payment history|your accounts|upi lite|canara bank|transaction failed/i.test(
        lowerDesc,
      ) ||
      /^(sent|paid|from|june|paytm)/i.test(lowerDesc))
    ) {
      rejectedLines.push({ reason: "JUNK_KEYWORDS", line });
      continue;
    }

    const txType = resolveTransactionType(description, line);
    const dedupeKey = normalizeTransactionKey(description, amount, txType);
    
    // ✅ REJECTION: Duplicate
    if (seen.has(dedupeKey)) {
      rejectedLines.push({ reason: "DUPLICATE", line });
      continue;
    }
    
    seen.add(dedupeKey);

    transactions.push({
      category: txType === "received" ? "Other" : resolveCategory(description),
      description,
      amount,
      itemCount: 1,
      transactionType: txType,
    });

    // ✅ LOG: Extracted transaction
    console.log(`✅ LINE PARSED: ${txType.toUpperCase()} | ${description} | ₹${amount}`);
  }

  // ✅ OCR DEBUGGING: Summary of rejected lines
  if (rejectedLines.length > 0) {
    console.log(`❌ REJECTED LINES: ${rejectedLines.length}`);
    const rejectCounts = {};
    for (const reject of rejectedLines) {
      rejectCounts[reject.reason] = (rejectCounts[reject.reason] || 0) + 1;
    }
    for (const [reason, count] of Object.entries(rejectCounts)) {
      console.log(`   - ${reason}: ${count}`);
    }
  }

  console.log(`✅ EXTRACTED: ${transactions.length} transactions from ${lines.length} lines\n`);

  return transactions;
};

// ≡ƒôé Extract readable text from a non-image/non-pdf document buffer.
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

    // STRATEGY A ΓÇö real, modern OOXML .xlsx (and many files saved with a
    // .xls extension that are actually xlsx under the hood ΓÇö common from
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
          console.log("≡ƒôè ExcelJS: Parsed as native XLSX workbook.");
          return { text, isDocumentFile: true };
        }
      } catch (xlsxErr) {
        console.warn("ExcelJS xlsx.load failed, trying CSV reader:", xlsxErr.message);
      }
    }

    // STRATEGY B ΓÇö true CSV / tab-delimited text, via ExcelJS's own csv
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
        console.log("≡ƒôè ExcelJS: Parsed as CSV stream.");
        return { text, isDocumentFile: true };
      }
    } catch (csvErr) {
      console.warn("ExcelJS csv.read failed, trying HTML/raw-text fallback:", csvErr.message);
    }

    // STRATEGY C ΓÇö many bank/web-app "xls" exports are actually HTML tables
    // wearing an .xls extension. Strip markup so the rows read as plain text.
    const rawString = finalBuffer.toString("utf-8");
    if (/<table/i.test(rawString) || /<html/i.test(rawString)) {
      const text = rawString
        .replace(/<\/(tr|p|div|br)>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/[ \t]{2,}/g, " ");
      console.log("≡ƒôè Detected HTML-formatted spreadsheet export, stripped markup.");
      return { text, isDocumentFile: true };
    }

    // STRATEGY D ΓÇö last resort, raw decode. Note: genuine legacy binary
    // .xls (Excel 97-2003 BIFF format) cannot be reliably read this way ΓÇö
    // ExcelJS doesn't support that format at all, so this will only recover
    // something usable if the file is actually CSV/HTML/plain text in
    // disguise, not a true binary .xls.
    const text = rawString.replace(/[^\x20-\x7E\n\r\t]/g, " ");
    if (text.trim().length > 15) {
      return { text, isDocumentFile: true };
    }

    // STRATEGY E ΓÇö parse with SheetJS to support true legacy .xls and edge files.
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
        console.log("≡ƒôè Parsed spreadsheet with SheetJS fallback.");
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
        console.log("≡ƒô¥ Mammoth: Extracted text from Word (.docx).");
        return { text: result.value, isDocumentFile: true, fileKind: "word" };
      } catch (err) {
        console.warn("Mammoth .docx extraction failed:", err.message);
      }
    }

    const text = finalBuffer
      .toString(isDocx ? "utf-8" : "latin1")
      .replace(/[^\x20-\x7E\n\r\t]/g, " ");
    console.log(`≡ƒô¥ Extracted text from Word (${isDocx ? ".docx" : ".doc"}) fallback.`);
    return { text, isDocumentFile: true, fileKind: "word" };
  }

  if (isRtf) {
    const text = cleanRTFToText(finalBuffer.toString("utf-8"));
    console.log("≡ƒôä RTF document cleaned to plain text.");
    return { text, isDocumentFile: true, fileKind: "rtf" };
  }

  if (isTxt) {
    const text = finalBuffer.toString("utf-8");
    console.log("≡ƒôä Plain text file loaded.");
    return { text, isDocumentFile: true, fileKind: "text" };
  }

  const isPdf = mimeType.includes("pdf") || /\.pdf$/i.test(lowerFileName);
  if (isPdf) {
    try {
      const pdfText = await extractPdfText(finalBuffer);
      if (pdfText) {
        console.log("≡ƒôä PDF text extracted via pdf-parse.");
        return { text: pdfText, isDocumentFile: true, fileKind: "pdf" };
      }
    } catch (err) {
      console.warn("pdf-parse failed:", err.message);
    }
    return { text: "", isDocumentFile: false, fileKind: "pdf", isScannedPdf: true };
  }

  // Images ΓÇö OCR / vision path in scanReceiptAndProcess.
  return { text: "", isDocumentFile: false, fileKind: "image" };
};

// 1. Γ₧ò ADD MANUAL EXPENSE
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

// 2. GET EXPENSES (backward compatible; optional ?page=&limit=&type=&summary=1)
export const getExpenses = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ msg: "User ID parameter required." });

    const page = parseInt(req.query.page, 10);
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const type = req.query.type;
    const includeSummary = req.query.summary === "1" || req.query.summary === "true";

    const filter = { userId };
    if (type === "expense") {
      filter.$or = [{ transactionType: "expense" }, { transactionType: { $exists: false } }];
    } else if (type === "received") {
      filter.transactionType = "received";
    }

    const usePagination = Number.isFinite(page) && page > 0;

    if (usePagination) {
      const skip = (page - 1) * limit;
      const [expenses, total] = await Promise.all([
        Expense.find(filter).sort({ date: -1 }).skip(skip).limit(limit).lean(),
        Expense.countDocuments(filter),
      ]);

      const payload = {
        data: expenses,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit) || 1,
        },
      };

      if (includeSummary) {
        const allForSummary = await Expense.find({ userId }).lean();
        const budget = await Budget.findOne({ userId }).lean();
        payload.summary = buildFinancialSummary(allForSummary, budget || {});
      }

      return res.json(payload);
    }

    const expenses = await Expense.find(filter).sort({ date: -1 });

    if (includeSummary) {
      const budget = await Budget.findOne({ userId }).lean();
      return res.json({
        data: expenses,
        summary: buildFinancialSummary(expenses, budget || {}),
      });
    }

    return res.json(expenses);
  } catch (err) {
    res.status(500).json({ msg: "Database query error.", error: err.message });
  }
};

export const getFinancialSummary = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ msg: "User ID parameter required." });

    const [expenses, budget] = await Promise.all([
      Expense.find({ userId }).lean(),
      Budget.findOne({ userId }).lean(),
    ]);

    return res.json({
      success: true,
      summary: buildFinancialSummary(expenses, budget || {}),
    });
  } catch (err) {
    res.status(500).json({ success: false, msg: "Summary calculation failed.", error: err.message });
  }
};

export const getExpenseInsights = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ msg: "User ID parameter required." });

    const [expenses, budget] = await Promise.all([
      Expense.find({ userId }).lean(),
      Budget.findOne({ userId }).lean(),
    ]);

    const { insights, summary } = generateLocalInsights(expenses, budget || {});
    return res.json({ success: true, insights, summary });
  } catch (err) {
    res.status(500).json({ success: false, msg: "Insights generation failed.", error: err.message });
  }
};

// 2b. ≡ƒùæ∩╕Å DELETE ALL EXPENSE LOGS (keeps received/credit entries)
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

export const deleteAllReceived = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, msg: "Session validation expired or User ID missing." });
    }

    const result = await Expense.deleteMany({
      userId,
      transactionType: "received",
    });

    return res.status(200).json({
      success: true,
      msg: `Deleted ${result.deletedCount} received transaction(s).`,
      deletedCount: result.deletedCount,
    });
  } catch (err) {
    res.status(500).json({ success: false, msg: "Failed to delete received transactions.", error: err.message });
  }
};

// 3. ≡ƒô╕ AI SCAN RECEIPT & PROCESS
export const scanReceiptAndProcess = async (req, res) => {
  try {
    const safeBody = req.body || {};
    let imageBuffer = safeBody.imageBuffer || null;
    let mimeType = safeBody.mimeType || null;
    let fileBuffer = safeBody.fileBuffer || null;
    const userId = req.user?._id || safeBody.userId;

    let finalBuffer;
    if (req.file) {
      finalBuffer = req.file.buffer;
      mimeType = req.file.mimetype;
      imageBuffer = req.file.buffer.toString("base64");
    } else if (imageBuffer) {
      finalBuffer = Buffer.from(imageBuffer, "base64");
    } else if (fileBuffer) {
      finalBuffer = fileBuffer;
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

    console.log(`≡ƒôé Universal scan started: ${fileName} [${fileMeta.fileKind}]`);

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
    let imageOcrAlreadyRan = false;

    // Images: run AI vision + local OCR in parallel, merge results.
    if (isImageFile) {
      try {
        const ocrPromise = runImageOcr(finalBuffer);
        const visionPromise = activeApiKey
          ? analyzeVisualWithGemini(activeApiKey, imageBuffer, mimeType, IMAGE_SCAN_PROMPT)
          : Promise.resolve({ transactions: [], error: null });

        const [ocrText, visionResult] = await Promise.all([ocrPromise, visionPromise]);
        imageOcrAlreadyRan = true;

        const aiTransactions = visionResult.transactions || [];
        const ocrTransactions = parseTransactionsFromRawText(ocrText) || [];
        const isUpiScreenshot =
          /bhim|paytm|phonepe|gpay|google pay|money sent to|received from|money received|payment to|transaction history|upi lite|payment history|credited to|debited from/i.test(
            ocrText,
          );

        if (isUpiScreenshot) {
          const anchorTx = parseUpiAppScreenshotText(ocrText) || [];
          const upiTx = dedupeTransactionList(anchorTx.length ? anchorTx : ocrTransactions).filter(
            (tx) =>
              !isFailedTransactionLine(tx.description) &&
              !/\bfailed\b/i.test(`${tx.description || ""} ${tx.category || ""}`),
          );

          if (upiTx.length > 0) {
            extractedPayload = { transactions: upiTx };
            usedLocalOcr = true;
            console.log(
              `UPI screenshot detected: anchor parser extracted ${upiTx.length} transactions (AI merge skipped).`,
            );
          } else {
            const combined = mergeTransactionLists(aiTransactions, ocrTransactions).filter(
              (tx) =>
                !isFailedTransactionLine(tx.description) &&
                !/\bfailed\b/i.test(`${tx.description || ""} ${tx.category || ""}`),
            );

            if (combined.length > 0) {
              extractedPayload = { transactions: combined };
              usedLocalOcr = ocrTransactions.length > 0;
              console.log(
                `Image scan merged ${aiTransactions.length} AI + ${ocrTransactions.length} OCR -> ${combined.length} transactions.`,
              );
            } else if (visionResult.error) {
              lastError = visionResult.error;
            }
          }
        } else {
          const combined = mergeTransactionLists(aiTransactions, ocrTransactions);

          if (combined.length > 0) {
            extractedPayload = { transactions: combined };
            usedLocalOcr = ocrTransactions.length > 0;
            console.log(
              `Image scan merged ${aiTransactions.length} AI + ${ocrTransactions.length} OCR -> ${combined.length} transactions.`,
            );
          } else if (visionResult.error) {
            lastError = visionResult.error;
          }
        }
      } catch (imageScanErr) {
        console.warn("Image AI/OCR scan failed:", imageScanErr.message);
        lastError = imageScanErr;
      }
    }

    // Text documents: local parser first, AI text analysis second.
    if (!extractedPayload && isDocumentFile && trimmedTextContent.trim()) {
      const localTransactions = parseTransactionsFromRawText(trimmedTextContent);
      if (localTransactions.length > 0) {
        console.log("≡ƒº« Parsed document with local line-scan engine.");
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

    // Scanned PDFs (no extractable text): AI vision OCR.
    if (!extractedPayload && isPdfFile && !isDocumentFile && activeApiKey) {
      console.log("AI vision analyzing scanned PDF...");
      const pdfBase64 = finalBuffer.toString("base64");
      const pdfVisionResult = await analyzeVisualWithGemini(
        activeApiKey,
        pdfBase64,
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
        console.log("≡ƒº« Falling back to local line-scan categorization engine.");
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
        console.log("≡ƒôä Running local OCR on scanned PDF pages...");
        const pdfOcrText = await ocrScannedPdf(finalBuffer);
        const pdfOcrTransactions = parseTransactionsFromRawText(pdfOcrText);
        if (pdfOcrTransactions.length > 0) {
          extractedPayload = { transactions: pdfOcrTransactions };
          usedLocalOcr = true;
          console.log(`≡ƒôä Scanned PDF OCR extracted ${pdfOcrTransactions.length} transactions.`);
        }
      } catch (pdfOcrErr) {
        console.warn("Scanned PDF OCR fallback failed:", pdfOcrErr.message);
        lastError = pdfOcrErr;
      }
    }

    // Image OCR fallback only when parallel scan above did not run or found nothing.
    if (
      (!extractedPayload || !Array.isArray(extractedPayload.transactions) || extractedPayload.transactions.length === 0) &&
      isImageFile &&
      !imageOcrAlreadyRan
    ) {
      try {
        console.log("≡ƒô╖ Running local OCR fallback on image...");
        const ocrText = await runImageOcr(finalBuffer);
        const ocrTransactions = parseTransactionsFromRawText(ocrText);
        if (ocrTransactions.length > 0) {
          extractedPayload = { transactions: ocrTransactions };
          usedLocalOcr = true;
          console.log(`≡ƒô╖ Local OCR extracted ${ocrTransactions.length} transactions.`);
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

    // DB PLACEMENT LOOPS
    const uniqueTransactions = sanitizeAiTransactions(dedupeTransactionList(extractedPayload.transactions));
    const crossFileRegistry = safeBody._dedupeRegistry || null;
    const savedExpenses = [];
    const savedReceived = [];
    for (const transaction of uniqueTransactions) {
      try {
        let rawAmount = String(transaction.amount).replace(/[^0-9.]/g, "");
        const finalAmount = Number(rawAmount);
        if (!finalAmount || isNaN(finalAmount)) continue;

        const txType =
          transaction.transactionType || resolveTransactionType(transaction.description);

        const crossKey = normalizeTransactionKey(transaction.description, finalAmount, txType);
        if (crossFileRegistry?.has(crossKey)) continue;

        const category =
          txType === "received"
            ? "Other"
            : resolveCategory(transaction.description, transaction.category);

        const automatedExpense = new Expense({
          userId,
          description: transaction.description || `${category} Transaction`,
          amount: finalAmount,
          category,
          date: new Date(),
          transactionType: txType,
          scannedDocumentName: fileName || null,
        });

        const saved = await automatedExpense.save();
        crossFileRegistry?.add(crossKey);
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

    // RECALCULATE MONTHLY PROGRESS BUDGET METRICS (expenses only)
    const userBudget = await Budget.findOne({ userId }).lean();
    const monthlyBudgetCap = userBudget?.totalBudget > 0 ? userBudget.totalBudget : 10000;
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
      systemAlertNotification = `≡ƒ¢æ Alert! Your budget limit is 100% used (Spent: Γé╣${finalAccumulatedTotal}). Stop spending!`;
    } else if (consumptionRatioPercent >= 80) {
      systemAlertNotification = `ΓÜá∩╕Å Warning! You have consumed 80% of your budget allowance threshold.`;
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

// Batch scan — multiple files in one request, unified deduplication
export const scanMultipleReceipts = async (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ success: false, msg: "No files uploaded.", message: "No files uploaded." });
    }

    const crossFileRegistry = new Set();
    const combinedSaved = [];
    const fileReports = [];

    for (const file of files) {
      const capture = { status: 200, data: null };
      const mockRes = {
        status(code) {
          capture.status = code;
          return this;
        },
        json(payload) {
          capture.payload = payload;
          return this;
        },
      };

      const mockReq = {
        user: req.user,
        file,
        body: {
          mimeType: file.mimetype,
          scannedDocumentName: file.originalname,
          imageBuffer: file.buffer.toString("base64"),
          fileBuffer: file.buffer,
          _dedupeRegistry: crossFileRegistry,
        },
      };

      await scanReceiptAndProcess(mockReq, mockRes);
      const report = {
        fileName: file.originalname,
        success: capture.status >= 200 && capture.status < 300,
        status: capture.status,
        msg: capture.payload?.msg || capture.payload?.message,
        summary: capture.payload?.summary || null,
        error: capture.status >= 400 ? capture.payload?.msg || capture.payload?.message : null,
      };
      fileReports.push(report);

      if (capture.payload?.data?.length) {
        combinedSaved.push(...capture.payload.data);
      }
    }

    const expensesCount = combinedSaved.filter((t) => t.transactionType !== "received").length;
    const receivedCount = combinedSaved.filter((t) => t.transactionType === "received").length;

    return res.status(200).json({
      msg: `Processed ${files.length} file(s). Imported ${combinedSaved.length} transaction(s).`,
      data: combinedSaved,
      fileReports,
      summary: {
        filesProcessed: files.length,
        transactionsScanned: combinedSaved.length,
        expensesCount,
        receivedCount,
        duplicatesSkippedAcrossFiles: fileReports.reduce(
          (sum, r) => sum + (r.summary?.duplicatesSkipped || 0),
          0,
        ),
      },
    });
  } catch (error) {
    console.error("Batch scan failure:", error);
    return res.status(500).json({ success: false, msg: "Batch file processing failed.", error: error.message });
  }
};
