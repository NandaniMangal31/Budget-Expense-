/**
 * Shared validation for transaction extraction pipelines.
 * Filters failed payments, reference IDs, and OCR noise.
 */

export const FAILED_TRANSACTION_PATTERNS =
  /\b(failed|failure|declined|rejected|cancelled|canceled|unsuccessful|could\s+not|unable\s+to|payment\s+failed|failed\s+upi|upi\s+failed|reversal\s+failed|transaction\s+failed|txn\s+failed)\b/i;

export const INCOME_KEYWORDS =
  /\b(received\s+from|received\s+on|receive\b|money\s+received|payment\s+received|credited\s+to|credited\s+on|credit\s+from|refund(?:ed)?|cashback|salary|income|transfer\s+received|bank\s+credit|refund\s+processed|reward\s+received|interest\s+received|amount\s+received)\b/i;

export const isFailedTransactionLine = (line) => {
  const text = String(line || "").trim();
  if (!text) return false;
  if (/^\s*failed\s*$/i.test(text)) return true;
  if (/^\s*failure\s*$/i.test(text)) return true;
  if (/^\s*unsuccessful\s*$/i.test(text)) return true;
  if (FAILED_TRANSACTION_PATTERNS.test(text) && !/\b(success|successful|completed)\b/i.test(text)) {
    return true;
  }
  return false;
};

export const isFailedTransactionBlock = (blockLines = []) => {
  const blockText = blockLines.map((l) => String(l || "")).join(" ").toLowerCase();
  if (blockLines.some((line) => isFailedTransactionLine(line))) return true;
  if (
    /\b(transaction\s+)?failed\b|\bfailed\s+to\b|\bdeclined\b|\brejected\b|\bunsuccessful\b|\bfailed\s+upi\b|\bpayment\s+failed\b|\bfailure\b/.test(
      blockText,
    ) &&
    !/\b(success|successful|completed)\b/.test(blockText)
  ) {
    return true;
  }
  if (/\bfailed\b/.test(blockText) && /\b(payment\s+to|money\s+sent\s+to|debited)\b/.test(blockText)) {
    return true;
  }
  if (/\bpending\b/.test(blockText) && !/\b(success|successful|completed|paid|sent|received)\b/.test(blockText)) {
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
