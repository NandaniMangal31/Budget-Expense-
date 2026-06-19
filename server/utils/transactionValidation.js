/**
 * Shared validation for transaction extraction pipelines.
 * Filters failed payments, reference IDs, and OCR noise.
 * 
 * ENHANCED: Comprehensive patterns for failed transaction filtering
 * and received money detection to prevent income being recorded as expenses.
 */

// ✅ COMPREHENSIVE FAILED TRANSACTION PATTERNS
// Covers: failed, declined, rejected, cancelled, reversed, pending (without success indicator)
export const FAILED_TRANSACTION_PATTERNS =
  /\b(failed|failure|declined|rejected|cancelled|canceled|unsuccessful|could\s+not|unable\s+to|payment\s+failed|failed\s+upi|upi\s+failed|reversal\s+failed|transaction\s+failed|txn\s+failed|reversed|reversal|failed\s+payment|payment\s+declined|transaction\s+declined|declined\s+transaction|rejected\s+transaction|failed\s+transaction)\b/i;

// ✅ ENHANCED INCOME/RECEIVED KEYWORDS
// Covers: received, credited, refund, cashback, salary, income, interest, reward, etc.
export const INCOME_KEYWORDS =
  /\b(received\s+from|received\s+on|receive\b|money\s+received|payment\s+received|credited\s+to|credited\s+on|credit\s+from|refund(?:ed)?|refund\s+received|cashback|cashback\s+received|salary|income|transfer\s+received|bank\s+credit|refund\s+processed|reward\s+received|interest\s+received|amount\s+received|money\s+transfer\s+received|incoming\s+transfer|transferred\s+to\s+(?:me|your\s+account)|received\s+payment|bonus|dividend)\b/i;

export const isFailedTransactionLine = (line) => {
  const text = String(line || "").trim();
  if (!text) return false;
  
  // ✅ STRICT CHECKS: Standalone failure keywords
  if (/^\s*failed\s*$/i.test(text)) return true;
  if (/^\s*failure\s*$/i.test(text)) return true;
  if (/^\s*unsuccessful\s*$/i.test(text)) return true;
  if (/^\s*declined\s*$/i.test(text)) return true;
  if (/^\s*rejected\s*$/i.test(text)) return true;
  if (/^\s*cancelled?\s*$/i.test(text)) return true;
  if (/^\s*reversed\s*$/i.test(text)) return true;
  
  // ✅ PATTERN MATCH: Failure indicators with no success/completed markers
  if (FAILED_TRANSACTION_PATTERNS.test(text) && !/\b(success|successful|completed)\b/i.test(text)) {
    return true;
  }
  
  return false;
};

export const isFailedTransactionBlock = (blockLines = []) => {
  const blockText = blockLines.map((l) => String(l || "")).join(" ").toLowerCase();
  
  // ✅ EARLY EXIT: If any line is marked as failed
  if (blockLines.some((line) => isFailedTransactionLine(line))) return true;
  
  // ✅ COMPREHENSIVE PATTERN CHECKS
  const failedPattern = /\b(transaction\s+)?failed\b|\bfailed\s+to\b|\bdeclined\b|\brejected\b|\bunsuccessful\b|\bfailed\s+upi\b|\bpayment\s+failed\b|\bfailure\b|\bpayment\s+declined\b|\bpending\s+(till|still|yet)\b/;
  const successPattern = /\b(success|successful|completed|paid|sent|received|credited)\b/;
  
  if (failedPattern.test(blockText) && !successPattern.test(blockText)) {
    return true;
  }
  
  // ✅ SPECIFIC BLOCKS: Failed payment or reversal blocks
  if (/\bfailed\b/.test(blockText) && /\b(payment\s+to|money\s+sent\s+to|debited)\b/.test(blockText)) {
    return true;
  }
  
  if (/\bpending\b/.test(blockText) && !/\b(success|successful|completed|paid|sent|received)\b/.test(blockText)) {
    return true;
  }
  
  if (/\breversed\b|\breversals?\b/.test(blockText) && !/\b(success|successful|completed)\b/.test(blockText)) {
    return true;
  }
  
  return false;
};

/** Long digit strings are usually UPI IDs, ref numbers, account numbers, or OTPs — not amounts. */
export const isLikelyReferenceNumber = (token, line = "") => {
  const digits = String(token || "").replace(/\D/g, "");
  if (digits.length >= 10) return true;
  if (/\b(upi|ref|reference|txn|transaction|utr|rrn|ifsc|account|a\/c|otp)\b/i.test(line) && digits.length >= 6) {
    return true;
  }
  if (/^\d{12,}$/.test(digits)) return true;
  return false;
};

export const isLikelyOtp = (token) => {
  const digits = String(token || "").replace(/\D/g, "");
  return digits.length >= 4 && digits.length <= 8 && /^[0-9]+$/.test(digits);
};

export default {
  FAILED_TRANSACTION_PATTERNS,
  INCOME_KEYWORDS,
  isFailedTransactionLine,
  isFailedTransactionBlock,
  isLikelyReferenceNumber,
  isLikelyOtp,
};
